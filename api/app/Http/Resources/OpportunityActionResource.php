<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OpportunityActionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'opportunity_id' => $this->opportunity_id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status->value,
            'estimated_minutes' => $this->estimated_minutes,
            'xp_reward' => $this->xp_reward,
            'sort_order' => $this->sort_order,
            'system_owned' => (bool) $this->system_owned,
            'playbook_key' => $this->playbook_key,
            'due_on' => $this->due_on?->toDateString(),
            'completed_at' => $this->completed_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
