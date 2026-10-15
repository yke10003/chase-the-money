<?php

namespace App\Http\Controllers;

use App\Actions\BuildHomeDashboard;
use App\Domain\FirstPlan;
use App\Http\Resources\GoalResource;
use App\Http\Resources\OpportunityActionResource;
use App\Http\Resources\OpportunityResource;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class HomeController extends Controller
{
    public function show(Request $request, BuildHomeDashboard $dashboard, FirstPlan $plan): JsonResponse
    {
        $minutes = $request->query('available_minutes');

        if ($minutes !== null && filter_var($minutes, FILTER_VALIDATE_INT) === false) {
            throw ValidationException::withMessages([
                'available_minutes' => 'Available minutes must be a positive integer.',
            ]);
        }

        if ($minutes !== null && (int) $minutes < 1) {
            throw ValidationException::withMessages([
                'available_minutes' => 'Available minutes must be a positive integer.',
            ]);
        }

        $view = $dashboard($request->user(), $minutes === null ? null : (int) $minutes);

        return response()->json([
            'data' => [
                'currency' => $view['currency'],
                'goal' => $view['goal'] ? new GoalResource($view['goal']) : null,
                'pipeline' => $view['pipeline'],
                'suggested_actions' => $this->actions($view['suggested_actions']),
                'actions_without_estimate' => $this->actions($view['actions_without_estimate']),
                'money_in_motion' => OpportunityResource::collection($view['money_in_motion']),
                'weekly_momentum' => $view['weekly_momentum'],
                'snapshot' => $view['snapshot'],
                'recent_wins' => $view['recent_wins'],
                'starter_missions' => $plan->forUser($request->user()),
            ],
        ]);
    }

    /**
     * @param  list<array{action: OpportunityAction, opportunity: Opportunity}>  $rows
     * @return list<array<string, mixed>>
     */
    private function actions(array $rows): array
    {
        return array_map(function (array $row) {
            $action = (new OpportunityActionResource($row['action']))->resolve();

            return [
                ...$action,
                'opportunity_title' => $row['opportunity']->title,
                'opportunity_type' => $row['opportunity']->type->value,
                'sell_item_id' => $row['opportunity']->sellItemId(),
                'setup_done' => $row['opportunity']->sellSetupDone(),
                'expected_on' => $row['opportunity']->expected_on?->toDateString(),
                'why' => $this->why($row['opportunity'], $row['action']),
            ];
        }, $rows);
    }

    private function why(Opportunity $opportunity, OpportunityAction $action): ?string
    {
        $today = Carbon::now()->startOfDay();
        $due = $action->due_on ?? $opportunity->expected_on;

        if ($due !== null && $due->toDateString() < $today->toDateString()) {
            return 'Overdue';
        }

        if ($due !== null && $due->toDateString() === $today->toDateString()) {
            return 'Due today';
        }

        if ($due !== null && $due->lte($today->copy()->addDays(7))) {
            return 'Due soon';
        }

        if ($action->playbook_key === 'follow_up') {
            return 'Waiting on you';
        }

        if ($action->estimated_minutes !== null && $action->estimated_minutes <= 20) {
            return 'Quick win';
        }

        return null;
    }
}
