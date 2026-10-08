<?php

namespace App\Domain\Playbooks;

use App\Actions\RecordOpportunitySettlement;
use App\Domain\XpEconomy;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Enums\SettlementMode;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class RecoverPlaybook
{
    public function start(User $user, array $input): Opportunity
    {
        $amount = PlaybookKit::amount($input, 'amount_minor', false, 'Enter the amount you expect.');
        $expectedOn = PlaybookKit::calendarDate($input, 'expected_on', false, 'Choose the day you expect it.');

        $overdue = $expectedOn !== null && $expectedOn <= PlaybookKit::today();
        $status = $amount === null
            ? OpportunityStatus::Explore
            : ($expectedOn === null || $overdue ? OpportunityStatus::Active : OpportunityStatus::Waiting);
        $stage = $amount === null ? 'identified' : ($overdue ? 'overdue' : 'expected');

        return DB::transaction(function () use ($user, $input, $amount, $expectedOn, $status, $stage, $overdue): Opportunity {
            $opportunity = PlaybookKit::make($user, OpportunityType::Recover->value, 'recover_money', $input['title'], [
                'status' => $status,
                'stage' => $stage,
                'expected_amount_minor' => $amount,
                'expected_on' => $expectedOn,
                'context' => array_filter([
                    'kind' => $input['kind'] ?? null,
                ]),
            ]);

            if ($amount === null) {
                $this->addCapture($opportunity);
            } elseif ($expectedOn === null) {
                $this->addSetFollowUp($opportunity);
            } else {
                $this->addFollowUp($opportunity, $expectedOn, $overdue);
            }

            return $opportunity;
        });
    }

    public function label(Opportunity $opportunity): string
    {
        return match ($opportunity->outcome) {
            'received' => 'Received',
            'written_off' => "They won't pay",
            'claim_rejected' => 'Claim rejected',
            default => match ($opportunity->stage) {
                'requested' => 'Asked for it',
                'expected' => 'Waiting for the money',
                'overdue' => 'Follow up',
                'received' => 'Received',
                default => 'Identified',
            },
        };
    }

    public function present(Opportunity $opportunity): array
    {
        $action = PlaybookKit::openAction($opportunity);
        $actionable = $action !== null && PlaybookKit::isActionable($action);

        return [
            'stage_label' => $this->label($opportunity),
            'headline' => $this->headline($opportunity, $actionable),
            'detail' => $this->detail($opportunity, $action, $actionable),
            'money' => PlaybookKit::moneyLines($opportunity, [
                ['label' => 'Expected', 'amount_minor' => $opportunity->expected_amount_minor],
                ['label' => 'Received', 'amount_minor' => $opportunity->realizedMinor() > 0 ? $opportunity->realizedMinor() : null],
            ]),
            'action' => $this->actionPayload($opportunity, $action),
            'outcomes' => in_array($opportunity->status, OpportunityStatus::open(), true)
                ? $this->outcomes($opportunity, $action, $actionable)
                : [],
            'editable' => in_array($opportunity->status, OpportunityStatus::open(), true)
                ? $this->editable($opportunity, $action)
                : [],
        ];
    }

    public function onComplete(Opportunity $opportunity, OpportunityAction $action, array $input): void
    {
        if ($action->playbook_key === 'follow_up') {
            throw ValidationException::withMessages([
                'outcome' => 'Choose what happened when you followed up.',
            ]);
        }

        if ($action->playbook_key === 'capture_amount') {
            $amount = PlaybookKit::amount($input, 'amount_minor', true, 'Enter the amount you expect.');
            $date = PlaybookKit::calendarDate($input, 'expected_on', false, 'Choose the day you expect it.');
            $opportunity->expected_amount_minor = $amount;
            $opportunity->expected_on = $date;
            $opportunity->stage = 'expected';
            $opportunity->save();

            if ($date === null) {
                $opportunity->status = OpportunityStatus::Active;
                $opportunity->save();
                $this->addSetFollowUp($opportunity);
            } else {
                $overdue = $date <= PlaybookKit::today();
                $opportunity->status = $overdue ? OpportunityStatus::Active : OpportunityStatus::Waiting;
                $opportunity->stage = $overdue ? 'overdue' : 'expected';
                $opportunity->save();
                $this->addFollowUp($opportunity, $date, $overdue);
            }
        }

        if ($action->playbook_key === 'set_follow_up') {
            $date = PlaybookKit::calendarDate($input, 'expected_on', true, 'Choose the day you will follow up.');
            $opportunity->expected_on = $date;
            $overdue = $date <= PlaybookKit::today();
            $opportunity->status = $overdue ? OpportunityStatus::Active : OpportunityStatus::Waiting;
            $opportunity->stage = $overdue ? 'overdue' : 'expected';
            $opportunity->save();
            $this->addFollowUp($opportunity, $date, $overdue);
        }
    }

    public function report(Opportunity $opportunity, string $outcome, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);

        match ($outcome) {
            'received' => $this->receive($opportunity, $input, partial: false),
            'partial' => $this->receive($opportunity, $input, partial: true),
            'new_date' => $this->newDate($opportunity, $input),
            'written_off' => PlaybookKit::close($opportunity, $this->writeOffKey($opportunity)),
            'claim_rejected' => PlaybookKit::close($opportunity, 'claim_rejected'),
            default => throw ValidationException::withMessages([
                'outcome' => 'That outcome does not fit this recovery.',
            ]),
        };
    }

    public function updateDetails(Opportunity $opportunity, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);

        if (array_key_exists('amount_minor', $input)) {
            PlaybookKit::guardMoneyEdits($opportunity);
            $opportunity->expected_amount_minor = PlaybookKit::amount($input, 'amount_minor', true, 'Enter the amount you expect.');
        }

        if (array_key_exists('expected_on', $input)) {
            $date = PlaybookKit::calendarDate($input, 'expected_on', true, 'Choose the day you expect it.');
            $opportunity->expected_on = $date;
            $action = PlaybookKit::openAction($opportunity);
            if ($action !== null && $action->playbook_key === 'follow_up') {
                $action->due_on = $date;
                $action->description = $date <= PlaybookKit::today()
                    ? 'The date has passed. Ask for an update.'
                    : "Nothing is required before {$date}.";
                $action->save();
            }
            $overdue = $date <= PlaybookKit::today();
            if ($opportunity->status !== OpportunityStatus::Paused) {
                $opportunity->status = $overdue ? OpportunityStatus::Active : OpportunityStatus::Waiting;
                $opportunity->stage = $overdue ? 'overdue' : 'expected';
            }
        }

        $opportunity->save();
    }

    private function receive(Opportunity $opportunity, array $input, bool $partial): void
    {
        $amount = PlaybookKit::amount($input, 'amount_minor', true, 'Enter the amount you received.');
        $before = $opportunity->realizedMinor();

        if ($partial) {
            $remaining = PlaybookKit::amount($input, 'remaining_minor', true, 'Enter how much is still coming.');
            app(RecordOpportunitySettlement::class)(
                opportunity: $opportunity,
                amountMinor: $amount,
                occurredAt: now(),
                note: 'Partial payment',
                recurringAmountMinor: null,
                recurrence: null,
                settlement: SettlementMode::Partial,
                remainingExpectedMinor: $remaining,
                complete: false,
            );
            $fresh = $opportunity->fresh();
            $fresh->stage = 'expected';
            $fresh->save();
            PlaybookKit::awardCrossedBonuses($fresh, $before);

            return;
        }

        app(RecordOpportunitySettlement::class)(
            opportunity: $opportunity,
            amountMinor: $amount,
            occurredAt: now(),
            note: 'Payment received',
            recurringAmountMinor: null,
            recurrence: null,
            settlement: SettlementMode::Full,
            remainingExpectedMinor: null,
            complete: true,
        );
        $fresh = $opportunity->fresh();
        PlaybookKit::awardCrossedBonuses($fresh, $before);
        PlaybookKit::discardOpenActions($fresh);
        $fresh->outcome = 'received';
        $fresh->stage = 'received';
        $fresh->save();
    }

    private function newDate(Opportunity $opportunity, array $input): void
    {
        $date = PlaybookKit::calendarDate($input, 'expected_on', true, 'Choose the new day you expect it.');
        $action = PlaybookKit::openAction($opportunity);

        if ($action !== null && $action->playbook_key === 'follow_up' && PlaybookKit::isActionable($action)) {
            $action->complete();
        } else {
            PlaybookKit::discardOpenActions($opportunity);
        }

        $overdue = $date <= PlaybookKit::today();
        $opportunity->expected_on = $date;
        $opportunity->status = $overdue ? OpportunityStatus::Active : OpportunityStatus::Waiting;
        $opportunity->stage = $overdue ? 'overdue' : 'expected';
        $opportunity->save();
        $this->addFollowUp($opportunity, $date, $overdue);
    }

    private function writeOffKey(Opportunity $opportunity): string
    {
        return ($opportunity->context['kind'] ?? null) === 'refund' ? 'claim_rejected' : 'written_off';
    }

    private function addCapture(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'capture_amount', 'Write down the amount and when you expect it', 'A rough figure is enough.', 10, XpEconomy::SMALL);
    }

    private function addSetFollowUp(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'set_follow_up', 'Choose when to follow up', 'Pick a day so this does not sit quietly forever.', 10, XpEconomy::SMALL);
    }

    private function addFollowUp(Opportunity $opportunity, string $date, bool $dueNow): void
    {
        PlaybookKit::addAction(
            $opportunity,
            'follow_up',
            'Follow up',
            $dueNow ? 'The date has passed. Ask for an update.' : "Nothing is required before {$date}.",
            15,
            XpEconomy::SMALL,
            $date,
        );
    }

    private function headline(Opportunity $opportunity, bool $actionable): string
    {
        if ($opportunity->outcome !== null) {
            return $this->label($opportunity);
        }

        if ($actionable) {
            return 'Follow up';
        }

        if ($opportunity->expected_on !== null && $opportunity->expected_on->toDateString() > PlaybookKit::today()) {
            return 'Waiting for the money';
        }

        return $this->label($opportunity);
    }

    private function detail(Opportunity $opportunity, ?OpportunityAction $action, bool $actionable): ?string
    {
        if ($action === null || $action->due_on === null) {
            return $action?->description;
        }

        $date = $action->due_on->toDateString();

        if (! $actionable) {
            return "Nothing is required before {$date}.";
        }

        if ($date < PlaybookKit::today()) {
            return "This was expected on {$date}.";
        }

        return "Expected on {$date}.";
    }

    private function actionPayload(Opportunity $opportunity, ?OpportunityAction $action): ?array
    {
        if ($action === null) {
            return null;
        }

        $actionable = PlaybookKit::isActionable($action);
        $payload = PlaybookKit::describeAction($opportunity, $action, $this->detail($opportunity, $action, false) ?? '');
        $payload['completion'] = in_array($action->playbook_key, ['capture_amount', 'set_follow_up'], true) ? 'form' : 'simple';
        $payload['fields'] = ! $actionable ? [] : match ($action->playbook_key) {
            'capture_amount' => [
                PlaybookKit::moneyField('amount_minor', 'Amount you expect', true),
                PlaybookKit::dateField('expected_on', 'I expect it by', false),
            ],
            'set_follow_up' => [
                PlaybookKit::dateField('expected_on', 'I expect it by', true),
            ],
            default => [],
        };

        if ($action->playbook_key === 'follow_up') {
            $payload['completion'] = 'simple';
            $payload['fields'] = [];
        }

        return $payload;
    }

    private function outcomes(Opportunity $opportunity, ?OpportunityAction $action, bool $actionable): array
    {
        if ($opportunity->expected_amount_minor === null && $action?->playbook_key === 'capture_amount') {
            return [];
        }

        $rows = [
            PlaybookKit::outcome('received', 'I got paid', [
                PlaybookKit::moneyField('amount_minor', 'Amount you received', true, $opportunity->expected_amount_minor),
            ], 'primary', true),
            PlaybookKit::outcome('partial', 'I received part of it', [
                PlaybookKit::moneyField('amount_minor', 'Amount you received', true),
                PlaybookKit::moneyField('remaining_minor', 'How much is still coming?', true, $opportunity->expected_amount_minor),
            ], 'secondary', true),
            PlaybookKit::outcome('new_date', 'They promised a new date', [
                PlaybookKit::dateField('expected_on', 'I expect it by', true, PlaybookKit::addDays(7)),
            ], 'secondary'),
            PlaybookKit::outcome('written_off', $this->writeOffKey($opportunity) === 'claim_rejected' ? 'Claim rejected' : "They won't pay", [], 'danger'),
        ];

        if ($action?->playbook_key === 'follow_up' && ! $actionable) {
            return $rows;
        }

        return $rows;
    }

    private function editable(Opportunity $opportunity, ?OpportunityAction $action): array
    {
        $fields = [];

        if (! $opportunity->financialImpacts()->exists()) {
            $fields[] = PlaybookKit::moneyField('amount_minor', 'Amount you expect', false, $opportunity->expected_amount_minor);
        }

        $fields[] = PlaybookKit::dateField('expected_on', 'I expect it by', false, $opportunity->expected_on?->toDateString());

        return $fields;
    }
}
