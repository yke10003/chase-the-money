<?php

namespace Tests\Feature\Domain;

use App\Enums\GoalStatus;
use App\Enums\OpportunityType;
use App\Exceptions\GoalPeriodOverlapException;
use App\Models\Goal;
use App\Models\Opportunity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class GoalTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_stores_the_goal_amount_in_minor_units(): void
    {
        $user = User::factory()->create();

        $goal = Goal::factory()->for($user)->create([
            'amount_minor' => 200000,
            'currency' => 'eur',
        ]);

        $stored = $goal->fresh();

        $this->assertSame(200000, $stored->amount_minor);
        $this->assertIsInt($stored->amount_minor);
        $this->assertSame('EUR', $stored->currency);
    }

    #[Test]
    public function it_rejects_a_goal_that_ends_before_it_starts(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Goal::factory()->create([
            'rhythm' => 'by_date',
            'starts_on' => '2026-10-31',
            'ends_on' => '2026-10-01',
        ]);
    }

    #[Test]
    public function historical_goals_can_coexist_with_the_current_one(): void
    {
        $user = User::factory()->create();

        $current = Goal::factory()->for($user)->create([
            'amount_minor' => 200000,
            'starts_on' => now()->subDay()->toDateString(),
            'ends_on' => now()->addDay()->toDateString(),
            'status' => GoalStatus::Active,
        ]);

        Goal::factory()->for($user)->create([
            'amount_minor' => 50000,
            'rhythm' => 'by_date',
            'starts_on' => '2020-01-01',
            'ends_on' => '2020-01-31',
            'status' => GoalStatus::Active,
        ]);

        Goal::factory()->for($user)->create([
            'amount_minor' => 100000,
            'starts_on' => now()->subDay()->toDateString(),
            'ends_on' => now()->addDay()->toDateString(),
            'status' => GoalStatus::Abandoned,
        ]);

        $this->assertCount(3, $user->goals);
        $this->assertTrue($user->currentGoal()->is($current));
        $this->assertSame(200000, $user->currentGoal()->amount_minor);
    }

    #[Test]
    public function an_active_goal_cannot_overlap_another_active_goal(): void
    {
        $user = User::factory()->create();

        Goal::factory()->for($user)->create([
            'starts_on' => '2026-10-01',
            'ends_on' => '2026-10-31',
        ]);

        $this->expectException(GoalPeriodOverlapException::class);

        Goal::factory()->for($user)->create([
            'starts_on' => '2026-10-15',
            'ends_on' => '2026-11-15',
        ]);
    }

    #[Test]
    public function goal_progress_counts_only_included_types(): void
    {
        $user = User::factory()->create();
        $goal = Goal::factory()->for($user)->create([
            'amount_minor' => 200000,
            'included_types' => [OpportunityType::Earn, OpportunityType::Recover],
            'starts_on' => now()->startOfMonth()->toDateString(),
            'ends_on' => now()->endOfMonth()->toDateString(),
        ]);

        Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Sell,
            'stage' => 'paid',
        ])->recordRealizedImpact(41000);

        Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Earn,
            'stage' => 'paid',
        ])->recordRealizedImpact(25000);

        $progress = $goal->fresh()->progress();

        $this->assertSame(25000, $progress['realized_minor']);
        $this->assertSame(175000, $progress['remaining_minor']);
        $this->assertSame(12, $progress['progress_percent']);
    }
}
