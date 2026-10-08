<?php

namespace App\Domain;

use App\Enums\GoalRhythm;
use Carbon\CarbonInterface;
use InvalidArgumentException;

final class GoalPeriod
{
    /**
     * @return array{starts_on: string, ends_on: string}
     */
    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function fillMissingDates(array $data, CarbonInterface $today): array
    {
        if (! isset($data['rhythm'])) {
            return $data;
        }

        $rhythm = $data['rhythm'] instanceof GoalRhythm
            ? $data['rhythm']
            : GoalRhythm::from((string) $data['rhythm']);

        if (! empty($data['starts_on']) && ! empty($data['ends_on'])) {
            return $data;
        }

        if ($rhythm === GoalRhythm::ByDate) {
            return $data;
        }

        $anchor = isset($data['anchor_day']) ? (int) $data['anchor_day'] : 1;

        return [
            ...$data,
            ...self::current($rhythm, $anchor, $today),
            'anchor_day' => $anchor,
        ];
    }

    /**
     * @return array{starts_on: string, ends_on: string}
     */
    public static function current(GoalRhythm $rhythm, ?int $anchorDay, CarbonInterface $today, ?CarbonInterface $byDate = null, ?CarbonInterface $explicitStart = null): array
    {
        return match ($rhythm) {
            GoalRhythm::Weekly => self::weekly($anchorDay ?? 1, $today),
            GoalRhythm::Monthly => self::monthly($anchorDay ?? 1, $today),
            GoalRhythm::ByDate => self::byDate($explicitStart ?? $today, $byDate),
        };
    }

    /**
     * @return array{starts_on: string, ends_on: string}
     */
    public static function monthly(int $anchorDay, CarbonInterface $today): array
    {
        $anchorDay = self::clampDay($anchorDay);
        $start = $today->copy()->startOfDay()->day(min($anchorDay, $today->daysInMonth));

        if ($today->toDateString() < $start->toDateString()) {
            $start = $start->subMonthNoOverflow();
            $start = $start->day(min($anchorDay, $start->daysInMonth));
        }

        $end = $start->copy()->addMonthNoOverflow()->subDay();

        return [
            'starts_on' => $start->toDateString(),
            'ends_on' => $end->toDateString(),
        ];
    }

    /**
     * @return array{starts_on: string, ends_on: string}
     */
    public static function weekly(int $weekday, CarbonInterface $today): array
    {
        if ($weekday < 1 || $weekday > 7) {
            throw new InvalidArgumentException('Week start must be 1 (Monday) through 7 (Sunday).');
        }

        $start = $today->copy()->startOfDay();

        while ((int) $start->isoWeekday() !== $weekday) {
            $start->subDay();
        }

        return [
            'starts_on' => $start->toDateString(),
            'ends_on' => $start->copy()->addDays(6)->toDateString(),
        ];
    }

    /**
     * @return array{starts_on: string, ends_on: string}
     */
    public static function byDate(CarbonInterface $startsOn, ?CarbonInterface $endsOn): array
    {
        if ($endsOn === null) {
            throw new InvalidArgumentException('A dated goal needs an end date.');
        }

        if ($endsOn->toDateString() < $startsOn->toDateString()) {
            throw new InvalidArgumentException('A goal cannot end before it starts.');
        }

        return [
            'starts_on' => $startsOn->toDateString(),
            'ends_on' => $endsOn->toDateString(),
        ];
    }

    private static function clampDay(int $anchorDay): int
    {
        if ($anchorDay < 1 || $anchorDay > 28) {
            throw new InvalidArgumentException('Monthly start day must be between 1 and 28.');
        }

        return $anchorDay;
    }
}
