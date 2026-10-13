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
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

final class SellPlaybook
{
    public function start(User $user, array $input): Opportunity
    {
        $start = $input['start'] ?? 'need_value';
        $min = PlaybookKit::amount($input, 'worth_min_minor', $start === 'known_value', 'Enter what you think it is worth.');
        $max = PlaybookKit::amount($input, 'worth_max_minor', false, 'Enter the top of the range.');
        $asking = PlaybookKit::amount($input, 'asking_price_minor', $start === 'listed', 'Enter the asking price.');
        $place = $input['listed_on'] ?? null;

        if ($start === 'listed' && (! is_string($place) || trim($place) === '')) {
            throw ValidationException::withMessages([
                'listed_on' => 'Where is it listed?',
            ]);
        }

        if ($max !== null && $min !== null && $max < $min) {
            throw ValidationException::withMessages([
                'worth_max_minor' => 'The top of the range cannot be below the bottom.',
            ]);
        }

        $worthMax = $max ?? $min;

        return DB::transaction(function () use ($user, $input, $start, $min, $worthMax, $asking, $place): Opportunity {
            $opportunity = PlaybookKit::make($user, OpportunityType::Sell->value, 'sell_item', $input['title'], [
                'status' => OpportunityStatus::Active,
                'stage' => match ($start) {
                    'known_value' => 'preparing',
                    'listed' => 'listed',
                    default => 'valuing',
                },
                'potential_min_minor' => $min,
                'potential_max_minor' => $worthMax,
                'notes' => $input['category'] ?? null,
                'context' => array_filter([
                    'category' => $input['category'] ?? null,
                    'asking_price_minor' => $asking,
                    'listed_on' => is_string($place) ? trim($place) : null,
                    'listing_url' => $input['listing_url'] ?? null,
                ], fn ($value) => $value !== null && $value !== ''),
            ]);

            match ($start) {
                'known_value' => $this->addPrepare($opportunity),
                'listed' => null,
                default => $this->addValue($opportunity),
            };

            return $opportunity;
        });
    }

    public function label(Opportunity $opportunity): string
    {
        return match ($opportunity->outcome) {
            'sold' => 'Sold',
            'not_sold' => "It didn't sell",
            'decided_not_to_sell' => 'Decided not to sell',
            default => match ($opportunity->stage) {
                'preparing' => 'Preparing it',
                'ready_to_list' => 'Ready to list',
                'listed' => 'Listed',
                'offer' => 'Offer received',
                'sold' => 'Waiting for payment',
                'paid' => 'Paid',
                default => 'Valuing it',
            },
        };
    }

    public function present(Opportunity $opportunity): array
    {
        $action = PlaybookKit::openAction($opportunity);

        return [
            'stage_label' => $this->label($opportunity),
            'headline' => $action?->title ?? $this->waitingHeadline($opportunity),
            'detail' => $action?->description ?? $this->waitingDetail($opportunity),
            'money' => $this->money($opportunity),
            'action' => $this->actionPayload($opportunity, $action),
            'outcomes' => in_array($opportunity->status, OpportunityStatus::open(), true)
                ? $this->outcomes($opportunity)
                : [],
            'editable' => in_array($opportunity->status, OpportunityStatus::open(), true)
                ? $this->editable($opportunity)
                : [],
        ];
    }

    private function waitingHeadline(Opportunity $opportunity): string
    {
        $place = ($opportunity->context ?? [])['listed_on'] ?? null;

        return match ($opportunity->stage) {
            'listed' => $place ? "Listed on {$place}" : 'Listed',
            'offer' => 'You have an offer',
            default => $this->label($opportunity),
        };
    }

    private function waitingDetail(Opportunity $opportunity): ?string
    {
        return match ($opportunity->stage) {
            'listed' => 'Waiting for a buyer. Report an offer or a sale as soon as it happens.',
            'offer' => 'Accept it, turn it down and keep the listing up, or wait for a better one.',
            default => null,
        };
    }

    public function onComplete(Opportunity $opportunity, OpportunityAction $action, array $input): void
    {
        match ($action->playbook_key) {
            'value_item' => $this->afterValue($opportunity, $input),
            'prepare_item' => $this->afterPrepare($opportunity, $input),
            'list_item' => $this->afterList($opportunity, $input),
            'got_paid' => $this->receive($opportunity, $input),
            default => null,
        };
    }

    public function report(Opportunity $opportunity, string $outcome, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);

        match ($outcome) {
            'offer' => $this->offer($opportunity, $input),
            'reject_offer' => $this->reject($opportunity),
            'accept_offer' => $this->accept($opportunity, $input),
            'sold' => $this->soldDirect($opportunity, $input),
            'change_price' => $this->changePrice($opportunity, $input),
            'not_sold' => PlaybookKit::close($opportunity, 'not_sold'),
            'decided_not_to_sell' => PlaybookKit::close($opportunity, 'decided_not_to_sell'),
            default => throw ValidationException::withMessages([
                'outcome' => 'That outcome does not fit this sale.',
            ]),
        };
    }

    public function updateDetails(Opportunity $opportunity, array $input): void
    {
        PlaybookKit::requireOpen($opportunity);

        if (array_key_exists('worth_min_minor', $input) || array_key_exists('worth_max_minor', $input)) {
            PlaybookKit::guardMoneyEdits($opportunity);
            $min = PlaybookKit::amount($input, 'worth_min_minor', true, 'Enter the low end of the value.');
            $max = PlaybookKit::amount($input, 'worth_max_minor', false, 'Enter the high end of the value.') ?? $min;
            if ($max < $min) {
                throw ValidationException::withMessages([
                    'worth_max_minor' => 'The top of the range cannot be below the bottom.',
                ]);
            }
            $opportunity->potential_min_minor = $min;
            $opportunity->potential_max_minor = $max;
        }

        if (array_key_exists('asking_price_minor', $input) || array_key_exists('listed_on', $input)) {
            $this->changePrice($opportunity, $input);
        }

        $opportunity->save();
    }

    private function afterValue(Opportunity $opportunity, array $input): void
    {
        $min = PlaybookKit::amount($input, 'worth_min_minor', true, 'Enter what you think it could sell for.');
        $max = PlaybookKit::amount($input, 'worth_max_minor', false, 'Enter the top of the range.') ?? $min;
        if ($max < $min) {
            throw ValidationException::withMessages([
                'worth_max_minor' => 'The top of the range cannot be below the bottom.',
            ]);
        }
        $opportunity->potential_min_minor = $min;
        $opportunity->potential_max_minor = $max;
        $opportunity->stage = 'preparing';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
        $this->addPrepare($opportunity);
    }

    private function afterPrepare(Opportunity $opportunity, array $input): void
    {
        $description = trim((string) ($input['listing_description'] ?? ''));
        $item = $opportunity->sellItem;

        if ($item !== null) {
            $item->listing_description = $description === '' ? null : $description;
            $item->save();
        }

        $opportunity->stage = 'ready_to_list';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
        $this->addList($opportunity);

        Log::info('sell.listing.prepared', [
            'opportunity_id' => $opportunity->id,
            'sell_item_id' => $item?->id,
            'bytes' => strlen($description),
        ]);
    }

    private function afterList(Opportunity $opportunity, array $input): void
    {
        $asking = PlaybookKit::amount($input, 'asking_price_minor', true, 'Enter the asking price.');
        $place = trim((string) ($input['listed_on'] ?? ''));
        if ($place === '') {
            throw ValidationException::withMessages([
                'listed_on' => 'Where did you list it?',
            ]);
        }
        $context = $opportunity->context ?? [];
        $context['asking_price_minor'] = $asking;
        $context['listed_on'] = $place;
        $context['listing_url'] = $input['listing_url'] ?? null;
        $opportunity->context = $context;
        $opportunity->stage = 'listed';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
    }

    private function offer(Opportunity $opportunity, array $input): void
    {
        if (! in_array($opportunity->stage, ['listed', 'offer'], true)) {
            throw ValidationException::withMessages([
                'outcome' => 'Record an offer once it is listed.',
            ]);
        }

        $amount = PlaybookKit::amount($input, 'offer_minor', true, 'Enter the offer.');
        $context = $opportunity->context ?? [];
        $context['offer_minor'] = $amount;
        $opportunity->context = $context;
        $opportunity->stage = 'offer';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
    }

    private function reject(Opportunity $opportunity): void
    {
        if ($opportunity->stage !== 'offer') {
            throw ValidationException::withMessages([
                'outcome' => 'There is no offer to reject.',
            ]);
        }

        $context = $opportunity->context ?? [];
        $context['last_rejected_offer_minor'] = $context['offer_minor'] ?? null;
        unset($context['offer_minor']);
        $opportunity->context = $context;
        $opportunity->stage = 'listed';
        $opportunity->save();
    }

    private function accept(Opportunity $opportunity, array $input): void
    {
        if ($opportunity->stage !== 'offer') {
            throw ValidationException::withMessages([
                'outcome' => 'Accept an offer from the offer step.',
            ]);
        }

        $agreed = PlaybookKit::amount($input, 'agreed_amount_minor', true, 'Enter the agreed sale amount.');
        $opportunity->expected_amount_minor = $agreed;
        $opportunity->agreed_amount_minor = $agreed;
        $opportunity->stage = 'sold';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
        $this->addPayment($opportunity);
    }

    private function soldDirect(Opportunity $opportunity, array $input): void
    {
        if ($opportunity->stage !== 'listed') {
            throw ValidationException::withMessages([
                'outcome' => 'Sell it from the listed step, or accept the current offer.',
            ]);
        }

        $agreed = PlaybookKit::amount($input, 'agreed_amount_minor', true, 'Enter the agreed sale amount.');
        $opportunity->expected_amount_minor = $agreed;
        $opportunity->agreed_amount_minor = $agreed;
        $opportunity->stage = 'sold';
        $opportunity->status = OpportunityStatus::Active;
        $opportunity->save();
        $this->addPayment($opportunity);
    }

    private function receive(Opportunity $opportunity, array $input): void
    {
        $amount = PlaybookKit::amount($input, 'amount_minor', true, 'Enter the amount you actually received.');
        $before = $opportunity->realizedMinor();
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
        $fresh->outcome = 'sold';
        $fresh->stage = 'paid';
        $fresh->save();
    }

    private function changePrice(Opportunity $opportunity, array $input): void
    {
        if (! in_array($opportunity->stage, ['listed', 'offer', 'ready_to_list'], true)) {
            throw ValidationException::withMessages([
                'asking_price_minor' => 'Change the asking price once you are ready to list it.',
            ]);
        }

        $asking = PlaybookKit::amount($input, 'asking_price_minor', true, 'Enter the asking price.');
        $context = $opportunity->context ?? [];
        $context['asking_price_minor'] = $asking;
        if (isset($input['listed_on']) && is_string($input['listed_on']) && trim($input['listed_on']) !== '') {
            $context['listed_on'] = trim($input['listed_on']);
        }
        if (array_key_exists('listing_url', $input)) {
            $context['listing_url'] = $input['listing_url'];
        }
        $opportunity->context = $context;
        $opportunity->save();
    }

    private function addValue(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'value_item', 'Figure out what it\'s worth', 'Check recent sold listings for similar items.', 30, XpEconomy::SMALL);
    }

    public function queuePrepare(Opportunity $opportunity): void
    {
        $open = $opportunity->actions()
            ->where('playbook_key', 'prepare_item')
            ->where('status', 'open')
            ->exists();

        if ($open) {
            return;
        }

        $this->addPrepare($opportunity);
    }

    public function queueList(Opportunity $opportunity): void
    {
        $open = $opportunity->actions()
            ->where('playbook_key', 'list_item')
            ->where('status', 'open')
            ->exists();

        if ($open) {
            return;
        }

        $this->addList($opportunity);
    }

    private function addPrepare(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'prepare_item', 'Prepare the listing', 'Write a title, a short description, and where you will list it.', 30, XpEconomy::PREPARATION);
    }

    private function addList(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'list_item', 'Create the listing', 'Choose where to sell it and set an asking price.', 30, XpEconomy::MILESTONE);
    }

    private function addPayment(Opportunity $opportunity): void
    {
        PlaybookKit::addAction($opportunity, 'got_paid', 'Record what you actually received', 'Enter the amount after fees.', 10, XpEconomy::RESULT);
    }

    private function money(Opportunity $opportunity): array
    {
        $context = $opportunity->context ?? [];
        $received = $opportunity->realizedMinor();
        $worth = $opportunity->potential_min_minor;

        return PlaybookKit::moneyLines($opportunity, [
            ['label' => 'Worth', 'amount_minor' => $worth],
            ['label' => 'Asking', 'amount_minor' => isset($context['asking_price_minor']) ? (int) $context['asking_price_minor'] : null],
            ['label' => 'Offer', 'amount_minor' => isset($context['offer_minor']) ? (int) $context['offer_minor'] : null],
            ['label' => 'Agreed', 'amount_minor' => $opportunity->agreed_amount_minor],
            ['label' => 'Still expected', 'amount_minor' => $received > 0 ? $opportunity->expected_amount_minor : null],
            ['label' => 'Received', 'amount_minor' => $received > 0 ? $received : null],
        ]);
    }

    private function actionPayload(Opportunity $opportunity, ?OpportunityAction $action): ?array
    {
        if ($action === null || ! PlaybookKit::isActionable($action)) {
            return $action === null ? null : PlaybookKit::describeAction($opportunity, $action, '');
        }

        $payload = PlaybookKit::describeAction($opportunity, $action, '');
        $payload['completion'] = in_array($action->playbook_key, ['value_item', 'list_item', 'got_paid'], true) ? 'form' : 'simple';
        $payload['fields'] = match ($action->playbook_key) {
            'value_item' => [
                PlaybookKit::moneyField('worth_min_minor', 'Low estimate', true),
                PlaybookKit::moneyField('worth_max_minor', 'High estimate, if it is a range', false),
            ],
            'prepare_item' => [
                PlaybookKit::textField('listing_description', 'Description', false),
            ],
            'list_item' => [
                PlaybookKit::textField('listed_on', 'Where did you list it?', true),
                PlaybookKit::moneyField('asking_price_minor', 'Asking price', true),
                PlaybookKit::textField('listing_url', 'Link, optional', false),
            ],
            'got_paid' => [
                PlaybookKit::moneyField('amount_minor', 'Amount you actually received, after fees', true, $opportunity->expected_amount_minor),
            ],
            default => [],
        };

        return $payload;
    }

    private function outcomes(Opportunity $opportunity): array
    {
        return match ($opportunity->stage) {
            'listed' => [
                PlaybookKit::outcome('offer', 'I received an offer', [
                    PlaybookKit::moneyField('offer_minor', 'Offer amount', true),
                ]),
                PlaybookKit::outcome('sold', 'I sold it', [
                    PlaybookKit::moneyField('agreed_amount_minor', 'Agreed sale amount', true, $this->asking($opportunity)),
                ]),
                PlaybookKit::outcome('change_price', 'Change the asking price', [
                    PlaybookKit::moneyField('asking_price_minor', 'Asking price', true, $this->asking($opportunity)),
                    PlaybookKit::textField('listed_on', 'Where it is listed', false),
                ], 'secondary'),
                PlaybookKit::outcome('not_sold', "It didn't sell", [], 'secondary'),
                PlaybookKit::outcome('decided_not_to_sell', 'I decided not to sell it', [], 'danger'),
            ],
            'offer' => [
                PlaybookKit::outcome('accept_offer', 'Accept the offer', [
                    PlaybookKit::moneyField('agreed_amount_minor', 'Agreed sale amount', true, $this->offerAmount($opportunity)),
                ]),
                PlaybookKit::outcome('reject_offer', 'Reject the offer', [], 'secondary'),
                PlaybookKit::outcome('decided_not_to_sell', 'I decided not to sell it', [], 'danger'),
            ],
            'valuing', 'preparing', 'ready_to_list' => [
                PlaybookKit::outcome('decided_not_to_sell', 'I decided not to sell it', [], 'secondary'),
            ],
            default => [],
        };
    }

    private function editable(Opportunity $opportunity): array
    {
        if ($opportunity->financialImpacts()->exists()) {
            return [];
        }

        $fields = [
            PlaybookKit::moneyField('worth_min_minor', 'Low estimate', false, $opportunity->potential_min_minor),
            PlaybookKit::moneyField('worth_max_minor', 'High estimate', false, $opportunity->potential_max_minor),
        ];

        if (in_array($opportunity->stage, ['listed', 'offer', 'ready_to_list'], true)) {
            $fields[] = PlaybookKit::moneyField('asking_price_minor', 'Asking price', false, $this->asking($opportunity));
            $fields[] = PlaybookKit::textField('listed_on', 'Where it is listed', false);
        }

        return $fields;
    }

    private function asking(Opportunity $opportunity): ?int
    {
        $value = ($opportunity->context ?? [])['asking_price_minor'] ?? null;

        return $value === null ? null : (int) $value;
    }

    private function offerAmount(Opportunity $opportunity): ?int
    {
        $value = ($opportunity->context ?? [])['offer_minor'] ?? null;

        return $value === null ? null : (int) $value;
    }
}
