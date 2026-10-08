<?php

namespace App\Domain\Playbooks;

use App\Domain\XpEconomy;
use App\Enums\ActionStatus;
use App\Enums\OpportunityStatus;
use App\Enums\XpReason;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Validation\ValidationException;

final class PlaybookKit
{
    public static function today(): string
    {
        return now()->toDateString();
    }

    public static function addDays(int $days): string
    {
        return now()->startOfDay()->addDays($days)->toDateString();
    }

    public static function isActionable(OpportunityAction $action): bool
    {
        if ($action->due_on === null) {
            return true;
        }

        return $action->due_on->toDateString() <= self::today();
    }

    public static function openAction(Opportunity $opportunity): ?OpportunityAction
    {
        $actions = $opportunity->relationLoaded('actions')
            ? $opportunity->actions
            : $opportunity->actions()->get();

        return $actions
            ->filter(fn (OpportunityAction $action) => $action->status === ActionStatus::Open)
            ->sortBy([['sort_order', 'asc'], ['id', 'asc']])
            ->first();
    }

    public static function addAction(
        Opportunity $opportunity,
        string $key,
        string $title,
        string $description,
        ?int $minutes,
        int $xp,
        ?string $dueOn = null,
    ): OpportunityAction {
        $sort = (int) $opportunity->actions()->max('sort_order') + 1;

        return $opportunity->actions()->create([
            'title' => $title,
            'description' => $description,
            'status' => ActionStatus::Open,
            'estimated_minutes' => $minutes,
            'xp_reward' => $xp,
            'sort_order' => $sort,
            'system_owned' => true,
            'playbook_key' => $key,
            'due_on' => $dueOn,
        ]);
    }

    public static function discardOpenActions(Opportunity $opportunity): void
    {
        $opportunity->actions()->where('status', ActionStatus::Open)->delete();
        $opportunity->unsetRelation('actions');
    }

    public static function make(User $user, string $type, string $playbook, string $title, array $attributes): Opportunity
    {
        return $user->opportunities()->create([
            'type' => $type,
            'playbook' => $playbook,
            'title' => $title,
            'currency' => $user->currentGoal()?->currency ?? 'EUR',
            ...$attributes,
        ]);
    }

    public static function requireOpen(Opportunity $opportunity): void
    {
        if (in_array($opportunity->status, [OpportunityStatus::Completed, OpportunityStatus::Abandoned, OpportunityStatus::Paused], true)) {
            throw ValidationException::withMessages([
                'outcome' => 'This mission is not open for a new outcome.',
            ]);
        }
    }

    public static function close(Opportunity $opportunity, string $outcome): void
    {
        self::discardOpenActions($opportunity);
        $opportunity->outcome = $outcome;
        $opportunity->save();
        $opportunity->complete();
    }

    public static function moneyField(string $key, string $label, bool $required = true, ?int $prefill = null): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'type' => 'money',
            'required' => $required,
            'prefill_minor' => $prefill,
            'default' => null,
        ];
    }

    public static function dateField(string $key, string $label, bool $required = true, ?string $default = null): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'type' => 'date',
            'required' => $required,
            'prefill_minor' => null,
            'default' => $default,
        ];
    }

    public static function textField(string $key, string $label, bool $required = false): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'type' => 'text',
            'required' => $required,
            'prefill_minor' => null,
            'default' => null,
        ];
    }

    public static function outcome(string $key, string $label, array $fields = [], string $tone = 'primary', bool $confirmsMoney = false): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'tone' => $tone,
            'confirms_money' => $confirmsMoney,
            'fields' => $fields,
        ];
    }

    public static function amount(array $input, string $key, bool $required, string $message): ?int
    {
        $value = $input[$key] ?? null;

        if ($value === null || $value === '') {
            if ($required) {
                throw ValidationException::withMessages([$key => $message]);
            }

            return null;
        }

        if (! is_numeric($value) || (int) $value < ($key === 'new_monthly_minor' ? 0 : 1)) {
            throw ValidationException::withMessages([$key => $message]);
        }

        return (int) $value;
    }

    public static function calendarDate(array $input, string $key, bool $required, string $message): ?string
    {
        $value = $input[$key] ?? null;

        if ($value === null || $value === '') {
            if ($required) {
                throw ValidationException::withMessages([$key => $message]);
            }

            return null;
        }

        if (! is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) !== 1) {
            throw ValidationException::withMessages([$key => 'Choose a date from the calendar.']);
        }

        [$year, $month, $day] = array_map('intval', explode('-', $value));

        if (! checkdate($month, $day, $year)) {
            throw ValidationException::withMessages([$key => 'Choose a real date.']);
        }

        return $value;
    }

    public static function awardCrossedBonuses(Opportunity $opportunity, int $beforeMinor): void
    {
        $after = $opportunity->realizedMinor();

        foreach (XpEconomy::newlyCrossedBonuses($beforeMinor, $after) as $award) {
            XpEvent::query()->create([
                'user_id' => $opportunity->user_id,
                'opportunity_id' => $opportunity->id,
                'opportunity_action_id' => null,
                'amount' => $award['amount'],
                'reason' => XpReason::OutcomeBonus,
                'description' => $award['description'],
                'occurred_at' => now(),
            ]);
        }
    }

    public static function guardMoneyEdits(Opportunity $opportunity): void
    {
        if ($opportunity->financialImpacts()->exists()) {
            throw ValidationException::withMessages([
                'amount_minor' => 'Money already recorded on this mission stays as history.',
            ]);
        }
    }

    /**
     * @param  list<array{label: string, amount_minor: int|null}>  $rows
     * @return list<array{label: string, amount_minor: int, currency: string}>
     */
    public static function moneyLines(Opportunity $opportunity, array $rows): array
    {
        $lines = [];

        foreach ($rows as $row) {
            if ($row['amount_minor'] === null) {
                continue;
            }

            $lines[] = [
                'label' => $row['label'],
                'amount_minor' => $row['amount_minor'],
                'currency' => $opportunity->currency,
            ];
        }

        return $lines;
    }

    public static function describeAction(Opportunity $opportunity, ?OpportunityAction $action, string $waitingCopy): ?array
    {
        if ($action === null) {
            return null;
        }

        $actionable = self::isActionable($action);
        $minutesLabel = $action->estimated_minutes === null
            ? 'Project milestone'
            : 'About '.$action->estimated_minutes.' min';

        return [
            'id' => $action->id,
            'title' => $action->title,
            'description' => $action->description,
            'playbook_key' => $action->playbook_key,
            'due_on' => $action->due_on?->toDateString(),
            'actionable' => $actionable,
            'minutes_label' => $action->playbook_key === 'do_the_work' ? 'Project milestone' : $minutesLabel,
            'blocked_reason' => $actionable || $action->due_on === null
                ? null
                : $waitingCopy,
        ];
    }
}
