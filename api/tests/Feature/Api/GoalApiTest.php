<?php

namespace Tests\Feature\Api;

use App\Enums\OpportunityType;
use App\Models\Goal;
use App\Models\Opportunity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GoalApiTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_user_can_create_list_and_read_the_current_goal(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/goals', [
            'amount_minor' => 200000,
            'currency' => 'eur',
            'starts_on' => now()->startOfMonth()->toDateString(),
            'ends_on' => now()->endOfMonth()->toDateString(),
            'included_types' => ['earn', 'sell'],
        ])->assertCreated()
            ->assertJsonPath('data.amount_minor', 200000)
            ->assertJsonPath('data.currency', 'EUR')
            ->assertJsonPath('data.included_types', ['earn', 'sell']);

        $this->actingAs($user)->getJson('/api/v1/goals/current')
            ->assertOk()
            ->assertJsonPath('data.amount_minor', 200000);

        $this->actingAs($user)->getJson('/api/v1/goals')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    #[Test]
    public function overlapping_active_goals_are_rejected(): void
    {
        $user = User::factory()->create();
        Goal::factory()->for($user)->create([
            'starts_on' => '2026-10-01',
            'ends_on' => '2026-10-31',
        ]);

        $this->actingAs($user)->postJson('/api/v1/goals', [
            'amount_minor' => 100000,
            'currency' => 'EUR',
            'starts_on' => '2026-10-10',
            'ends_on' => '2026-11-10',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('starts_on');
    }

    #[Test]
    public function goal_progress_ignores_types_the_goal_does_not_include(): void
    {
        $user = User::factory()->create();
        $goal = Goal::factory()->for($user)->create([
            'amount_minor' => 100000,
            'included_types' => [OpportunityType::Earn],
            'starts_on' => now()->startOfMonth()->toDateString(),
            'ends_on' => now()->endOfMonth()->toDateString(),
        ]);

        Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Sell,
            'stage' => 'paid',
        ])->recordRealizedImpact(40000);

        Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Earn,
            'stage' => 'paid',
        ])->recordRealizedImpact(10000);

        $this->actingAs($user)
            ->getJson('/api/v1/goals/'.$goal->id)
            ->assertOk()
            ->assertJsonPath('data.realized_amount_minor', 10000)
            ->assertJsonPath('data.remaining_amount_minor', 90000);
    }

    #[Test]
    public function a_user_cannot_read_another_users_goal(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $goal = Goal::factory()->for($owner)->create();

        $this->actingAs($intruder)
            ->getJson('/api/v1/goals/'.$goal->id)
            ->assertForbidden();

        $this->actingAs($intruder)
            ->patchJson('/api/v1/goals/'.$goal->id, ['amount_minor' => 1])
            ->assertForbidden();
    }
}
