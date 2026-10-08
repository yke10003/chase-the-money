<?php

namespace App\Http\Controllers;

use App\Domain\DiscoverGuide;
use App\Domain\FirstPlan;
use App\Domain\PlaybookRunner;
use App\Http\Resources\OpportunityDetailResource;
use App\Models\Opportunity;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlaybookController extends Controller
{
    public function plan(Request $request, FirstPlan $plan): JsonResponse
    {
        return response()->json([
            'data' => [
                'missions' => $plan->forUser($request->user()),
            ],
        ]);
    }

    public function discover(Request $request, DiscoverGuide $guide): JsonResponse
    {
        return response()->json([
            'data' => $guide->forUser($request->user()),
        ]);
    }

    public function store(Request $request, PlaybookRunner $playbooks, string $playbook): JsonResponse
    {
        $this->authorize('create', Opportunity::class);

        $opportunity = $playbooks->start(
            $request->user(),
            $playbook,
            $request->validate($this->rules($playbook)),
        );

        return (new OpportunityDetailResource($this->load($opportunity)))
            ->response()
            ->setStatusCode(201);
    }

    public function report(Request $request, PlaybookRunner $playbooks, Opportunity $opportunity): OpportunityDetailResource
    {
        $this->authorize('update', $opportunity);

        $request->validate([
            'outcome' => ['required', 'string', 'max:40'],
        ]);

        $playbooks->report($opportunity, (string) $request->input('outcome'), $request->all());

        return new OpportunityDetailResource($this->load($opportunity->fresh()));
    }

    public function updateDetails(Request $request, PlaybookRunner $playbooks, Opportunity $opportunity): OpportunityDetailResource
    {
        $this->authorize('update', $opportunity);
        $playbooks->updateDetails($opportunity, $request->all());

        return new OpportunityDetailResource($this->load($opportunity->fresh()));
    }

    public function pause(PlaybookRunner $playbooks, Opportunity $opportunity): OpportunityDetailResource
    {
        $this->authorize('update', $opportunity);
        $playbooks->pause($opportunity);

        return new OpportunityDetailResource($this->load($opportunity->fresh()));
    }

    public function resume(PlaybookRunner $playbooks, Opportunity $opportunity): OpportunityDetailResource
    {
        $this->authorize('update', $opportunity);
        $playbooks->resume($opportunity);

        return new OpportunityDetailResource($this->load($opportunity->fresh()));
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(string $playbook): array
    {
        $title = ['title' => ['required', 'string', 'max:255']];

        return match ($playbook) {
            'sell_item' => [
                ...$title,
                'category' => ['nullable', 'string', 'max:80'],
                'start' => ['nullable', Rule::in(['need_value', 'known_value', 'listed'])],
                'worth_min_minor' => ['nullable', 'integer', 'min:1'],
                'worth_max_minor' => ['nullable', 'integer', 'min:1'],
                'asking_price_minor' => ['nullable', 'integer', 'min:1'],
                'listed_on' => ['nullable', 'string', 'max:80'],
                'listing_url' => ['nullable', 'string', 'max:500'],
            ],
            'freelance' => [
                ...$title,
                'current_state' => ['required', Rule::in([
                    'lead',
                    'conversation',
                    'proposal_sent',
                    'accepted',
                    'working',
                    'invoice_sent',
                ])],
                'proposed_amount_minor' => ['nullable', 'integer', 'min:1'],
                'agreed_amount_minor' => ['nullable', 'integer', 'min:1'],
                'invoice_amount_minor' => ['nullable', 'integer', 'min:1'],
                'follow_up_on' => ['nullable', 'date_format:Y-m-d'],
                'payment_due_on' => ['nullable', 'date_format:Y-m-d'],
            ],
            'recover_money' => [
                ...$title,
                'amount_minor' => ['nullable', 'integer', 'min:1'],
                'expected_on' => ['nullable', 'date_format:Y-m-d'],
                'kind' => ['nullable', 'string', 'max:40'],
            ],
            'reduce_expense' => [
                ...$title,
                'current_monthly_minor' => ['nullable', 'integer', 'min:1'],
            ],
            default => $title,
        };
    }

    private function load(Opportunity $opportunity): Opportunity
    {
        return $opportunity->load([
            'actions' => fn ($query) => $query->orderBy('sort_order')->orderBy('id'),
            'financialImpacts' => fn ($query) => $query->orderByDesc('occurred_at'),
            'xpEvents' => fn ($query) => $query->orderByDesc('occurred_at'),
        ]);
    }
}
