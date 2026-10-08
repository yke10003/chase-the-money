<?php

namespace App\Actions;

use App\Domain\Playbooks\PlaybookKit;
use App\Enums\ActionStatus;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Models\FinancialImpact;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Provisional Home read model.
 *
 * Suggested actions are a sort, not a recommendation: overdue or due soon,
 * then the opportunity that has been untouched the longest, then shorter
 * known effort. Quests are not invented here.
 */
final class BuildHomeDashboard
{
    private const LIMIT = 5;

    /**
     * @return array<string, mixed>
     */
    public function __invoke(User $user, ?int $availableMinutes): array
    {
        $goal = $user->currentGoal();
        $currency = $goal?->currency ?? 'EUR';

        $opportunities = $user->opportunities()
            ->with(['actions' => function ($query): void {
                $query->where('status', ActionStatus::Open)
                    ->orderBy('sort_order')
                    ->orderBy('id');
            }])
            ->get();

        $open = $opportunities
            ->filter(fn (Opportunity $opportunity) => in_array($opportunity->status, OpportunityStatus::open(), true))
            ->filter(fn (Opportunity $opportunity) => ($opportunity->context['sell_setup'] ?? null) !== 'draft')
            ->filter(fn (Opportunity $opportunity) => $opportunity->currency === $currency)
            ->values();

        $week = $user->metricsForPeriod(now()->startOfWeek(), now()->endOfWeek(), $currency);

        return [
            'goal' => $goal,
            'currency' => $currency,
            'pipeline' => $this->pipeline($open),
            'suggested_actions' => $this->suggested($open, $availableMinutes, timed: true),
            'actions_without_estimate' => $availableMinutes === null
                ? []
                : $this->suggested($open, $availableMinutes, timed: false),
            'money_in_motion' => $this->moneyInMotion($open),
            'weekly_momentum' => [
                'starts_on' => now()->startOfWeek()->toDateString(),
                'ends_on' => now()->endOfWeek()->toDateString(),
                'xp' => $week->xp,
                'actions_completed' => $week->actionsCompleted,
                'opportunities_completed' => $week->opportunitiesCompleted,
            ],
            'snapshot' => $this->snapshot($open),
            'recent_wins' => $this->recentWins($user),
        ];
    }

    /**
     * @param  Collection<int, Opportunity>  $open
     * @return array{expected_amount_minor: int, potential_min_minor: int|null, potential_max_minor: int|null, unknown_potential_count: int}
     */
    private function pipeline($open): array
    {
        $expected = 0;
        $min = null;
        $max = null;
        $unknown = 0;

        foreach ($open as $opportunity) {
            if ($opportunity->expected_amount_minor !== null) {
                $expected += $opportunity->expected_amount_minor;
            }

            if ($opportunity->potential_min_minor === null && $opportunity->potential_max_minor === null) {
                $unknown++;

                continue;
            }

            if ($opportunity->potential_min_minor !== null) {
                $min = ($min ?? 0) + $opportunity->potential_min_minor;
            }

            if ($opportunity->potential_max_minor !== null) {
                $max = ($max ?? 0) + $opportunity->potential_max_minor;
            }
        }

        return [
            'expected_amount_minor' => $expected,
            'potential_min_minor' => $min,
            'potential_max_minor' => $max,
            'unknown_potential_count' => $unknown,
        ];
    }

    /**
     * @param  Collection<int, Opportunity>  $open
     * @return list<array{action: OpportunityAction, opportunity: Opportunity, key: array<int, int>}>
     */
    private function suggested($open, ?int $availableMinutes, bool $timed): array
    {
        $chosen = [];

        foreach ($open as $opportunity) {
            if (in_array($opportunity->status, [OpportunityStatus::Completed, OpportunityStatus::Abandoned, OpportunityStatus::Paused], true)) {
                continue;
            }

            $action = $this->pickAction($opportunity, $availableMinutes, $timed);

            if ($action === null) {
                continue;
            }

            $chosen[] = [
                'action' => $action,
                'opportunity' => $opportunity,
                'key' => $this->sortKey($opportunity, $action),
            ];
        }

        usort($chosen, fn (array $left, array $right) => $left['key'] <=> $right['key']);

        return array_slice($chosen, 0, self::LIMIT);
    }

    private function pickAction(Opportunity $opportunity, ?int $availableMinutes, bool $timed): ?OpportunityAction
    {
        $actions = $opportunity->actions
            ->sortBy([['sort_order', 'asc'], ['id', 'asc']])
            ->values();

        $actions = $actions->filter(fn (OpportunityAction $action) => PlaybookKit::isActionable($action))->values();

        if ($availableMinutes === null) {
            return $timed ? $actions->first() : null;
        }

        if ($timed) {
            return $actions->first(function (OpportunityAction $action) use ($availableMinutes) {
                if ($action->playbook_key === 'do_the_work') {
                    return true;
                }

                return $action->estimated_minutes !== null && $action->estimated_minutes <= $availableMinutes;
            });
        }

        $fitting = $actions->first(function (OpportunityAction $action) use ($availableMinutes) {
            return $action->estimated_minutes !== null && $action->estimated_minutes <= $availableMinutes;
        });

        if ($fitting !== null) {
            return null;
        }

        return $actions->first(fn (OpportunityAction $action) => $action->estimated_minutes === null);
    }

    /**
     * @return array<int, int>
     */
    private function sortKey(Opportunity $opportunity, OpportunityAction $action): array
    {
        $today = now()->startOfDay();
        $due = $action->due_on ?? $opportunity->expected_on;
        $bucket = 2;

        if ($due !== null) {
            $dueDate = $due->toDateString();
            $todayDate = $today->toDateString();

            if ($dueDate < $todayDate) {
                $bucket = 0;
            } elseif ($dueDate === $todayDate) {
                $bucket = 1;
            } elseif ($due->lte($today->copy()->addDays(7))) {
                $bucket = 2;
            } else {
                $bucket = 3;
            }
        }

        return [
            $bucket,
            $opportunity->updated_at?->getTimestamp() ?? 0,
            $action->estimated_minutes ?? PHP_INT_MAX,
            $action->sort_order,
            $action->id,
        ];
    }

    /**
     * @param  Collection<int, Opportunity>  $open
     * @return list<Opportunity>
     */
    private function moneyInMotion($open): array
    {
        return $open
            ->filter(function (Opportunity $opportunity) {
                return $opportunity->expected_amount_minor !== null
                    || $opportunity->potential_min_minor !== null
                    || $opportunity->potential_max_minor !== null;
            })
            ->sortByDesc(fn (Opportunity $opportunity) => $opportunity->expected_amount_minor ?? $opportunity->potential_max_minor ?? 0)
            ->take(self::LIMIT)
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, Opportunity>  $open
     * @return list<array<string, mixed>>
     */
    private function snapshot($open): array
    {
        $rows = [];

        foreach (OpportunityType::cases() as $type) {
            $typed = $open->filter(fn (Opportunity $opportunity) => $opportunity->type === $type)->values();
            $pipeline = $this->pipeline($typed);

            $rows[] = [
                'type' => $type->value,
                'open_count' => $typed->count(),
                'expected_amount_minor' => $pipeline['expected_amount_minor'],
                'potential_min_minor' => $pipeline['potential_min_minor'],
                'potential_max_minor' => $pipeline['potential_max_minor'],
                'unknown_potential_count' => $pipeline['unknown_potential_count'],
            ];
        }

        return $rows;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function recentWins(User $user): array
    {
        $impacts = FinancialImpact::query()
            ->where('user_id', $user->id)
            ->latest('occurred_at')
            ->limit(8)
            ->get()
            ->map(fn (FinancialImpact $impact) => [
                'kind' => 'impact',
                'occurred_at' => $impact->occurred_at?->toISOString(),
                'sort_at' => $impact->occurred_at ?? Carbon::create(1970),
                'title' => $impact->opportunity_title,
                'amount_minor' => $impact->amount_minor,
                'currency' => $impact->currency,
                'xp' => null,
            ]);

        $xp = XpEvent::query()
            ->where('user_id', $user->id)
            ->latest('occurred_at')
            ->limit(8)
            ->get()
            ->map(fn (XpEvent $event) => [
                'kind' => 'xp',
                'occurred_at' => $event->occurred_at?->toISOString(),
                'sort_at' => $event->occurred_at ?? Carbon::create(1970),
                'title' => $event->description,
                'amount_minor' => null,
                'currency' => null,
                'xp' => $event->amount,
            ]);

        return $impacts
            ->concat($xp)
            ->sortByDesc('sort_at')
            ->take(8)
            ->map(function (array $win) {
                unset($win['sort_at']);

                return $win;
            })
            ->values()
            ->all();
    }
}
