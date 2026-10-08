<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class XpEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'opportunity_id' => $this->opportunity_id,
            'opportunity_action_id' => $this->opportunity_action_id,
            'amount' => $this->amount,
            'reason' => $this->reason->value,
            'description' => $this->description,
            'occurred_at' => $this->occurred_at?->toISOString(),
        ];
    }
}
