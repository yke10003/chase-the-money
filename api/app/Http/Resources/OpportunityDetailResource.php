<?php

namespace App\Http\Resources;

use App\Domain\PlaybookRunner;
use Illuminate\Http\Request;

class OpportunityDetailResource extends OpportunityResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'playbook_view' => $this->playbook ? app(PlaybookRunner::class)->present($this->resource) : null,
            'actions' => OpportunityActionResource::collection($this->whenLoaded('actions')),
            'impacts' => FinancialImpactResource::collection($this->whenLoaded('financialImpacts')),
            'xp_events' => XpEventResource::collection($this->whenLoaded('xpEvents')),
        ];
    }
}
