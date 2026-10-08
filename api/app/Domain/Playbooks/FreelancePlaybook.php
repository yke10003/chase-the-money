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

final class FreelancePlaybook
{
    public function start(User $user, array $input): Opportunity
    {
        $state = $input['current_state'] ?? 'lead';
        $proposed = PlaybookKit::amount($input, 'proposed_amount_minor', false, 'Enter what you quoted.');
        $agreed = PlaybookKit::amount($input, 'agreed_amount_minor', $state === 'accepted', 'Enter what you agreed on.');
        $invoiceAmount = PlaybookKit::amount($input, 'invoice_amount_minor', false, 'Enter the invoice amount.');
        $followUp = PlaybookKit::calendarDate(
            $input,
            'follow_up_on',
            in_array($state, ['proposal_sent'], true),
            'Choose the day you will follow up.',
        );
        $due = PlaybookKit::calendarDate(
            $input,
            'payment_due_on',
            $state === 'invoice_sent',
            'Choose the day the payment is due.',
        );

        [$status, $stage, $expectedOn, $expectedAmount] = match ($state) {
            'conversation' => [OpportunityStatus::Active, 'contact', null, null],
            'proposal_sent' => [OpportunityStatus::Waiting, 'proposal', $followUp, null],
            'accepted' => [OpportunityStatus::Active, 'agreed', null, $agreed],
            'working' => [OpportunityStatus::Active, 'working', null, $agreed],
            'invoice_sent' => [OpportunityStatus::Waiting, 'invoiced', $due, $invoiceAmount ?? $agreed],
            default => [OpportunityStatus::Active, 'idea', null, null],
        };

        return DB::transaction(function () use ($user, $input, $state, $proposed, $agreed, $invoiceAmount, $status, $stage, $expectedOn, $expectedAmount, $followUp, $due): Opportunity {
            $opportunity = PlaybookKit::make($user, OpportunityType::Earn->value, 'freelance', $input['title'], [
                'status' => $status,
                'stage' => $stage,
                'potential_min_minor' => $proposed,
                'potential_max_minor' => $proposed,
                'expected_amount_minor' => $expectedAmount,
                'agreed_amount_minor' => in_array($state, ['accepted', 'working', 'invoice_sent'], true) ? ($agreed ?? $invoiceAmount) : null,
                'expected_on' => $expectedOn,
                'context' => ['current_state' => $state],
            ]);

            match ($state) {
                'conversation' => $this->addSendProposal($opportunity),
                'proposal_sent' => $this->addFollowUp($opportunity, (string) $followUp),
                'accepted', 'working' => $state === 'working'
                    ? $this->addInvoice($opportunity)
                    : $this->addWork($opportunity),
                'invoice_sent' => $this->addPaymentFollowUp($opportunity, (string) $due),
                default => $this->addReachOut($opportunity),
            };

            return $opportunity;
        });
    }

    public function label(Opportunity $opportunity): string
    {
        return match ($opportunity->outcome) {
            'paid' => 'Paid',
            'declined' => 'They declined',
            'stopped_pursuing' => 'Stopped pursuing',
            'written_off' => 'Written off',
            default => match ($opportunity->stage) {
                'contact' => 'Talking',
                'proposal' => 'Proposal sent',
                'agreed' => 'Accepted',
                'working' => $this->openKey($opportunity) === 'send_invoice' ? 'Ready to invoice' : 'Doing the work',
                'invoiced' => 'Waiting for payment',
                'paid' => 'Paid',
                default => 'Not contacted yet',
            },
        };
    }

    public function present(Opportunity $opportunity): array
    {
        $action = PlaybookKit::openAction($opportunity);
        $actionable = $action !== null && PlaybookKit::isActionable($action);
        $headline = $this->headline($opportunity, $action, $actionable);

        return [
            'stage_label' => $this->label($opportunity),
            'headline' => $headline,
            'detail' => $this->detail($opportunity, $action, $actionable),
            'money' => $this->money($opportunity),
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
                'outcome' => 'Choose what happened after the follow-up.',
            ]);
        }

        match ($action->playbook_key) {
            'reach_out' => $this->afterReachOut($opportunity),
            'send_proposal' => $this->afterProposal($opportunity, $input),
            'do_the_work' => $this->afterWork($opportunity),
            'send_invoice' => $this->afterInvoice($opportunity, $input),
            default => null,
        };
    }

    public function report(Opportunity $opportunity, string $outcome, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);

        match ($outcome) {
            'accepted' => $this->accept($opportunity, $input, awardFollowUp: false),
            'declined' => $this->decline($opportunity),
            'stop' => $this->stop($opportunity),
            'revise' => $this->revise($opportunity, $input),
            'followed_up' => $this->followedUp($opportunity, $input),
            'paid' => $this->paid($opportunity, $input, partial: false),
            'partial' => $this->paid($opportunity, $input, partial: true),
            'still_waiting' => $this->reschedule($opportunity, $input),
            'written_off' => $this->writeOff($opportunity),
            default => throw ValidationException::withMessages([
                'outcome' => 'That outcome does not fit this freelance mission.',
            ]),
        };
    }

    public function updateDetails(Opportunity $opportunity, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);
        $action = PlaybookKit::openAction($opportunity);

        if (array_key_exists('proposed_amount_minor', $input)) {
            PlaybookKit::guardMoneyEdits($opportunity);
            $amount = PlaybookKit::amount($input, 'proposed_amount_minor', true, 'Enter the proposed amount.');
            $opportunity->potential_min_minor = $amount;
            $opportunity->potential_max_minor = $amount;
        }

        if (array_key_exists('agreed_amount_minor', $input)) {
            PlaybookKit::guardMoneyEdits($opportunity);
            $amount = PlaybookKit::amount($input, 'agreed_amount_minor', true, 'Enter the agreed amount.');
            $opportunity->expected_amount_minor = $amount;
            $opportunity->agreed_amount_minor = $amount;
        }

        if (array_key_exists('follow_up_on', $input) || array_key_exists('payment_due_on', $input)) {
            $key = array_key_exists('payment_due_on', $input) ? 'payment_due_on' : 'follow_up_on';
            $date = PlaybookKit::calendarDate($input, $key, true, 'Choose a date.');
            $opportunity->expected_on = $date;
            if ($action !== null && $action->playbook_key === 'follow_up') {
                $action->due_on = $date;
                $action->description = $opportunity->stage === 'invoiced'
                    ? "Payment is due on {$date}."
                    : "Follow up on {$date}.";
                $action->save();
            }
        }

        $opportunity->save();
    }

    private function afterReachOut(Opportunity $opportunity): void
    {
        $opportunity->stage = 'contact';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
        $this->addSendProposal($opportunity);
    }

    private function afterProposal(Opportunity $opportunity, array $input): void
    {
        $quoted = PlaybookKit::amount($input, 'proposed_amount_minor', false, 'Enter what you quoted.');
        $followUp = PlaybookKit::calendarDate($input, 'follow_up_on', true, 'Choose the day you will follow up.');
        if ($quoted !== null) {
            $opportunity->potential_min_minor = $quoted;
            $opportunity->potential_max_minor = $quoted;
        }
        $opportunity->stage = 'proposal';
        $opportunity->status = OpportunityStatus::Waiting;
        $opportunity->expected_on = $followUp;
        $opportunity->save();
        $this->addFollowUp($opportunity, $followUp);
    }

    private function afterWork(Opportunity $opportunity): void
    {
        $opportunity->stage = 'working';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
        $this->addInvoice($opportunity);
    }

    private function afterInvoice(Opportunity $opportunity, array $input): void
    {
        $amount = PlaybookKit::amount($input, 'invoice_amount_minor', true, 'Enter the invoice amount.');
        $due = PlaybookKit::calendarDate($input, 'payment_due_on', true, 'Choose the day the payment is due.');
        $opportunity->expected_amount_minor = $amount;
        $opportunity->agreed_amount_minor ??= $amount;
        $opportunity->expected_on = $due;
        $opportunity->stage = 'invoiced';
        $opportunity->status = OpportunityStatus::Waiting;
        $opportunity->save();
        $this->addPaymentFollowUp($opportunity, $due);
    }

    private function accept(Opportunity $opportunity, array $input, bool $awardFollowUp): void
    {
        if (! in_array($opportunity->stage, ['proposal', 'contact', 'idea'], true)) {
            throw ValidationException::withMessages([
                'outcome' => 'This proposal cannot be accepted from here.',
            ]);
        }

        $agreed = PlaybookKit::amount($input, 'agreed_amount_minor', true, 'Enter what you agreed on.');

        if ($awardFollowUp) {
            $this->completeFollowUp($opportunity);
        } else {
            PlaybookKit::discardOpenActions($opportunity);
        }

        $opportunity->expected_amount_minor = $agreed;
        $opportunity->agreed_amount_minor = $agreed;
        $opportunity->stage = 'agreed';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->expected_on = null;
        $opportunity->save();
        $this->addWork($opportunity);
    }

    private function decline(Opportunity $opportunity): void
    {
        if ($opportunity->stage !== 'proposal') {
            throw ValidationException::withMessages([
                'outcome' => 'There is no open proposal to decline.',
            ]);
        }

        PlaybookKit::close($opportunity, 'declined');
    }

    private function stop(Opportunity $opportunity): void
    {
        PlaybookKit::close($opportunity, 'stopped_pursuing');
    }

    private function revise(Opportunity $opportunity, array $input): void
    {
        if ($opportunity->stage !== 'proposal') {
            throw ValidationException::withMessages([
                'outcome' => 'Only a sent proposal can be updated.',
            ]);
        }

        $quoted = PlaybookKit::amount($input, 'proposed_amount_minor', false, 'Enter the updated quote.');
        $followUp = PlaybookKit::calendarDate($input, 'follow_up_on', true, 'Choose the next follow-up day.');

        if ($quoted !== null) {
            $opportunity->potential_min_minor = $quoted;
            $opportunity->potential_max_minor = $quoted;
        }

        $opportunity->status = OpportunityStatus::Waiting;
        $opportunity->expected_on = $followUp;
        $opportunity->save();
        $this->rescheduleOpenFollowUp($opportunity, $followUp);
    }

    private function followedUp(Opportunity $opportunity, array $input): void
    {
        $action = PlaybookKit::openAction($opportunity);

        if ($action === null || $action->playbook_key !== 'follow_up' || ! PlaybookKit::isActionable($action)) {
            throw ValidationException::withMessages([
                'outcome' => 'There is no follow-up due yet.',
            ]);
        }

        $result = $input['result'] ?? null;

        if (! in_array($result, ['still_waiting', 'accepted', 'declined', 'stop'], true)) {
            throw ValidationException::withMessages([
                'result' => 'Choose what happened.',
            ]);
        }

        $action->complete();

        match ($result) {
            'still_waiting' => $this->scheduleAnother($opportunity, $input),
            'accepted' => $this->accept($opportunity, $input, awardFollowUp: false),
            'declined' => $this->decline($opportunity),
            'stop' => $this->stop($opportunity),
        };
    }

    private function scheduleAnother(Opportunity $opportunity, array $input): void
    {
        $date = PlaybookKit::calendarDate($input, 'follow_up_on', true, 'Choose the next follow-up day.');
        $opportunity->status = OpportunityStatus::Waiting;
        $opportunity->expected_on = $date;
        $opportunity->save();
        $this->addFollowUp($opportunity, $date);
    }

    private function reschedule(Opportunity $opportunity, array $input): void
    {
        if ($opportunity->stage !== 'invoiced') {
            throw ValidationException::withMessages([
                'outcome' => 'Reschedule the payment follow-up from the invoice.',
            ]);
        }

        $date = PlaybookKit::calendarDate($input, 'payment_due_on', true, 'Choose the next day to check on payment.');
        $opportunity->expected_on = $date;
        $opportunity->status = OpportunityStatus::Waiting;
        $opportunity->save();
        $this->rescheduleOpenFollowUp($opportunity, $date);
    }

    private function paid(Opportunity $opportunity, array $input, bool $partial): void
    {
        if (! in_array($opportunity->stage, ['invoiced', 'agreed', 'working'], true)) {
            throw ValidationException::withMessages([
                'outcome' => 'Record payment once the work has been agreed.',
            ]);
        }

        if ($partial && ! in_array($opportunity->stage, ['invoiced', 'agreed', 'working'], true)) {
            throw ValidationException::withMessages([
                'outcome' => 'A deposit fits once the work has been agreed.',
            ]);
        }

        if (! $partial && $opportunity->stage !== 'invoiced') {
            throw ValidationException::withMessages([
                'outcome' => 'Record the full payment once the invoice is out.',
            ]);
        }

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
            PlaybookKit::awardCrossedBonuses($opportunity->fresh(), $before);

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
        $fresh->outcome = 'paid';
        $fresh->stage = 'paid';
        $fresh->save();
    }

    private function writeOff(Opportunity $opportunity): void
    {
        if ($opportunity->stage !== 'invoiced') {
            throw ValidationException::withMessages([
                'outcome' => 'Write off an invoice that is not going to be paid.',
            ]);
        }

        PlaybookKit::close($opportunity, 'written_off');
    }

    private function completeFollowUp(Opportunity $opportunity): void
    {
        $action = PlaybookKit::openAction($opportunity);

        if ($action !== null && $action->playbook_key === 'follow_up') {
            $action->complete();
        }
    }

    private function rescheduleOpenFollowUp(Opportunity $opportunity, string $date): void
    {
        $action = PlaybookKit::openAction($opportunity);

        if ($action !== null && $action->playbook_key === 'follow_up') {
            $action->due_on = $date;
            $action->description = "Follow up on {$date}.";
            $action->save();

            return;
        }

        $this->addFollowUp($opportunity, $date);
    }

    private function addReachOut(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'reach_out', 'Reach out', 'Send a short, specific note.', 20, XpEconomy::MILESTONE);
    }

    private function addSendProposal(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'send_proposal', 'Send a proposal', 'Describe the work and what you will charge.', 45, XpEconomy::MILESTONE);
    }

    private function addFollowUp(Opportunity $opportunity, string $date): void
    {
        PlaybookKit::addAction($opportunity, 'follow_up', 'Follow up with client', "Follow up on {$date}.", 10, XpEconomy::SMALL, $date);
    }

    private function addWork(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'do_the_work', 'Complete the work', 'Finish the agreed piece of work.', null, XpEconomy::MILESTONE);
    }

    private function addInvoice(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'send_invoice', 'Send the invoice', 'Include the amount and when you want to be paid.', 20, XpEconomy::MILESTONE);
    }

    private function addPaymentFollowUp(Opportunity $opportunity, string $date): void
    {
        PlaybookKit::addAction($opportunity, 'follow_up', 'Payment is due — follow up', "Payment is due on {$date}.", 10, XpEconomy::SMALL, $date);
    }

    private function openKey(Opportunity $opportunity): ?string
    {
        return PlaybookKit::openAction($opportunity)?->playbook_key;
    }

    private function headline(Opportunity $opportunity, ?OpportunityAction $action, bool $actionable): string
    {
        if ($opportunity->outcome === 'declined') {
            return 'They declined';
        }

        if ($opportunity->outcome === 'paid') {
            return 'Paid';
        }

        if ($opportunity->stage === 'proposal') {
            return $actionable ? 'Follow up with the client' : 'Waiting to hear back';
        }

        if ($opportunity->stage === 'invoiced') {
            return $actionable ? 'Payment is due' : 'Waiting for payment';
        }

        return $action?->title ?? $this->label($opportunity);
    }

    private function detail(Opportunity $opportunity, ?OpportunityAction $action, bool $actionable): ?string
    {
        if ($action === null || $action->due_on === null || $actionable) {
            return $action?->description;
        }

        $date = $action->due_on->toDateString();

        if ($opportunity->stage === 'invoiced') {
            return "Nothing is required before {$date}. Payment is due that day.";
        }

        return "Follow up on {$date}. Nothing is required before then.";
    }

    private function money(Opportunity $opportunity): array
    {
        $proposed = $opportunity->potential_min_minor;
        $received = $opportunity->realizedMinor();

        $agreed = $opportunity->agreed_amount_minor;
        $stillExpected = $received > 0 ? $opportunity->expected_amount_minor : null;

        return PlaybookKit::moneyLines($opportunity, [
            ['label' => 'Proposed', 'amount_minor' => $proposed],
            ['label' => 'Agreed', 'amount_minor' => $agreed],
            ['label' => 'Received', 'amount_minor' => $received > 0 ? $received : null],
            ['label' => 'Still expected', 'amount_minor' => $stillExpected],
        ]);
    }

    private function actionPayload(Opportunity $opportunity, ?OpportunityAction $action): ?array
    {
        if ($action === null) {
            return null;
        }

        $actionable = PlaybookKit::isActionable($action);
        $payload = PlaybookKit::describeAction($opportunity, $action, $this->detail($opportunity, $action, false) ?? '');
        $payload['completion'] = $this->completion($action);
        $payload['fields'] = $actionable ? $this->actionFields($opportunity, $action) : [];

        return $payload;
    }

    private function completion(OpportunityAction $action): string
    {
        return in_array($action->playbook_key, ['send_proposal', 'send_invoice'], true) ? 'form' : 'simple';
    }

    private function actionFields(Opportunity $opportunity, OpportunityAction $action): array
    {
        return match ($action->playbook_key) {
            'send_proposal' => [
                PlaybookKit::moneyField('proposed_amount_minor', 'What did you quote?', false, $opportunity->potential_min_minor),
                PlaybookKit::dateField('follow_up_on', 'Follow up on', true, PlaybookKit::addDays(7)),
            ],
            'send_invoice' => [
                PlaybookKit::moneyField('invoice_amount_minor', 'Invoice amount', true, $opportunity->expected_amount_minor),
                PlaybookKit::dateField('payment_due_on', 'Payment due on', true, PlaybookKit::addDays(14)),
            ],
            default => [],
        };
    }

    private function outcomes(Opportunity $opportunity, ?OpportunityAction $action, bool $actionable): array
    {
        if ($opportunity->stage === 'proposal') {
            $rows = [
                PlaybookKit::outcome('accepted', 'They accepted', [
                    PlaybookKit::moneyField('agreed_amount_minor', 'What did you agree on?', true, $opportunity->potential_min_minor),
                ]),
                PlaybookKit::outcome('declined', 'They declined', [], 'danger'),
                PlaybookKit::outcome('revise', 'They want changes', [
                    PlaybookKit::moneyField('proposed_amount_minor', 'Updated quote', false, $opportunity->potential_min_minor),
                    PlaybookKit::dateField('follow_up_on', 'Follow up on', true, PlaybookKit::addDays(7)),
                ], 'secondary'),
                PlaybookKit::outcome('stop', 'Stop pursuing', [], 'secondary'),
            ];

            if ($actionable && $action?->playbook_key === 'follow_up') {
                array_unshift($rows, PlaybookKit::outcome('followed_up', 'I followed up', [
                    ['key' => 'result', 'label' => 'What happened?', 'type' => 'choice', 'required' => true, 'prefill_minor' => null, 'default' => null, 'options' => [
                        ['value' => 'still_waiting', 'label' => 'Still waiting'],
                        ['value' => 'accepted', 'label' => 'They accepted'],
                        ['value' => 'declined', 'label' => 'They declined'],
                        ['value' => 'stop', 'label' => 'Stop pursuing'],
                    ]],
                    PlaybookKit::dateField('follow_up_on', 'Follow up again on', false, PlaybookKit::addDays(7)),
                    PlaybookKit::moneyField('agreed_amount_minor', 'What did you agree on?', false, $opportunity->potential_min_minor),
                ]));
            }

            return $rows;
        }

        if (in_array($opportunity->stage, ['idea', 'contact'], true)) {
            return [
                PlaybookKit::outcome('stop', 'Stop pursuing', [], 'secondary'),
            ];
        }

        if (in_array($opportunity->stage, ['agreed', 'working'], true)) {
            return [
                PlaybookKit::outcome('partial', 'Record a deposit', [
                    PlaybookKit::moneyField('amount_minor', 'Amount you received', true),
                    PlaybookKit::moneyField('remaining_minor', 'How much is still agreed?', true, $opportunity->expected_amount_minor),
                ], 'secondary', true),
                PlaybookKit::outcome('stop', 'Stop pursuing', [], 'secondary'),
            ];
        }

        if ($opportunity->stage === 'invoiced') {
            return [
                PlaybookKit::outcome('paid', 'I got paid', [
                    PlaybookKit::moneyField('amount_minor', 'Amount you received', true, $opportunity->expected_amount_minor),
                ], 'primary', true),
                PlaybookKit::outcome('partial', 'I received part of it', [
                    PlaybookKit::moneyField('amount_minor', 'Amount you received', true),
                    PlaybookKit::moneyField('remaining_minor', 'How much is still coming?', true, $opportunity->expected_amount_minor),
                ], 'secondary', true),
                PlaybookKit::outcome('still_waiting', 'Still waiting', [
                    PlaybookKit::dateField('payment_due_on', 'Check again on', true, PlaybookKit::addDays(7)),
                ], 'secondary'),
                PlaybookKit::outcome('written_off', 'Written off', [], 'danger'),
            ];
        }

        return [];
    }

    private function editable(Opportunity $opportunity, ?OpportunityAction $action): array
    {
        if ($opportunity->financialImpacts()->exists()) {
            $fields = [];
        } else {
            $fields = [];

            if ($opportunity->potential_min_minor !== null || $opportunity->stage === 'proposal') {
                $fields[] = PlaybookKit::moneyField('proposed_amount_minor', 'Proposed amount', false, $opportunity->potential_min_minor);
            }

            if ($opportunity->expected_amount_minor !== null || in_array($opportunity->stage, ['agreed', 'working', 'invoiced'], true)) {
                $fields[] = PlaybookKit::moneyField('agreed_amount_minor', 'Agreed amount', false, $opportunity->expected_amount_minor);
            }
        }

        if ($action !== null && $action->playbook_key === 'follow_up') {
            $key = $opportunity->stage === 'invoiced' ? 'payment_due_on' : 'follow_up_on';
            $label = $opportunity->stage === 'invoiced' ? 'Payment due on' : 'Follow up on';
            $fields[] = PlaybookKit::dateField($key, $label, true, $action->due_on?->toDateString());
        }

        return $fields;
    }
}
