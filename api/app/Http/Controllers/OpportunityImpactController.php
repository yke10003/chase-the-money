<?php

namespace App\Http\Controllers;

use App\Actions\RecordOpportunitySettlement;
use App\Enums\RecurrenceInterval;
use App\Enums\SettlementMode;
use App\Http\Requests\RecordImpactRequest;
use App\Http\Resources\FinancialImpactResource;
use App\Http\Resources\OpportunityDetailResource;
use App\Models\Opportunity;
use Illuminate\Http\JsonResponse;

class OpportunityImpactController extends Controller
{
    public function store(
        RecordImpactRequest $request,
        Opportunity $opportunity,
        RecordOpportunitySettlement $settle,
    ): JsonResponse {
        $recurrence = $request->filled('recurrence_interval')
            ? RecurrenceInterval::from($request->validated('recurrence_interval'))
            : null;

        $impact = $settle(
            opportunity: $opportunity,
            amountMinor: (int) $request->validated('amount_minor'),
            occurredAt: $request->date('occurred_at'),
            note: $request->validated('note'),
            recurringAmountMinor: $request->filled('recurring_amount_minor')
                ? (int) $request->validated('recurring_amount_minor')
                : null,
            recurrence: $recurrence,
            settlement: SettlementMode::from($request->validated('settlement')),
            remainingExpectedMinor: $request->exists('remaining_expected_minor')
                ? ($request->validated('remaining_expected_minor') === null
                    ? null
                    : (int) $request->validated('remaining_expected_minor'))
                : null,
            complete: $request->boolean('complete'),
        );

        $opportunity->refresh()->load([
            'actions' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'financialImpacts' => fn ($query) => $query->orderByDesc('occurred_at'),
            'xpEvents' => fn ($query) => $query->orderByDesc('occurred_at'),
        ]);

        return response()->json([
            'data' => [
                'impact' => new FinancialImpactResource($impact),
                'opportunity' => new OpportunityDetailResource($opportunity),
            ],
        ], 201);
    }
}
