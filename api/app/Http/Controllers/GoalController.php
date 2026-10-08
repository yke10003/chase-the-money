<?php

namespace App\Http\Controllers;

use App\Enums\GoalStatus;
use App\Http\Requests\StoreGoalRequest;
use App\Http\Requests\UpdateGoalRequest;
use App\Http\Resources\GoalResource;
use App\Models\Goal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class GoalController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Goal::class);

        $goals = $request->user()
            ->goals()
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->paginate(25);

        return GoalResource::collection($goals);
    }

    public function current(Request $request): JsonResponse
    {
        $goal = $request->user()->currentGoal();

        return response()->json([
            'data' => $goal ? new GoalResource($goal) : null,
        ]);
    }

    public function store(StoreGoalRequest $request): JsonResponse
    {
        $goal = $request->user()->goals()->create($request->validated());

        return (new GoalResource($goal))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Goal $goal): GoalResource
    {
        $this->authorize('view', $goal);

        return new GoalResource($goal);
    }

    public function update(UpdateGoalRequest $request, Goal $goal): GoalResource
    {
        $goal->fill($request->validated());
        $goal->save();

        return new GoalResource($goal);
    }

    public function complete(Goal $goal): GoalResource
    {
        $this->authorize('update', $goal);

        $goal->status = GoalStatus::Completed;
        $goal->save();

        return new GoalResource($goal);
    }

    public function abandon(Goal $goal): GoalResource
    {
        $this->authorize('update', $goal);

        $goal->status = GoalStatus::Abandoned;
        $goal->save();

        return new GoalResource($goal);
    }
}
