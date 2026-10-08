<?php

namespace Database\Factories;

use App\Enums\ActionStatus;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OpportunityAction>
 */
class OpportunityActionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'opportunity_id' => Opportunity::factory(),
            'title' => 'Take the next step',
            'description' => null,
            'status' => ActionStatus::Open,
            'estimated_minutes' => null,
            'xp_reward' => null,
            'sort_order' => 0,
            'completed_at' => null,
        ];
    }
}
