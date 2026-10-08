<?php

namespace Database\Factories;

use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Models\Opportunity;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Opportunity>
 */
class OpportunityFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'type' => OpportunityType::Earn,
            'title' => 'Freelance lead',
            'notes' => null,
            'status' => OpportunityStatus::Explore,
            'stage' => null,
            'potential_min_minor' => null,
            'potential_max_minor' => null,
            'expected_amount_minor' => null,
            'currency' => 'EUR',
            'expected_on' => null,
            'effort' => null,
            'completed_at' => null,
            'abandoned_at' => null,
        ];
    }

    public function freelanceProposal(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Earn,
            'title' => 'Freelance proposal',
            'notes' => 'Proposal is out or about to go out. The pipeline should not depend on this one lead.',
            'status' => OpportunityStatus::Waiting,
            'stage' => 'proposal',
        ]);
    }

    public function versaceJacket(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Sell,
            'title' => 'Versace jacket',
            'notes' => 'Exact value is unknown. Similar items have sold for more. Would probably accept around €400.',
            'status' => OpportunityStatus::Active,
            'stage' => 'valuing',
            'potential_min_minor' => 40000,
            'potential_max_minor' => 60000,
        ]);
    }

    public function silverCollection(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Sell,
            'title' => 'Silver collection',
            'notes' => 'Some pieces are mixed with other metals. Value depends on weight and purity.',
            'status' => OpportunityStatus::Explore,
            'stage' => 'valuing',
        ]);
    }

    public function halloweenOutfit(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Sell,
            'title' => 'Halloween jacket and gilet',
            'notes' => 'Willing to sell. Roughly €200.',
            'status' => OpportunityStatus::Active,
            'stage' => 'ready_to_list',
            'potential_min_minor' => 20000,
            'potential_max_minor' => 20000,
        ]);
    }

    public function outstandingInvoice(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Recover,
            'title' => 'Outstanding invoice',
            'notes' => 'Expected to be paid. The amount is not recorded yet.',
            'status' => OpportunityStatus::Waiting,
            'stage' => 'expected',
        ]);
    }

    public function friendRepayment(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Recover,
            'title' => 'Friend repayment',
            'notes' => '€250 from an old deal with a friend.',
            'status' => OpportunityStatus::Waiting,
            'stage' => 'expected',
            'expected_amount_minor' => 25000,
        ]);
    }

    public function taxRefund(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Recover,
            'title' => 'Tax refund',
            'notes' => 'Taxes still need to be filed. Any refund amount is unknown until then.',
            'status' => OpportunityStatus::Explore,
            'stage' => 'identified',
        ]);
    }

    public function subscriptionAudit(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => OpportunityType::Save,
            'title' => 'Subscription review',
            'notes' => 'Review current subscriptions and decide which are actually necessary.',
            'status' => OpportunityStatus::Explore,
            'stage' => 'reviewing',
        ]);
    }
}
