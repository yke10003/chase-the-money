<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FinancialImpactResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'opportunity_id' => $this->opportunity_id,
            'type' => $this->type->value,
            'opportunity_title' => $this->opportunity_title,
            'amount_minor' => $this->amount_minor,
            'currency' => $this->currency,
            'recurring_amount_minor' => $this->recurring_amount_minor,
            'recurrence_interval' => $this->recurrence_interval?->value,
            'annualized_amount_minor' => $this->annualizedMinor(),
            'occurred_at' => $this->occurred_at?->toISOString(),
            'note' => $this->note,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
