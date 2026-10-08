<?php

namespace Tests\Feature\Api;

use App\Enums\ActionStatus;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OpportunityApiTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_user_can_create_filter_and_read_an_opportunity(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/opportunities', [
            'type' => 'sell',
            'title' => 'Versace jacket',
            'stage' => 'valuing',
            'status' => 'active',
            'potential_min_minor' => 40000,
            'potential_max_minor' => 60000,
            'currency' => 'EUR',
        ])->assertCreated()
            ->assertJsonPath('data.title', 'Versace jacket')
            ->assertJsonPath('data.potential_min_minor', 40000);

        $this->actingAs($user)->postJson('/api/v1/opportunities', [
            'type' => 'sell',
            'title' => 'Broken stage',
            'stage' => 'invoiced',
            'currency' => 'EUR',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('stage');

        Opportunity::factory()->friendRepayment()->for($user)->create();

        $this->actingAs($user)->getJson('/api/v1/opportunities?status=waiting')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Friend repayment');

        $jacket = $user->opportunities()->where('title', 'Versace jacket')->firstOrFail();

        $this->actingAs($user)->getJson('/api/v1/opportunities/'.$jacket->id)
            ->assertOk()
            ->assertJsonPath('data.stage', 'valuing');
    }

    #[Test]
    public function lifecycle_commands_keep_history_and_pipeline_metrics_ignore_closed_opportunities(): void
    {
        $user = User::factory()->create();
        $opportunity = Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Recover,
            'stage' => 'expected',
            'status' => OpportunityStatus::Waiting,
            'expected_amount_minor' => 25000,
        ]);
        $action = OpportunityAction::factory()->for($opportunity)->create(['xp_reward' => 10]);

        $this->actingAs($user)
            ->postJson('/api/v1/opportunities/'.$opportunity->id.'/actions/'.$action->id.'/complete')
            ->assertOk();

        $this->actingAs($user)
            ->postJson('/api/v1/opportunities/'.$opportunity->id.'/actions/'.$action->id.'/complete')
            ->assertOk();

        $this->assertSame(1, XpEvent::query()->count());

        $this->actingAs($user)
            ->postJson('/api/v1/opportunities/'.$opportunity->id.'/complete')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertSame(0, $user->metricsForPeriod(now()->startOfMonth(), now()->endOfMonth(), 'EUR')->expectedMinor);

        $this->actingAs($user)
            ->postJson('/api/v1/opportunities/'.$opportunity->id.'/reopen', ['status' => 'active'])
            ->assertOk()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.completed_at', null);

        $this->assertSame(ActionStatus::Completed, $action->fresh()->status);
        $this->assertSame(10, $user->xpTotal());
    }

    #[Test]
    public function full_and_partial_settlement_follow_the_request_and_recurring_savings_stay_informational(): void
    {
        $user = User::factory()->create();
        $invoice = Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Recover,
            'stage' => 'expected',
            'status' => OpportunityStatus::Waiting,
            'expected_amount_minor' => 300000,
            'potential_min_minor' => 300000,
            'potential_max_minor' => 300000,
        ]);

        $this->actingAs($user)->postJson('/api/v1/opportunities/'.$invoice->id.'/impacts', [
            'amount_minor' => 100000,
            'currency' => 'EUR',
            'settlement' => 'partial',
            'remaining_expected_minor' => 200000,
        ])->assertCreated()
            ->assertJsonPath('data.impact.amount_minor', 100000)
            ->assertJsonPath('data.opportunity.expected_amount_minor', 200000)
            ->assertJsonPath('data.opportunity.status', 'waiting')
            ->assertJsonPath('data.opportunity.potential_min_minor', 300000);

        $this->actingAs($user)->postJson('/api/v1/opportunities/'.$invoice->id.'/impacts', [
            'amount_minor' => 200000,
            'currency' => 'EUR',
            'settlement' => 'full',
            'complete' => true,
        ])->assertCreated()
            ->assertJsonPath('data.opportunity.expected_amount_minor', null)
            ->assertJsonPath('data.opportunity.status', 'completed');

        $this->assertSame(300000, $invoice->fresh()->realizedMinor());
        $this->assertSame(0, $user->metricsForPeriod(now()->startOfMonth(), now()->endOfMonth(), 'EUR')->expectedMinor);

        $subscription = Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Save,
            'stage' => 'confirmed',
            'status' => OpportunityStatus::Active,
        ]);

        $this->actingAs($user)->postJson('/api/v1/opportunities/'.$subscription->id.'/impacts', [
            'amount_minor' => 2000,
            'currency' => 'EUR',
            'settlement' => 'none',
            'recurring_amount_minor' => 2000,
            'recurrence_interval' => 'month',
        ])->assertCreated()
            ->assertJsonPath('data.impact.amount_minor', 2000)
            ->assertJsonPath('data.impact.annualized_amount_minor', 24000);

        $this->assertSame(302000, $user->lifetimeMetrics('EUR')->realizedMinor);
    }

    #[Test]
    public function listing_opportunities_does_not_lazy_load_actions(): void
    {
        $user = User::factory()->create();
        Opportunity::factory()->count(3)->for($user)->create()->each(function (Opportunity $opportunity): void {
            OpportunityAction::factory()->for($opportunity)->create();
        });

        DB::flushQueryLog();
        DB::enableQueryLog();

        $this->actingAs($user)->getJson('/api/v1/opportunities')->assertOk();

        $queries = collect(DB::getQueryLog())->pluck('query');
        $actionQueries = $queries->filter(fn (string $sql) => str_contains($sql, 'opportunity_actions') && ! str_contains($sql, 'in ('));

        $this->assertLessThanOrEqual(1, $actionQueries->count());
    }

    #[Test]
    public function another_user_cannot_reach_an_opportunity_or_mix_action_ids(): void
    {
        $owner = User::factory()->create();
        $intruder = User::factory()->create();
        $owned = Opportunity::factory()->for($owner)->create();
        $foreign = Opportunity::factory()->for($intruder)->create();
        $foreignAction = OpportunityAction::factory()->for($foreign)->create();
        $ownedAction = OpportunityAction::factory()->for($owned)->create();

        $this->actingAs($intruder)
            ->getJson('/api/v1/opportunities/'.$owned->id)
            ->assertForbidden();

        $this->actingAs($intruder)
            ->postJson('/api/v1/opportunities/'.$owned->id.'/actions/'.$ownedAction->id.'/complete')
            ->assertForbidden();

        $this->actingAs($owner)
            ->postJson('/api/v1/opportunities/'.$owned->id.'/actions/'.$foreignAction->id.'/complete')
            ->assertNotFound();
    }
}
