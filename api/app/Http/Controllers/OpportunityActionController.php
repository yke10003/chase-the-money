<?php

namespace App\Http\Controllers;

use App\Domain\PlaybookRunner;
use App\Domain\XpEconomy;
use App\Enums\ActionStatus;
use App\Http\Requests\CompleteOpportunityActionRequest;
use App\Http\Requests\StoreOpportunityActionRequest;
use App\Http\Requests\UpdateOpportunityActionRequest;
use App\Http\Resources\OpportunityActionResource;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

class OpportunityActionController extends Controller
{
    public function store(StoreOpportunityActionRequest $request, Opportunity $opportunity): JsonResponse
    {
        if ($opportunity->playbook !== null) {
            throw ValidationException::withMessages([
                'title' => 'This mission adds the next step itself.',
            ]);
        }

        $data = $request->validated();
        $effort = $data['effort'] ?? 'quick';
        unset($data['effort']);

        $action = $opportunity->actions()->create([
            ...$data,
            'status' => ActionStatus::Open,
            'system_owned' => false,
            'xp_reward' => XpEconomy::forEffort($effort),
            'estimated_minutes' => $data['estimated_minutes'] ?? XpEconomy::minutesForEffort($effort),
        ]);

        return (new OpportunityActionResource($action))
            ->response()
            ->setStatusCode(201);
    }

    public function update(
        UpdateOpportunityActionRequest $request,
        Opportunity $opportunity,
        OpportunityAction $action,
    ): OpportunityActionResource {
        if ($action->status === ActionStatus::Completed) {
            abort(422, 'Completed actions are kept as history.');
        }

        if ($action->system_owned) {
            abort(422, 'Standard steps are owned by the mission.');
        }

        $action->fill($request->validated());
        $action->save();

        return new OpportunityActionResource($action);
    }

    public function destroy(Opportunity $opportunity, OpportunityAction $action): Response
    {
        $this->authorize('delete', $action);

        if ($action->status === ActionStatus::Completed) {
            abort(422, 'Completed actions are kept as history.');
        }

        if ($action->system_owned) {
            abort(422, 'Standard steps are owned by the mission.');
        }

        $action->delete();

        return response()->noContent();
    }

    public function complete(
        CompleteOpportunityActionRequest $request,
        PlaybookRunner $playbooks,
        Opportunity $opportunity,
        OpportunityAction $action,
    ): OpportunityActionResource {
        $playbooks->complete($opportunity, $action, $request->validated());

        return new OpportunityActionResource($action->fresh());
    }
}
