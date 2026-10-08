<?php

namespace App\Domain;

use App\Enums\OpportunityType;
use InvalidArgumentException;

/**
 * Initial stage vocabulary. Stored as a plain string so the list can change
 * without a migration. This is not a workflow engine and not a final state machine.
 */
final class OpportunityStageCatalog
{
    /**
     * @return list<string>
     */
    public static function stagesFor(OpportunityType $type): array
    {
        return match ($type) {
            OpportunityType::Earn => [
                'idea',
                'contact',
                'proposal',
                'agreed',
                'working',
                'invoiced',
                'paid',
            ],
            OpportunityType::Sell => [
                'idea',
                'valuing',
                'preparing',
                'ready_to_list',
                'listed',
                'offer',
                'sold',
                'paid',
            ],
            OpportunityType::Recover => [
                'identified',
                'requested',
                'expected',
                'overdue',
                'received',
            ],
            OpportunityType::Save => [
                'identified',
                'reviewing',
                'action_taken',
                'confirmed',
            ],
        };
    }

    public static function allows(OpportunityType $type, ?string $stage): bool
    {
        if ($stage === null) {
            return true;
        }

        return in_array($stage, self::stagesFor($type), true);
    }

    public static function assert(OpportunityType $type, ?string $stage): void
    {
        if (! self::allows($type, $stage)) {
            throw new InvalidArgumentException("Stage [{$stage}] is not in the {$type->value} vocabulary.");
        }
    }
}
