<?php

namespace Tests\Feature\Domain;

use App\Enums\ActionStatus;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OpportunityTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function potential_value_can_be_unknown(): void
    {
        $opportunity = Opportunity::factory()->silverCollection()->create();

        $stored = $opportunity->fresh();

        $this->assertNull($stored->potential_min_minor);
        $this->assertNull($stored->potential_max_minor);
        $this->assertNull($stored->expected_amount_minor);
    }

    #[Test]
    public function potential_value_can_be_a_range(): void
    {
        $opportunity = Opportunity::factory()->versaceJacket()->create();

        $stored = $opportunity->fresh();

        $this->assertSame(40000, $stored->potential_min_minor);
        $this->assertSame(60000, $stored->potential_max_minor);
        $this->assertNull($stored->expected_amount_minor);
    }

    #[Test]
    public function potential_minimum_cannot_exceed_the_maximum(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Opportunity::factory()->create([
            'type' => OpportunityType::Sell,
            'potential_min_minor' => 60000,
            'potential_max_minor' => 40000,
        ]);
    }

    #[Test]
    public function a_stage_must_belong_to_the_opportunity_type(): void
    {
        $jacket = Opportunity::factory()->versaceJacket()->create();

        $jacket->changeStage('ready_to_list');

        $this->assertSame('ready_to_list', $jacket->fresh()->stage);

        $this->expectException(InvalidArgumentException::class);

        $jacket->changeStage('invoiced');
    }

    #[Test]
    public function the_next_action_is_the_first_open_action(): void
    {
        $opportunity = Opportunity::factory()->create();

        OpportunityAction::factory()->for($opportunity)->create([
            'title' => 'Later',
            'sort_order' => 2,
        ]);
        $next = OpportunityAction::factory()->for($opportunity)->create([
            'title' => 'Research recent resale value',
            'sort_order' => 0,
        ]);
        OpportunityAction::factory()->for($opportunity)->create([
            'title' => 'Already done',
            'sort_order' => 0,
            'status' => ActionStatus::Completed,
            'completed_at' => now(),
        ]);

        $this->assertTrue($opportunity->nextAction()->is($next));
    }

    #[Test]
    public function completing_an_opportunity_keeps_its_history_and_does_not_invent_money_or_xp(): void
    {
        $user = User::factory()->create();
        $opportunity = Opportunity::factory()->for($user)->create();
        $action = OpportunityAction::factory()->for($opportunity)->create();
        $completedAt = now()->subDay()->startOfSecond();

        $opportunity->complete($completedAt);
        $opportunity->complete(now());

        $stored = $opportunity->fresh();

        $this->assertSame(OpportunityStatus::Completed, $stored->status);
        $this->assertTrue($stored->completed_at->equalTo($completedAt));
        $this->assertTrue($stored->actions()->whereKey($action->id)->exists());
        $this->assertSame(0, $stored->financialImpacts()->count());
        $this->assertSame(0, XpEvent::query()->count());
        $this->assertSame(0, $user->xpTotal());
    }

    #[Test]
    public function reopening_clears_the_terminal_timestamp_and_keeps_history(): void
    {
        $user = User::factory()->create();
        $opportunity = Opportunity::factory()->for($user)->create();
        $action = OpportunityAction::factory()->for($opportunity)->create(['xp_reward' => 10]);

        $action->complete();
        $opportunity->recordRealizedImpact(41000);
        $opportunity->complete();

        $opportunity->reopen(OpportunityStatus::Active);

        $stored = $opportunity->fresh();

        $this->assertSame(OpportunityStatus::Active, $stored->status);
        $this->assertNull($stored->completed_at);
        $this->assertNull($stored->abandoned_at);
        $this->assertSame(1, $stored->actions()->count());
        $this->assertSame(41000, $stored->realizedMinor());
        $this->assertSame(10, $user->xpTotal());
        $this->assertSame(ActionStatus::Completed, $action->fresh()->status);
    }

    #[Test]
    public function abandoning_an_opportunity_does_not_delete_it(): void
    {
        $opportunity = Opportunity::factory()->create();

        $opportunity->abandon();

        $stored = $opportunity->fresh();

        $this->assertSame(OpportunityStatus::Abandoned, $stored->status);
        $this->assertNotNull($stored->abandoned_at);
        $this->assertNull($stored->completed_at);
    }
}
