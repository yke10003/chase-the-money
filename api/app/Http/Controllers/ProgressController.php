<?php

namespace App\Http\Controllers;

use App\Actions\BuildProgressReport;
use App\Enums\OpportunityType;
use App\Http\Resources\GoalResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ProgressController extends Controller
{
    public function show(Request $request, BuildProgressReport $report): JsonResponse
    {
        $period = (string) $request->query('period', '30d');

        if (! in_array($period, ['goal', '7d', '30d', 'year', 'all'], true)) {
            throw ValidationException::withMessages([
                'period' => 'Period must be goal, 7d, 30d, year, or all.',
            ]);
        }

        $type = $request->query('type');
        $type = is_string($type) && $type !== '' ? $type : null;

        if ($type !== null && OpportunityType::tryFrom($type) === null) {
            throw ValidationException::withMessages([
                'type' => 'Type must be earn, sell, recover, or save.',
            ]);
        }

        if ($type !== null) {
            Log::info('progress.series.filtered', ['user_id' => $request->user()->id, 'period' => $period, 'type' => $type]);
        }

        $view = $report($request->user(), $period, $type);

        return response()->json([
            'data' => [
                'period' => $view['period'],
                'starts_on' => $view['starts_on'],
                'ends_on' => $view['ends_on'],
                'currency' => $view['currency'],
                'realized_amount_minor' => $view['realized_amount_minor'],
                'realized_earn_minor' => $view['realized_earn_minor'],
                'realized_sell_minor' => $view['realized_sell_minor'],
                'realized_recover_minor' => $view['realized_recover_minor'],
                'realized_save_minor' => $view['realized_save_minor'],
                'xp' => $view['xp'],
                'xp_total' => $view['xp_total'],
                'actions_completed' => $view['actions_completed'],
                'opportunities_completed' => $view['opportunities_completed'],
                'goal' => $view['goal'] ? new GoalResource($view['goal']) : null,
                'series' => $view['series'],
            ],
        ]);
    }
}
