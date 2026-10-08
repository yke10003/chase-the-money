<?php

namespace App\Actions;

use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

final class BuildProgressReport
{
    /**
     * @return array<string, mixed>
     */
    public function __invoke(User $user, string $period, ?string $type = null): array
    {
        $goal = $user->currentGoal();
        $currency = $goal?->currency ?? 'EUR';
        $goalPeriod = $goal?->periodOn();
        [$startsOn, $endsOn, $series] = $this->window(
            $period,
            $goalPeriod['starts_on'] ?? null,
            $goalPeriod['ends_on'] ?? null,
        );

        $metrics = $user->metricsForPeriod($startsOn, $endsOn, $currency);

        return [
            'period' => $period,
            'starts_on' => $startsOn->toDateString(),
            'ends_on' => $endsOn->toDateString(),
            'currency' => $currency,
            'realized_amount_minor' => $metrics->realizedMinor,
            'realized_earn_minor' => $metrics->realizedEarnMinor,
            'realized_sell_minor' => $metrics->realizedSellMinor,
            'realized_recover_minor' => $metrics->realizedRecoverMinor,
            'realized_save_minor' => $metrics->realizedSaveMinor,
            'xp' => $metrics->xp,
            'xp_total' => $user->xpTotal(),
            'actions_completed' => $metrics->actionsCompleted,
            'opportunities_completed' => $metrics->opportunitiesCompleted,
            'goal' => $goal,
            'series' => $series === null ? null : $this->series($user, $currency, $startsOn, $endsOn, $series, $type),
        ];
    }

    /**
     * @return array{0: CarbonInterface, 1: CarbonInterface, 2: 'day'|'month'|null}
     */
    private function window(string $period, mixed $goalStart, mixed $goalEnd): array
    {
        $today = now()->startOfDay();

        return match ($period) {
            'goal' => [
                $goalStart ? Carbon::parse($goalStart)->startOfDay() : $today->copy(),
                $goalEnd ? Carbon::parse($goalEnd)->endOfDay() : $today->copy()->endOfDay(),
                'day',
            ],
            '7d' => [$today->copy()->subDays(6), $today->copy()->endOfDay(), 'day'],
            '30d' => [$today->copy()->subDays(29), $today->copy()->endOfDay(), 'day'],
            'year' => [$today->copy()->startOfYear(), $today->copy()->endOfDay(), 'month'],
            'all' => [Carbon::create(1970, 1, 1)->startOfDay(), $today->copy()->endOfDay(), null],
            default => [$today->copy(), $today->copy()->endOfDay(), null],
        };
    }

    /**
     * @return list<array{period: string, amount_minor: int}>
     */
    private function series(User $user, string $currency, CarbonInterface $startsOn, CarbonInterface $endsOn, string $bucket, ?string $type = null): array
    {
        $impacts = $user->financialImpacts()
            ->where('currency', $currency)
            ->when($type !== null, fn ($query) => $query->where('type', $type))
            ->whereBetween('occurred_at', [$startsOn->copy()->startOfDay(), $endsOn->copy()->endOfDay()])
            ->get(['occurred_at', 'amount_minor']);

        $totals = [];

        foreach ($impacts as $impact) {
            $key = $bucket === 'month'
                ? $impact->occurred_at->format('Y-m')
                : $impact->occurred_at->toDateString();
            $totals[$key] = ($totals[$key] ?? 0) + $impact->amount_minor;
        }

        $rows = [];
        $cursor = $bucket === 'month'
            ? $startsOn->copy()->startOfMonth()
            : $startsOn->copy()->startOfDay();
        $end = $endsOn->copy();

        while ($cursor->lte($end)) {
            $key = $bucket === 'month' ? $cursor->format('Y-m') : $cursor->toDateString();
            $rows[] = [
                'period' => $key,
                'amount_minor' => $totals[$key] ?? 0,
            ];
            $cursor = $bucket === 'month' ? $cursor->addMonth() : $cursor->addDay();
        }

        return $rows;
    }
}
