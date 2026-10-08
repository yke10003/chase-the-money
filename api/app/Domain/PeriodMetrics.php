<?php

namespace App\Domain;

/**
 * Numbers a goal period needs.
 *
 * Realized money, XP, and completion counts are limited to the period.
 * Expected money and potential money are the user's current open pipeline,
 * not a historical reconstruction. They are the same on a lifetime query
 * and on an October query.
 *
 * Potential is not collapsed into one number. Callers get the sum of known
 * minimums, the sum of known maximums, and how many open opportunities have
 * no potential figure at all.
 */
final readonly class PeriodMetrics
{
    public function __construct(
        public string $currency,
        public int $realizedMinor,
        public int $realizedEarnMinor,
        public int $realizedSellMinor,
        public int $realizedRecoverMinor,
        public int $realizedSaveMinor,
        public int $expectedMinor,
        public ?int $potentialMinMinor,
        public ?int $potentialMaxMinor,
        public int $potentialUnknownCount,
        public int $xp,
        public int $actionsCompleted,
        public int $opportunitiesCompleted,
    ) {}
}
