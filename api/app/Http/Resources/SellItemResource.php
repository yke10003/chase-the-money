<?php

namespace App\Http\Resources;

use App\Domain\Playbooks\SellPlaybook;
use App\Domain\Sell\SellCatalog;
use App\Domain\Sell\SellItemFlow;
use App\Models\SellItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin SellItem */
class SellItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $photos = $this->photos;
        $taken = $photos->pluck('shot_key')->filter()->all();
        $plan = array_map(function (array $shot) use ($taken) {
            $shot['taken'] = in_array($shot['key'], $taken, true);

            return $shot;
        }, SellCatalog::plan($this->category, $this->subcategory));
        $playbook = $this->setupDone()
            ? app(SellPlaybook::class)->present($this->opportunity)
            : null;

        return [
            'id' => $this->id,
            'opportunity_id' => $this->opportunity_id,
            'name' => $this->name,
            'category' => $this->category,
            'category_label' => $this->categoryLabel(),
            'subcategory' => $this->subcategory,
            'subcategory_label' => $this->subcategoryLabel(),
            'brand' => $this->brand,
            'condition' => $this->condition,
            'condition_label' => $this->conditionLabel(),
            'details' => $this->details ?? [],
            'value_min_minor' => $this->value_min_minor,
            'value_max_minor' => $this->value_max_minor,
            'value_confidence' => $this->value_confidence,
            'currency' => $this->currency,
            'setup_step' => $this->setup_step,
            'setup_done' => $this->setupDone(),
            'origin' => $this->origin,
            'next_step_label' => $this->nextStepLabel(),
            'xp_earned' => (int) $this->opportunity->xpEvents->sum('amount'),
            'research_prompt' => app(SellItemFlow::class)->researchPrompt($this->resource),
            'cover_url' => $this->cover()?->url(),
            'stage' => $this->opportunity->stage,
            'stage_label' => $playbook['stage_label'] ?? $this->nextStepLabel(),
            'photos' => $photos->map(fn ($photo) => [
                'id' => $photo->id,
                'url' => $photo->url(),
                'shot_key' => $photo->shot_key,
                'sort_order' => $photo->sort_order,
                'is_cover' => $photo->is_cover,
            ])->values(),
            'comparables' => $this->comparables->map(fn ($comparable) => [
                'id' => $comparable->id,
                'url' => $comparable->url,
                'platform' => $comparable->platform,
                'amount_minor' => $comparable->amount_minor,
                'state' => $comparable->state,
                'note' => $comparable->note,
            ])->values(),
            'photo_plan' => $plan,
            'next' => $playbook['action'] ?? null,
            'asking_price_minor' => ($this->opportunity->context ?? [])['asking_price_minor'] ?? null,
            'listed_on' => ($this->opportunity->context ?? [])['listed_on'] ?? null,
        ];
    }
}
