<?php

namespace Tests\Feature;

use App\Domain\GoalPeriod;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProductFlowTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_monthly_goal_can_start_before_today_from_a_payday(): void
    {
        $today = Carbon::parse('2026-10-06');
        $period = GoalPeriod::monthly(25, $today);

        $this->assertSame('2026-09-25', $period['starts_on']);
        $this->assertSame('2026-10-24', $period['ends_on']);
        $this->assertTrue($period['starts_on'] < $today->toDateString());

        $next = GoalPeriod::monthly(25, Carbon::parse('2026-10-25'));
        $this->assertSame('2026-10-25', $next['starts_on']);
        $this->assertSame('2026-11-24', $next['ends_on']);
    }

    #[Test]
    public function a_weekly_goal_uses_the_chosen_weekday(): void
    {
        $period = GoalPeriod::weekly(1, Carbon::parse('2026-10-06'));

        $this->assertSame('2026-10-05', $period['starts_on']);
        $this->assertSame('2026-10-11', $period['ends_on']);
    }

    #[Test]
    public function a_dated_goal_can_start_before_today(): void
    {
        $period = GoalPeriod::byDate(Carbon::parse('2026-09-15'), Carbon::parse('2026-12-31'));

        $this->assertSame('2026-09-15', $period['starts_on']);
        $this->assertSame('2026-12-31', $period['ends_on']);
    }

    #[Test]
    public function the_api_computes_a_monthly_period_when_dates_are_omitted(): void
    {
        Carbon::setTestNow('2026-10-06');
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/goals', [
            'amount_minor' => 200000,
            'currency' => 'EUR',
            'rhythm' => 'monthly',
            'anchor_day' => 25,
        ])->assertCreated()
            ->assertJsonPath('data.rhythm', 'monthly')
            ->assertJsonPath('data.anchor_day', 25)
            ->assertJsonPath('data.starts_on', '2026-09-25')
            ->assertJsonPath('data.ends_on', '2026-10-24')
            ->assertJsonPath('data.included_types', ['earn', 'sell', 'recover', 'save']);

        Carbon::setTestNow();
    }

    #[Test]
    public function personalization_and_the_first_plan_are_stored_and_useful(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/v1/profile', [
            'work_categories' => ['software'],
            'experience_level' => 'experienced',
            'availability' => '4_8',
            'starting_capital' => 'none',
            'willing' => ['freelance', 'sell', 'recover', 'reduce_expenses'],
            'excluded' => ['delivery'],
            'situation' => ['owns_sellable', 'money_owed', 'waiting_response', 'subscriptions'],
            'skills' => [
                ['name' => 'Software development', 'proficiency' => 'experienced'],
                ['name' => 'Product development', 'proficiency' => 'experienced'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.work_categories', ['software'])
            ->assertJsonPath('data.skills.0.name', 'Product development');

        $this->actingAs($user)->getJson('/api/v1/plan')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Value one item you could sell'])
            ->assertJsonFragment(['title' => 'Message someone who knows your work'])
            ->assertJsonFragment(['title' => 'Enter the money you are expecting'])
            ->assertJsonFragment(['title' => 'Review one recurring subscription']);

        $this->actingAs($user)->getJson('/api/v1/discover')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Reach out to previous colleagues for freelance work']);
    }

    #[Test]
    public function a_profile_can_span_several_work_areas(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/v1/profile', [
            'work_categories' => ['software', 'design', 'operations'],
            'willing' => ['freelance'],
            'excluded' => ['cold_calling'],
        ])->assertOk()
            ->assertJsonPath('data.work_categories', ['software', 'design', 'operations']);

        $this->actingAs($user)->getJson('/api/v1/discover')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Reach out to previous colleagues for freelance work', 'area' => 'software'])
            ->assertJsonFragment(['title' => 'Offer one design review to someone you have worked with'])
            ->assertJsonFragment(['title' => 'Offer to untangle one messy process'])
            ->assertJsonMissing(['title' => 'Offer a fixed-price technical audit']);

        $this->actingAs($user)->putJson('/api/v1/profile', [
            'work_categories' => ['software', 'astrology'],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['work_categories.1']);
    }

    #[Test]
    public function an_empty_profile_still_gets_starter_missions(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/v1/plan')
            ->assertOk()
            ->assertJsonFragment(['destination' => 'money_hunt'])
            ->assertJsonFragment(['destination' => 'recovery']);
    }

    #[Test]
    public function a_monthly_goal_rolls_into_the_next_period_without_a_new_row(): void
    {
        Carbon::setTestNow('2026-10-06');
        $user = User::factory()->create();

        $created = $this->actingAs($user)->postJson('/api/v1/goals', [
            'amount_minor' => 200000,
            'currency' => 'EUR',
            'rhythm' => 'monthly',
            'anchor_day' => 25,
        ])->assertCreated()
            ->assertJsonPath('data.recurring', true)
            ->assertJsonPath('data.starts_on', '2026-09-25')
            ->assertJsonPath('data.ends_on', '2026-10-24');

        $goalId = $created->json('data.id');
        $opportunity = $user->opportunities()->create([
            'type' => 'sell',
            'title' => 'Jacket',
            'status' => 'active',
            'stage' => 'sold',
            'currency' => 'EUR',
        ]);
        $opportunity->recordRealizedImpact(41000, Carbon::parse('2026-10-06'));

        $this->assertSame(41000, $user->currentGoal()->progress()['realized_minor']);

        Carbon::setTestNow('2026-10-25');

        $this->actingAs($user)->getJson('/api/v1/goals/current')
            ->assertOk()
            ->assertJsonPath('data.id', $goalId)
            ->assertJsonPath('data.starts_on', '2026-10-25')
            ->assertJsonPath('data.ends_on', '2026-11-24')
            ->assertJsonPath('data.realized_amount_minor', 0);

        $this->assertSame(1, $user->goals()->count());
        $this->assertSame(41000, (int) $user->financialImpacts()->sum('amount_minor'));
        $this->assertSame(41000, $user->metricsForPeriod(
            Carbon::parse('2026-09-25'),
            Carbon::parse('2026-10-24'),
            'EUR',
        )->realizedMinor);

        Carbon::setTestNow();
    }

    #[Test]
    public function a_weekly_goal_rolls_forward_from_its_anchor_day(): void
    {
        Carbon::setTestNow('2026-10-06');
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/v1/goals', [
            'amount_minor' => 50000,
            'currency' => 'EUR',
            'rhythm' => 'weekly',
            'anchor_day' => 1,
        ])->assertCreated()
            ->assertJsonPath('data.starts_on', '2026-10-05')
            ->assertJsonPath('data.ends_on', '2026-10-11');

        Carbon::setTestNow('2026-10-12');

        $this->actingAs($user)->getJson('/api/v1/goals/current')
            ->assertOk()
            ->assertJsonPath('data.starts_on', '2026-10-12')
            ->assertJsonPath('data.ends_on', '2026-10-18');

        $this->assertSame(1, $user->goals()->count());

        Carbon::setTestNow();
    }

    #[Test]
    public function a_dated_goal_does_not_roll_past_its_end(): void
    {
        $user = User::factory()->create();
        $user->goals()->create([
            'amount_minor' => 100000,
            'currency' => 'EUR',
            'rhythm' => 'by_date',
            'starts_on' => '2026-10-01',
            'ends_on' => '2026-10-06',
            'status' => 'active',
        ]);

        $this->assertNotNull($user->currentGoal(Carbon::parse('2026-10-06')));
        $this->assertNull($user->currentGoal(Carbon::parse('2026-10-07')));
    }

    #[Test]
    public function choosing_none_of_these_still_returns_a_plan_from_skills_and_willingness(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->putJson('/api/v1/profile', [
            'work_categories' => ['software'],
            'experience_level' => 'experienced',
            'availability' => '4_8',
            'starting_capital' => 'up_to_250',
            'willing' => ['freelance', 'sell', 'build_product'],
            'excluded' => [],
            'situation' => ['none'],
            'skills' => [
                ['name' => 'Software development', 'proficiency' => 'experienced'],
            ],
        ])->assertOk();

        $plan = $this->actingAs($user)->getJson('/api/v1/plan')
            ->assertOk()
            ->assertJsonFragment(['title' => 'Value one item you could sell'])
            ->assertJsonFragment(['title' => 'Message someone who knows your work'])
            ->assertJsonFragment(['title' => 'Explore one small thing you could charge for']);

        $this->assertGreaterThanOrEqual(3, count($plan->json('data.missions')));
        $this->assertSame(0, $user->opportunities()->count());

        $home = $this->actingAs($user)->getJson('/api/v1/home')->assertOk();
        $this->assertGreaterThanOrEqual(3, count($home->json('data.starter_missions')));
        $this->assertSame([], $home->json('data.suggested_actions'));
        $this->assertArrayNotHasKey('heuristic', $home->json('data'));
    }

    private function userWithGoal(): User
    {
        $user = User::factory()->create();
        $user->goals()->create([
            'amount_minor' => 200000,
            'currency' => 'EUR',
            'starts_on' => now()->startOfMonth()->toDateString(),
            'ends_on' => now()->endOfMonth()->toDateString(),
            'status' => 'active',
        ]);

        return $user;
    }
}
