<?php

namespace App\Domain;

/**
 * First implemented XP economy. These numbers are tunable constants, not a permanent product decision.
 */
final class XpEconomy
{
    public const SMALL = 10;

    public const PREPARATION = 15;

    public const MILESTONE = 25;

    public const RESULT = 25;

    public static function forEffort(string $effort): int
    {
        return match ($effort) {
            'quick' => self::SMALL,
            'medium' => self::PREPARATION,
            'deep' => self::MILESTONE,
            default => self::SMALL,
        };
    }

    public static function minutesForEffort(string $effort): int
    {
        return match ($effort) {
            'quick' => 10,
            'medium' => 30,
            'deep' => 90,
            default => 15,
        };
    }

    public static function outcomeBonus(int $amountMinor): int
    {
        if ($amountMinor >= 100000) {
            return 30;
        }

        if ($amountMinor >= 50000) {
            return 20;
        }

        if ($amountMinor >= 10000) {
            return 10;
        }

        return 0;
    }

    /**
     * XP for thresholds the cumulative total crosses for the first time.
     *
     * €100, €500, and €1,000 are separate awards. A later payment does not repeat one already crossed.
     *
     * @return list<array{amount: int, description: string}>
     */
    public static function newlyCrossedBonuses(int $beforeMinor, int $afterMinor): array
    {
        $awards = [];

        foreach ([10000 => 10, 50000 => 20, 100000 => 30] as $threshold => $xp) {
            if ($beforeMinor < $threshold && $afterMinor >= $threshold) {
                $euros = intdiv($threshold, 100);
                $awards[] = [
                    'amount' => $xp,
                    'description' => "Outcome bonus at €{$euros}",
                ];
            }
        }

        return $awards;
    }
}
