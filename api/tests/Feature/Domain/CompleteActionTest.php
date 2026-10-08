<?php

namespace Tests\Feature\Domain;

use App\Enums\ActionStatus;
use App\Enums\XpReason;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CompleteActionTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function completing_an_action_awards_its_xp_exactly_once(): void
    {
        $user = User::factory()->create();
        $opportunity = Opportunity::factory()->versaceJacket()->for($user)->create();
        $action = OpportunityAction::factory()->for($opportunity)->create([
            'title' => 'Research recent resale value',
            'estimated_minutes' => 30,
            'xp_reward' => 25,
        ]);

        $action->complete();
        $action->complete();

        $stored = $action->fresh();

        $this->assertSame(ActionStatus::Completed, $stored->status);
        $this->assertNotNull($stored->completed_at);
        $this->assertSame(1, XpEvent::query()->count());
        $this->assertSame(25, $user->xpTotal());
        $this->assertSame(XpReason::ActionCompleted, $user->xpEvents()->first()->reason);
        $this->assertTrue(
            OpportunityAction::query()->where('status', ActionStatus::Completed)->whereKey($action->id)->exists()
        );
    }

    #[Test]
    public function an_action_without_an_xp_reward_completes_without_an_event(): void
    {
        $user = User::factory()->create();
        $action = OpportunityAction::factory()
            ->for(Opportunity::factory()->for($user))
            ->create(['xp_reward' => null]);

        $action->complete();

        $this->assertSame(ActionStatus::Completed, $action->fresh()->status);
        $this->assertSame(0, $user->xpTotal());
    }

    #[Test]
    public function xp_total_comes_from_events_and_is_not_a_column_on_users(): void
    {
        $this->assertFalse(Schema::hasColumn('users', 'xp_total'));

        $user = User::factory()->create();
        $opportunity = Opportunity::factory()->for($user)->create();

        OpportunityAction::factory()->for($opportunity)->create(['xp_reward' => 10])->complete();
        OpportunityAction::factory()->for($opportunity)->create(['xp_reward' => 15])->complete();

        $this->assertSame(25, $user->fresh()->xpTotal());
    }

    #[Test]
    public function xp_events_that_are_not_tied_to_an_action_can_coexist(): void
    {
        $user = User::factory()->create();

        XpEvent::factory()->for($user)->create(['amount' => 5, 'opportunity_action_id' => null]);
        XpEvent::factory()->for($user)->create(['amount' => 7, 'opportunity_action_id' => null]);

        $this->assertSame(12, $user->xpTotal());
    }

    #[Test]
    public function an_action_cannot_have_two_xp_events(): void
    {
        $user = User::factory()->create();
        $action = OpportunityAction::factory()
            ->for(Opportunity::factory()->for($user))
            ->create(['xp_reward' => 10]);

        $action->complete();

        $this->expectException(UniqueConstraintViolationException::class);

        XpEvent::factory()->create([
            'user_id' => $user->id,
            'opportunity_action_id' => $action->id,
            'amount' => 10,
        ]);
    }
}
