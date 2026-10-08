<?php

namespace Tests\Feature\Api;

use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Enums\RecurrenceInterval;
use App\Models\Goal;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class HomeProgressTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function home_reports_goal_progress_pipeline_and_a_time_filter(): void
    {
        $user = User::factory()->create();
        Goal::factory()->for($user)->create([
            'amount_minor' => 200000,
            'starts_on' => now()->startOfMonth()->toDateString(),
            'ends_on' => now()->endOfMonth()->toDateString(),
        ]);

        $jacket = Opportunity::factory()->versaceJacket()->for($user)->create();
        OpportunityAction::factory()->for($jacket)->create([
            'title' => 'Research recent resale value',
            'estimated_minutes' => 30,
            'sort_order' => 0,
        ]);
        OpportunityAction::factory()->for($jacket)->create([
            'title' => 'Take photos',
            'estimated_minutes' => 60,
            'sort_order' => 1,
        ]);

        $silver = Opportunity::factory()->silverCollection()->for($user)->create();
        OpportunityAction::factory()->for($silver)->create([
            'title' => 'Value the silver',
            'estimated_minutes' => null,
        ]);

        Opportunity::factory()->friendRepayment()->for($user)->create();

        Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Earn,
            'title' => 'Closed deal',
            'status' => OpportunityStatus::Completed,
            'stage' => 'paid',
            'expected_amount_minor' => 99999,
            'potential_min_minor' => 99999,
            'potential_max_minor' => 99999,
            'completed_at' => now(),
        ]);

        $jacket->recordRealizedImpact(41000);

        Model::preventLazyLoading();

        try {
            $response = $this->actingAs($user)
                ->getJson('/api/v1/home?available_minutes=30')
                ->assertOk();
        } finally {
            Model::preventLazyLoading(false);
        }

        $response->assertJsonPath('data.goal.realized_amount_minor', 41000)
            ->assertJsonPath('data.goal.remaining_amount_minor', 159000)
            ->assertJsonPath('data.goal.progress_percent', 20)
            ->assertJsonPath('data.pipeline.expected_amount_minor', 25000)
            ->assertJsonPath('data.pipeline.potential_min_minor', 40000)
            ->assertJsonPath('data.pipeline.potential_max_minor', 60000)
            ->assertJsonPath('data.pipeline.unknown_potential_count', 2)
            ->assertJsonPath('data.suggested_actions.0.title', 'Research recent resale value')
            ->assertJsonPath('data.actions_without_estimate.0.title', 'Value the silver');

        $titles = collect($response->json('data.suggested_actions'))->pluck('title');
        $this->assertFalse($titles->contains('Take photos'));
        $this->assertFalse($titles->contains('Closed deal'));

        $motion = collect($response->json('data.money_in_motion'))->pluck('title');
        $this->assertTrue($motion->contains('Versace jacket'));
        $this->assertTrue($motion->contains('Friend repayment'));
        $this->assertFalse($motion->contains('Closed deal'));
    }

    #[Test]
    public function progress_breaks_realized_money_down_by_type_for_a_period(): void
    {
        $user = User::factory()->create();
        Goal::factory()->for($user)->create([
            'amount_minor' => 200000,
            'included_types' => [OpportunityType::Sell],
            'starts_on' => now()->startOfMonth()->toDateString(),
            'ends_on' => now()->endOfMonth()->toDateString(),
        ]);

        Opportunity::factory()->versaceJacket()->for($user)->create()->recordRealizedImpact(41000);
        Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Save,
            'stage' => 'confirmed',
        ])->recordRealizedImpact(2000, recurringAmountMinor: 2000, recurrence: RecurrenceInterval::Month);

        $this->actingAs($user)
            ->getJson('/api/v1/progress?period=30d')
            ->assertOk()
            ->assertJsonPath('data.realized_sell_minor', 41000)
            ->assertJsonPath('data.realized_save_minor', 2000)
            ->assertJsonPath('data.realized_amount_minor', 43000)
            ->assertJsonPath('data.goal.realized_amount_minor', 41000);
    }
}
