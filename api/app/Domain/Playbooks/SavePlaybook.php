<?php

namespace App\Domain\Playbooks;

use App\Actions\RecordOpportunitySettlement;
use App\Domain\XpEconomy;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Enums\RecurrenceInterval;
use App\Enums\SettlementMode;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SavePlaybook
{
    public function start(User $user, array $input): Opportunity
    {
        $current = PlaybookKit::amount($input, 'current_monthly_minor', false, 'Enter what you pay each month.');

        return DB::transaction(function () use ($user, $input, $current): Opportunity {
            $opportunity = PlaybookKit::make($user, OpportunityType::Save->value, 'reduce_expense', $input['title'], [
                'status' => OpportunityStatus::Active,
                'stage' => $current === null ? 'identified' : 'reviewing',
                'context' => $current === null ? [] : ['current_monthly_minor' => $current],
            ]);

            if ($current === null) {
                PlaybookKit::addAction($opportunity, 'capture_cost', 'Find what you pay now', 'Check the last charge.', 10, XpEconomy::SMALL);
            } else {
                PlaybookKit::addAction($opportunity, 'review_expense', 'Check whether you still need it', 'Look for a cheaper plan, or whether you can cancel it.', 20, XpEconomy::PREPARATION);
            }

            return $opportunity;
        });
    }

    public function label(Opportunity $opportunity): string
    {
        return match ($opportunity->outcome) {
            'cancelled' => 'Cancelled',
            'reduced' => 'Reduced',
            'no_change' => 'Kept it',
            default => match ($opportunity->stage) {
                'reviewing' => 'Reviewing the cost',
                'action_taken' => 'What did you decide?',
                'confirmed' => 'Confirmed',
                default => 'Identify the cost',
            },
        };
    }

    public function present(Opportunity $opportunity): array
    {
        $action = PlaybookKit::openAction($opportunity);
        $current = $this->current($opportunity);

        return [
            'stage_label' => $this->label($opportunity),
            'headline' => $action?->title ?? 'What did you decide?',
            'detail' => $action?->description,
            'money' => PlaybookKit::moneyLines($opportunity, [
                ['label' => isset(($opportunity->context ?? [])['new_monthly_minor']) || $opportunity->outcome !== null ? 'Was paying' : 'You pay each month', 'amount_minor' => $current],
                ['label' => 'Now paying', 'amount_minor' => isset(($opportunity->context ?? [])['new_monthly_minor']) ? (int) $opportunity->context['new_monthly_minor'] : null],
                ['label' => 'Saved this period', 'amount_minor' => $opportunity->realizedMinor() > 0 ? $opportunity->realizedMinor() : null],
            ]),
            'action' => $this->actionPayload($opportunity, $action),
            'outcomes' => in_array($opportunity->status, OpportunityStatus::open(), true)
                ? $this->outcomes($opportunity, $action)
                : [],
            'editable' => in_array($opportunity->status, OpportunityStatus::open(), true) && ! $opportunity->financialImpacts()->exists()
                ? [PlaybookKit::moneyField('current_monthly_minor', 'What you pay each month', false, $current)]
                : [],
        ];
    }

    public function onComplete(Opportunity $opportunity, OpportunityAction $action, array $input): void
    {
        if ($action->playbook_key === 'capture_cost') {
            $current = PlaybookKit::amount($input, 'current_monthly_minor', true, 'Enter what you pay each month.');
            $context = $opportunity->context ?? [];
            $context['current_monthly_minor'] = $current;
            $opportunity->context = $context;
            $opportunity->stage = 'reviewing';
            $opportunity->save();
            PlaybookKit::addAction($opportunity, 'review_expense', 'Check whether you still need it', 'Look for a cheaper plan, or whether you can cancel it.', 20, XpEconomy::PREPARATION);
        }

        if ($action->playbook_key === 'review_expense') {
            $opportunity->stage = 'action_taken';
            $opportunity->status = OpportunityStatus::Active;
            $opportunity->save();
        }
    }

    public function report(Opportunity $opportunity, string $outcome, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);

        if ($opportunity->stage !== 'action_taken') {
            throw ValidationException::withMessages([
                'outcome' => 'Review the cost before choosing what you did.',
            ]);
        }

        match ($outcome) {
            'cancel' => $this->applySaving($opportunity, 0, 'cancelled'),
            'reduce' => $this->applySaving(
                $opportunity,
                PlaybookKit::amount($input, 'new_monthly_minor', true, 'Enter what you pay now.'),
                'reduced',
            ),
            'keep' => $this->keep($opportunity),
            default => throw ValidationException::withMessages([
                'outcome' => 'That outcome does not fit this cost.',
            ]),
        };
    }

    public function updateDetails(Opportunity $opportunity, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);
        PlaybookKit::guardMoneyEdits($opportunity);
        $current = PlaybookKit::amount($input, 'current_monthly_minor', true, 'Enter what you pay each month.');
        $context = $opportunity->context ?? [];
        $context['current_monthly_minor'] = $current;
        $opportunity->context = $context;
        $opportunity->save();
    }

    private function applySaving(Opportunity $opportunity, int $next, string $outcome): void
    {
        $current = (int) ($this->current($opportunity) ?? 0);
        $saving = $current - $next;

        if ($current < 1 || $saving < 1) {
            throw ValidationException::withMessages([
                'new_monthly_minor' => 'The new amount needs to be lower than what you paid before.',
            ]);
        }

        $before = $opportunity->realizedMinor();
        app(RecordOpportunitySettlement::class)(
            opportunity: $opportunity,
            amountMinor: $saving,
            occurredAt: now(),
            note: 'Monthly cost reduced',
            recurringAmountMinor: $saving,
            recurrence: RecurrenceInterval::Month,
            settlement: SettlementMode::None,
            remainingExpectedMinor: null,
            complete: false,
        );
        $fresh = $opportunity->fresh();
        $context = $fresh->context ?? [];
        $context['new_monthly_minor'] = $next;
        $fresh->context = $context;
        $fresh->stage = 'confirmed';
        $fresh->outcome = $outcome;
        $fresh->save();
        $fresh->complete();
        PlaybookKit::awardCrossedBonuses($fresh->fresh(), $before);
        PlaybookKit::discardOpenActions($fresh);
    }

    private function keep(Opportunity $opportunity): void
    {
        $opportunity->stage = 'confirmed';
        $opportunity->outcome = 'no_change';
        $opportunity->save();
        $opportunity->complete();
        PlaybookKit::discardOpenActions($opportunity->fresh());
    }

    private function outcomes(Opportunity $opportunity, ?OpportunityAction $action): array
    {
        if ($opportunity->status === OpportunityStatus::Paused || $opportunity->stage !== 'action_taken' || $action !== null) {
            return [];
        }

        return [
            PlaybookKit::outcome('cancel', 'I cancelled it', []),
            PlaybookKit::outcome('reduce', 'I pay less now', [
                PlaybookKit::moneyField('new_monthly_minor', 'What you pay now each month', true),
            ]),
            PlaybookKit::outcome('keep', 'I kept it', [], 'secondary'),
        ];
    }

    private function actionPayload(Opportunity $opportunity, ?OpportunityAction $action): ?array
    {
        if ($action === null) {
            return null;
        }

        $payload = PlaybookKit::describeAction($opportunity, $action, '');
        $payload['completion'] = $action->playbook_key === 'capture_cost' ? 'form' : 'simple';
        $payload['fields'] = $action->playbook_key === 'capture_cost'
            ? [PlaybookKit::moneyField('current_monthly_minor', 'What you pay each month', true)]
            : [];

        return $payload;
    }

    private function current(Opportunity $opportunity): ?int
    {
        $value = ($opportunity->context ?? [])['current_monthly_minor'] ?? null;

        return $value === null ? null : (int) $value;
    }
}
