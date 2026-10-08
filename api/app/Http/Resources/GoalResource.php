<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GoalResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $progress = $this->progress();
        $period = $this->displayPeriod();

        return [
            'id' => $this->id,
            'amount_minor' => $this->amount_minor,
            'currency' => $this->currency,
            'starts_on' => $period['starts_on'],
            'ends_on' => $period['ends_on'],
            'status' => $this->status->value,
            'rhythm' => $this->rhythm?->value ?? 'monthly',
            'anchor_day' => $this->anchor_day,
            'recurring' => $this->isRecurring(),
            'included_types' => $this->included_types
                ->map(fn ($type) => $type->value)
                ->values()
                ->all(),
            'realized_amount_minor' => $progress['realized_minor'],
            'remaining_amount_minor' => $progress['remaining_minor'],
            'progress_percent' => $progress['progress_percent'],
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
