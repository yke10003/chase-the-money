<?php

namespace App\Actions;

use App\Enums\RecurrenceInterval;
use App\Enums\SettlementMode;
use App\Models\FinancialImpact;
use App\Models\Opportunity;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

/**
 * Records a ledger row, then applies an explicit settlement choice.
 *
 * recordRealizedImpact() itself never changes expected, potential, or status.
 */
final class RecordOpportunitySettlement
{
    public function __invoke(
        Opportunity $opportunity,
        int $amountMinor,
        ?CarbonInterface $occurredAt,
        ?string $note,
        ?int $recurringAmountMinor,
        ?RecurrenceInterval $recurrence,
        SettlementMode $settlement,
        ?int $remainingExpectedMinor,
        bool $complete,
    ): FinancialImpact {
        if ($settlement === SettlementMode::Partial && $complete) {
            throw new InvalidArgumentException('A partial settlement cannot complete the opportunity.');
        }

        if ($settlement === SettlementMode::None && $complete) {
            throw new InvalidArgumentException('Recording impact without settlement cannot complete the opportunity.');
        }

        if ($settlement === SettlementMode::Partial && $remainingExpectedMinor === null) {
            throw new InvalidArgumentException('A partial settlement needs an explicit remaining expected amount.');
        }

        return DB::transaction(function () use (
            $opportunity,
            $amountMinor,
            $occurredAt,
            $note,
            $recurringAmountMinor,
            $recurrence,
            $settlement,
            $remainingExpectedMinor,
            $complete,
        ): FinancialImpact {
            $impact = $opportunity->recordRealizedImpact(
                amountMinor: $amountMinor,
                occurredAt: $occurredAt,
                note: $note,
                recurringAmountMinor: $recurringAmountMinor,
                recurrence: $recurrence,
            );

            if ($settlement === SettlementMode::Full) {
                $opportunity->expected_amount_minor = null;
                $opportunity->save();

                if ($complete) {
                    $opportunity->complete($occurredAt);
                }
            }

            if ($settlement === SettlementMode::Partial) {
                $opportunity->expected_amount_minor = $remainingExpectedMinor === 0
                    ? null
                    : $remainingExpectedMinor;
                $opportunity->save();
            }

            Log::info('Settled opportunity impact', [
                'user_id' => $opportunity->user_id,
                'opportunity_id' => $opportunity->id,
                'impact_id' => $impact->id,
                'amount_minor' => $amountMinor,
                'settlement' => $settlement->value,
                'complete' => $complete,
            ]);

            return $impact;
        });
    }
}
