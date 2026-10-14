<?php

namespace App\Http\Controllers;

use App\Enums\ActionStatus;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Http\Requests\ReopenOpportunityRequest;
use App\Http\Requests\StoreOpportunityRequest;
use App\Http\Requests\UpdateOpportunityRequest;
use App\Http\Resources\OpportunityDetailResource;
use App\Http\Resources\OpportunityResource;
use App\Models\Opportunity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OpportunityController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Opportunity::class);

        $validated = $request->validate([
            'status' => ['sometimes', Rule::enum(OpportunityStatus::class)],
            'type' => ['sometimes', Rule::enum(OpportunityType::class)],
            'needs_action' => ['sometimes', 'boolean'],
            'search' => ['sometimes', 'string', 'max:100'],
            'sort' => ['sometimes', Rule::in(['updated_desc', 'updated_asc', 'potential_desc'])],
        ]);

        $query = $request->user()->opportunities();

        if (isset($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (isset($validated['type'])) {
            $query->where('type', $validated['type']);
        }

        if ($request->boolean('needs_action')) {
            $today = now()->toDateString();
            $query->whereNotIn('status', [
                OpportunityStatus::Completed,
                OpportunityStatus::Abandoned,
                OpportunityStatus::Paused,
            ])->whereHas('actions', function ($actions) use ($today): void {
                $actions->where('status', ActionStatus::Open)
                    ->where(function ($due) use ($today): void {
                        $due->whereNull('due_on')->orWhere('due_on', '<=', $today);
                    });
            });
        }

        if (isset($validated['search'])) {
            $query->where('title', 'like', '%'.$validated['search'].'%');
        }

        $sort = $validated['sort'] ?? 'updated_desc';

        if ($sort === 'updated_asc') {
            $query->orderBy('updated_at')->orderBy('id');
        } elseif ($sort === 'potential_desc') {
            $query->orderByRaw('potential_max_minor is null')
                ->orderByDesc('potential_max_minor')
                ->orderByDesc('id');
        } else {
            $query->orderByDesc('updated_at')->orderByDesc('id');
        }

        $opportunities = $query
            ->with([
                'actions' => function ($actions): void {
                    $actions->where('status', ActionStatus::Open)
                        ->orderBy('sort_order')
                        ->orderBy('id');
                },
                'sellItem',
            ])
            ->paginate(25)
            ->withQueryString();

        return OpportunityResource::collection($opportunities);
    }

    public function store(StoreOpportunityRequest $request): JsonResponse
    {
        $opportunity = $request->user()->opportunities()->create($request->validated());

        return (new OpportunityDetailResource($opportunity))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Opportunity $opportunity): OpportunityDetailResource
    {
        $this->authorize('view', $opportunity);

        $opportunity->load([
            'actions' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'financialImpacts' => fn ($query) => $query->orderByDesc('occurred_at'),
            'xpEvents' => fn ($query) => $query->orderByDesc('occurred_at'),
            'sellItem',
        ]);

        return new OpportunityDetailResource($opportunity);
    }

    public function update(UpdateOpportunityRequest $request, Opportunity $opportunity): OpportunityDetailResource
    {
        $opportunity->fill($request->validated());
        $opportunity->save();

        return new OpportunityDetailResource($opportunity);
    }

    public function destroy(Opportunity $opportunity): Response
    {
        $this->authorize('delete', $opportunity);

        $opportunity->delete();

        return response()->noContent();
    }

    public function complete(Opportunity $opportunity): OpportunityDetailResource
    {
        $this->authorize('update', $opportunity);

        if ($opportunity->playbook !== null) {
            throw ValidationException::withMessages([
                'status' => 'Finish this mission by reporting what happened.',
            ]);
        }

        $opportunity->complete();

        return new OpportunityDetailResource($opportunity);
    }

    public function abandon(Opportunity $opportunity): OpportunityDetailResource
    {
        $this->authorize('update', $opportunity);

        $opportunity->abandon();

        return new OpportunityDetailResource($opportunity);
    }

    public function reopen(ReopenOpportunityRequest $request, Opportunity $opportunity): OpportunityDetailResource
    {
        $status = OpportunityStatus::tryFrom((string) $request->input('status', OpportunityStatus::Active->value))
            ?? OpportunityStatus::Active;

        $opportunity->reopen($status);

        return new OpportunityDetailResource($opportunity);
    }
}
