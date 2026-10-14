<?php

namespace App\Http\Resources;

use App\Domain\PlaybookRunner;
use App\Enums\ActionStatus;
use App\Models\OpportunityAction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OpportunityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'playbook' => $this->playbook,
            'title' => $this->title,
            'context' => $this->context,
            'notes' => $this->notes,
            'status' => $this->status->value,
            'stage' => $this->stage,
            'outcome' => $this->outcome,
            'stage_label' => app(PlaybookRunner::class)->label($this->resource),
            'potential_min_minor' => $this->potential_min_minor,
            'potential_max_minor' => $this->potential_max_minor,
            'expected_amount_minor' => $this->expected_amount_minor,
            'agreed_amount_minor' => $this->agreed_amount_minor,
            'currency' => $this->currency,
            'expected_on' => $this->expected_on?->toDateString(),
            'effort' => $this->effort?->value,
            'completed_at' => $this->completed_at?->toISOString(),
            'abandoned_at' => $this->abandoned_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'sell_item_id' => $this->resource->sellItemId(),
            'next_action' => $this->nextActionResource(),
        ];
    }

    private function nextActionResource(): ?OpportunityActionResource
    {
        $next = $this->relationLoaded('actions')
            ? $this->actions
                ->filter(fn (OpportunityAction $action) => $action->status === ActionStatus::Open)
                ->sortBy([['sort_order', 'asc'], ['id', 'asc']])
                ->first()
            : $this->resource->nextAction();

        return $next ? new OpportunityActionResource($next) : null;
    }
}
