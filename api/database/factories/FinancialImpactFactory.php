<?php

namespace Database\Factories;

use App\Enums\OpportunityType;
use App\Models\FinancialImpact;
use App\Models\Opportunity;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FinancialImpact>
 */
class FinancialImpactFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'opportunity_id' => null,
            'type' => OpportunityType::Earn,
            'opportunity_title' => null,
            'amount_minor' => 10000,
            'currency' => 'EUR',
            'recurring_amount_minor' => null,
            'recurrence_interval' => null,
            'occurred_at' => now(),
            'note' => null,
        ];
    }

    public function forOpportunity(Opportunity $opportunity): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => $opportunity->user_id,
            'opportunity_id' => $opportunity->id,
            'type' => $opportunity->type,
            'currency' => $opportunity->currency,
            'opportunity_title' => $opportunity->title,
        ]);
    }
}
