<?php

namespace Tests\Feature;

use App\Models\FinancialImpact;
use App\Models\Goal;
use App\Models\Opportunity;
use App\Models\User;
use App\Models\XpEvent;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PlaybookTransitionTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    #[Test]
    public function a_sent_proposal_waits_and_only_becomes_work_after_acceptance(): void
    {
        Carbon::setTestNow('2026-10-06');
        $user = $this->userWithGoal();

        $created = $this->actingAs($user)->postJson('/api/v1/playbooks/freelance', [
            'title' => 'Grab Deal',
            'current_state' => 'proposal_sent',
            'proposed_amount_minor' => 800000,
            'follow_up_on' => '2026-10-11',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'waiting')
            ->assertJsonPath('data.stage', 'proposal')
            ->assertJsonPath('data.stage_label', 'Proposal sent')
            ->assertJsonPath('data.potential_min_minor', 800000)
            ->assertJsonPath('data.expected_amount_minor', null)
            ->assertJsonPath('data.actions.0.playbook_key', 'follow_up')
            ->assertJsonPath('data.playbook_view.headline', 'Waiting to hear back');

        $id = $created->json('data.id');
        $this->assertSame(1, Opportunity::query()->findOrFail($id)->actions()->count());

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertOk()
            ->assertJsonPath('data.suggested_actions', []);

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'followed_up',
            'result' => 'still_waiting',
            'follow_up_on' => '2026-10-20',
        ])->assertStatus(422);

        Carbon::setTestNow('2026-10-11');

        $home = $this->actingAs($user)->getJson('/api/v1/home')->assertOk();
        $this->assertSame('Follow up with client', $home->json('data.suggested_actions.0.title'));
        $this->assertSame('Due today', $home->json('data.suggested_actions.0.why'));

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'followed_up',
            'result' => 'still_waiting',
            'follow_up_on' => '2026-10-18',
        ])->assertOk()
            ->assertJsonPath('data.status', 'waiting')
            ->assertJsonPath('data.actions.1.playbook_key', 'follow_up');

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertJsonPath('data.suggested_actions', []);

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'accepted',
            'agreed_amount_minor' => 750000,
        ])->assertOk()
            ->assertJsonPath('data.stage', 'agreed')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.expected_amount_minor', 750000)
            ->assertJsonPath('data.potential_min_minor', 800000);

        $opportunity = Opportunity::query()->findOrFail($id);
        $this->assertSame('do_the_work', $opportunity->nextAction()->playbook_key);
        $this->assertNull($opportunity->nextAction()->estimated_minutes);
        $this->assertSame(0, $opportunity->actions()->where('status', 'open')->where('playbook_key', 'follow_up')->count());

        $work = $opportunity->nextAction();
        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/actions/{$work->id}/complete")
            ->assertOk();

        $invoice = $opportunity->fresh()->nextAction();
        $this->assertSame('send_invoice', $invoice->playbook_key);

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/actions/{$invoice->id}/complete", [
            'invoice_amount_minor' => 750000,
            'payment_due_on' => '2026-10-20',
        ])->assertOk();

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertJsonPath('data.suggested_actions', []);

        Carbon::setTestNow('2026-10-22');

        $due = $this->actingAs($user)->getJson('/api/v1/home')->assertOk();
        $this->assertSame('Payment is due — follow up', $due->json('data.suggested_actions.0.title'));
        $this->assertSame('Overdue', $due->json('data.suggested_actions.0.why'));

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'partial',
            'amount_minor' => 300000,
            'remaining_minor' => 450000,
        ])->assertOk()
            ->assertJsonPath('data.agreed_amount_minor', 750000)
            ->assertJsonPath('data.expected_amount_minor', 450000);

        $this->assertSame(300000, Opportunity::query()->findOrFail($id)->realizedMinor());

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'paid',
            'amount_minor' => 450000,
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.outcome', 'paid')
            ->assertJsonPath('data.stage_label', 'Paid');

        $finished = Opportunity::query()->findOrFail($id);
        $this->assertSame(750000, $finished->realizedMinor());
        $this->assertSame(0, $finished->actions()->where('status', 'open')->count());
        $this->assertSame(800000, $finished->potential_min_minor);

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'accepted',
            'agreed_amount_minor' => 1,
        ])->assertStatus(422);
    }

    #[Test]
    public function a_declined_proposal_closes_without_money_or_leftover_steps(): void
    {
        $user = $this->userWithGoal();

        $created = $this->actingAs($user)->postJson('/api/v1/playbooks/freelance', [
            'title' => 'Another proposal',
            'current_state' => 'proposal_sent',
            'proposed_amount_minor' => 120000,
            'follow_up_on' => '2026-10-20',
        ])->assertCreated();

        $id = $created->json('data.id');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'declined',
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.outcome', 'declined')
            ->assertJsonPath('data.stage_label', 'They declined');

        $opportunity = Opportunity::query()->findOrFail($id);
        $this->assertSame(0, $opportunity->realizedMinor());
        $this->assertSame(0, $opportunity->actions()->where('status', 'open')->count());
        $this->assertSame(120000, $opportunity->potential_min_minor);
        $this->assertSame(0, FinancialImpact::query()->count());
    }

    #[Test]
    public function ambiguous_dates_are_rejected(): void
    {
        $user = $this->userWithGoal();

        $this->actingAs($user)->postJson('/api/v1/playbooks/freelance', [
            'title' => 'Bad date',
            'current_state' => 'proposal_sent',
            'follow_up_on' => '30-09-2026',
        ])->assertStatus(422);

        $this->actingAs($user)->postJson('/api/v1/playbooks/freelance', [
            'title' => 'Bad date',
            'current_state' => 'proposal_sent',
            'follow_up_on' => '09/30/2026',
        ])->assertStatus(422);
    }

    #[Test]
    public function selling_can_start_listed_reject_an_offer_and_close_without_a_sale(): void
    {
        $user = $this->userWithGoal();

        $unknown = $this->actingAs($user)->postJson('/api/v1/playbooks/sell_item', [
            'title' => 'Silver',
        ])->assertCreated()
            ->assertJsonPath('data.stage', 'valuing')
            ->assertJsonPath('data.actions.0.playbook_key', 'value_item');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$unknown->json('data.id')}/actions/{$unknown->json('data.actions.0.id')}/complete", [
            'worth_min_minor' => 40000,
            'worth_max_minor' => 60000,
        ])->assertOk();

        $ranged = Opportunity::query()->findOrFail($unknown->json('data.id'));
        $this->assertSame(40000, $ranged->potential_min_minor);
        $this->assertSame(60000, $ranged->potential_max_minor);
        $this->assertSame('prepare_item', $ranged->nextAction()->playbook_key);

        $exact = $this->actingAs($user)->postJson('/api/v1/playbooks/sell_item', [
            'title' => 'Halloween',
            'start' => 'known_value',
            'worth_min_minor' => 20000,
        ])->assertCreated()
            ->assertJsonPath('data.stage', 'preparing')
            ->assertJsonPath('data.potential_min_minor', 20000)
            ->assertJsonPath('data.potential_max_minor', 20000)
            ->assertJsonPath('data.actions.0.playbook_key', 'prepare_item');

        $listed = $this->actingAs($user)->postJson('/api/v1/playbooks/sell_item', [
            'title' => 'Versace jacket',
            'start' => 'listed',
            'asking_price_minor' => 50000,
            'listed_on' => 'Marktplaats',
            'listing_url' => 'https://example.test/jacket',
        ])->assertCreated()
            ->assertJsonPath('data.stage', 'listed')
            ->assertJsonPath('data.actions', []);

        $id = $listed->json('data.id');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'offer',
            'offer_minor' => 42000,
        ])->assertOk()->assertJsonPath('data.stage', 'offer');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'reject_offer',
        ])->assertOk()->assertJsonPath('data.stage', 'listed');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'offer',
            'offer_minor' => 45000,
        ])->assertOk();

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'accept_offer',
            'agreed_amount_minor' => 45000,
        ])->assertOk()
            ->assertJsonPath('data.stage', 'sold')
            ->assertJsonPath('data.expected_amount_minor', 45000);

        $paid = Opportunity::query()->findOrFail($id)->nextAction();
        $this->assertSame('got_paid', $paid->playbook_key);

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/actions/{$paid->id}/complete", [
            'amount_minor' => 41000,
        ])->assertOk();

        $sold = Opportunity::query()->findOrFail($id);
        $this->assertSame('completed', $sold->status->value);
        $this->assertSame('sold', $sold->outcome);
        $this->assertSame(41000, $sold->realizedMinor());
        $this->assertSame(0, $sold->actions()->where('status', 'open')->count());

        $stopped = $this->actingAs($user)->postJson('/api/v1/playbooks/sell_item', [
            'title' => 'Old lamp',
            'start' => 'listed',
            'asking_price_minor' => 1500,
            'listed_on' => 'Marktplaats',
        ])->assertCreated();

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$stopped->json('data.id')}/events", [
            'outcome' => 'decided_not_to_sell',
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.outcome', 'decided_not_to_sell')
            ->assertJsonPath('data.stage_label', 'Decided not to sell');

        $this->assertSame(0, Opportunity::query()->findOrFail($stopped->json('data.id'))->realizedMinor());
        $this->assertSame('prepare_item', Opportunity::query()->findOrFail($exact->json('data.id'))->nextAction()->playbook_key);
    }

    #[Test]
    public function recovery_stays_quiet_until_the_date_then_can_move_or_close(): void
    {
        Carbon::setTestNow('2026-10-06');
        $user = $this->userWithGoal();

        $created = $this->actingAs($user)->postJson('/api/v1/playbooks/recover_money', [
            'title' => 'Friend repayment',
            'kind' => 'friend',
            'amount_minor' => 25000,
            'expected_on' => '2026-10-20',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'waiting')
            ->assertJsonPath('data.actions.0.playbook_key', 'follow_up');

        $id = $created->json('data.id');

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertJsonPath('data.suggested_actions', []);

        Carbon::setTestNow('2026-10-20');

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertJsonPath('data.suggested_actions.0.title', 'Follow up');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'new_date',
            'expected_on' => '2026-11-01',
        ])->assertOk()
            ->assertJsonPath('data.status', 'waiting')
            ->assertJsonPath('data.expected_on', '2026-11-01');

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertJsonPath('data.suggested_actions', []);

        Carbon::setTestNow('2026-11-01');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'partial',
            'amount_minor' => 10000,
            'remaining_minor' => 15000,
        ])->assertOk()
            ->assertJsonPath('data.expected_amount_minor', 15000);

        $this->assertSame(10000, Opportunity::query()->findOrFail($id)->realizedMinor());

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'received',
            'amount_minor' => 15000,
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.outcome', 'received');

        $this->assertSame(25000, Opportunity::query()->findOrFail($id)->realizedMinor());
        $this->assertSame(0, Opportunity::query()->findOrFail($id)->actions()->where('status', 'open')->count());

        $silent = $this->actingAs($user)->postJson('/api/v1/playbooks/recover_money', [
            'title' => 'Unknown invoice',
            'amount_minor' => 8000,
        ])->assertCreated()
            ->assertJsonPath('data.actions.0.playbook_key', 'set_follow_up');

        $this->assertNotSame([], $this->actingAs($user)->getJson('/api/v1/home')->json('data.suggested_actions'));

        $written = $this->actingAs($user)->postJson('/api/v1/playbooks/recover_money', [
            'title' => 'Old claim',
            'kind' => 'refund',
            'amount_minor' => 4000,
            'expected_on' => '2026-10-01',
        ])->assertCreated();

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$written->json('data.id')}/events", [
            'outcome' => 'written_off',
        ])->assertOk()
            ->assertJsonPath('data.outcome', 'claim_rejected')
            ->assertJsonPath('data.status', 'completed');

        $this->assertSame(0, Opportunity::query()->findOrFail($written->json('data.id'))->realizedMinor());
        $this->assertSame('set_follow_up', Opportunity::query()->findOrFail($silent->json('data.id'))->nextAction()->playbook_key);
    }

    #[Test]
    public function a_cost_review_can_cancel_reduce_or_keep_the_subscription(): void
    {
        $user = $this->userWithGoal();

        $kept = $this->actingAs($user)->postJson('/api/v1/playbooks/reduce_expense', [
            'title' => 'Spotify',
            'current_monthly_minor' => 1100,
        ])->assertCreated();

        $review = $kept->json('data.actions.0.id');
        $keptId = $kept->json('data.id');
        $this->actingAs($user)->postJson("/api/v1/opportunities/{$keptId}/actions/{$review}/complete")->assertOk();
        $this->actingAs($user)->postJson("/api/v1/opportunities/{$keptId}/events", [
            'outcome' => 'keep',
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.outcome', 'no_change');

        $this->assertSame(0, Opportunity::query()->findOrFail($keptId)->realizedMinor());
        $this->assertSame(0, FinancialImpact::query()->where('opportunity_id', $keptId)->count());

        $cut = $this->actingAs($user)->postJson('/api/v1/playbooks/reduce_expense', [
            'title' => 'Adobe',
            'current_monthly_minor' => 6000,
        ])->assertCreated();
        $cutId = $cut->json('data.id');
        $this->actingAs($user)->postJson("/api/v1/opportunities/{$cutId}/actions/{$cut->json('data.actions.0.id')}/complete")->assertOk();
        $this->actingAs($user)->postJson("/api/v1/opportunities/{$cutId}/events", [
            'outcome' => 'reduce',
            'new_monthly_minor' => 2000,
        ])->assertOk()
            ->assertJsonPath('data.outcome', 'reduced');

        $impact = FinancialImpact::query()->where('opportunity_id', $cutId)->firstOrFail();
        $this->assertSame(4000, $impact->amount_minor);
        $this->assertSame(4000, $impact->recurring_amount_minor);
        $this->assertSame(48000, $impact->annualizedMinor());

        $cancelled = $this->actingAs($user)->postJson('/api/v1/playbooks/reduce_expense', [
            'title' => 'Gym',
            'current_monthly_minor' => 3000,
        ])->assertCreated();
        $cancelId = $cancelled->json('data.id');
        $this->actingAs($user)->postJson("/api/v1/opportunities/{$cancelId}/actions/{$cancelled->json('data.actions.0.id')}/complete")->assertOk();
        $this->actingAs($user)->postJson("/api/v1/opportunities/{$cancelId}/events", [
            'outcome' => 'cancel',
        ])->assertOk()->assertJsonPath('data.outcome', 'cancelled');

        $this->assertSame(3000, FinancialImpact::query()->where('opportunity_id', $cancelId)->value('amount_minor'));
    }

    #[Test]
    public function outcome_bonuses_are_awarded_once_per_cumulative_threshold(): void
    {
        $user = $this->userWithGoal();

        $created = $this->actingAs($user)->postJson('/api/v1/playbooks/freelance', [
            'title' => 'Paid work',
            'current_state' => 'invoice_sent',
            'invoice_amount_minor' => 100000,
            'payment_due_on' => now()->toDateString(),
        ])->assertCreated();

        $id = $created->json('data.id');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'partial',
            'amount_minor' => 30000,
            'remaining_minor' => 70000,
        ])->assertOk();

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'partial',
            'amount_minor' => 30000,
            'remaining_minor' => 40000,
        ])->assertOk();

        $bonuses = XpEvent::query()->where('reason', 'outcome_bonus')->orderBy('id')->get();
        $this->assertSame([10, 20], $bonuses->pluck('amount')->all());

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/events", [
            'outcome' => 'paid',
            'amount_minor' => 40000,
        ])->assertOk();

        $all = XpEvent::query()->where('reason', 'outcome_bonus')->orderBy('id')->pluck('amount')->all();
        $this->assertSame([10, 20, 30], $all);
    }

    #[Test]
    public function pausing_hides_a_mission_until_it_is_resumed(): void
    {
        Carbon::setTestNow('2026-10-06');
        $user = $this->userWithGoal();

        $created = $this->actingAs($user)->postJson('/api/v1/playbooks/freelance', [
            'title' => 'Reach out',
            'current_state' => 'lead',
        ])->assertCreated();

        $id = $created->json('data.id');
        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertJsonPath('data.suggested_actions.0.title', 'Reach out');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/pause")->assertOk()
            ->assertJsonPath('data.status', 'paused');

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertJsonPath('data.suggested_actions', []);

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/resume")->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->actingAs($user)->postJson("/api/v1/opportunities/{$id}/complete")
            ->assertStatus(422);
    }

    private function userWithGoal(): User
    {
        $user = User::factory()->create();
        Goal::factory()->for($user)->create([
            'amount_minor' => 200000,
            'currency' => 'EUR',
            'starts_on' => '2026-10-01',
            'ends_on' => '2026-10-31',
        ]);

        return $user;
    }
}
