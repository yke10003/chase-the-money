<?php

namespace Tests\Feature\Domain;

use App\Actions\RecordOpportunitySettlement;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Enums\RecurrenceInterval;
use App\Enums\SettlementMode;
use App\Models\FinancialImpact;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FinancialImpactTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function realized_impact_is_separate_from_expected_and_potential(): void
    {
        $user = User::factory()->create();
        $jacket = Opportunity::factory()->versaceJacket()->for($user)->create();
        $repayment = Opportunity::factory()->friendRepayment()->for($user)->create();

        $jacket->recordRealizedImpact(41000, note: '€425 sale, €15 fees. Net amount that counts.');

        $metrics = $user->metricsForPeriod(now()->startOfMonth(), now()->endOfMonth(), 'EUR');

        $this->assertSame(41000, $jacket->fresh()->realizedMinor());
        $this->assertSame(40000, $jacket->potential_min_minor);
        $this->assertSame(25000, $repayment->expected_amount_minor);
        $this->assertSame(41000, $metrics->realizedMinor);
        $this->assertSame(41000, $metrics->realizedSellMinor);
        $this->assertSame(0, $metrics->realizedEarnMinor);
        $this->assertSame(25000, $metrics->expectedMinor);
        $this->assertSame(60000, $metrics->potentialMaxMinor);
    }

    #[Test]
    public function realized_totals_group_by_opportunity_type(): void
    {
        $user = User::factory()->create();
        $earn = Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Earn,
            'stage' => 'paid',
            'status' => OpportunityStatus::Completed,
        ]);
        $recover = Opportunity::factory()->friendRepayment()->for($user)->create();

        $earn->recordRealizedImpact(100000);
        $recover->recordRealizedImpact(25000);

        $metrics = $user->metricsForPeriod(now()->startOfMonth(), now()->endOfMonth(), 'EUR');

        $this->assertSame(100000, $metrics->realizedEarnMinor);
        $this->assertSame(25000, $metrics->realizedRecoverMinor);
        $this->assertSame(125000, $metrics->realizedMinor);
    }

    #[Test]
    public function annualized_savings_are_not_counted_as_current_realized_money(): void
    {
        $user = User::factory()->create();
        $subscription = Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Save,
            'title' => 'Streaming subscription',
            'stage' => 'confirmed',
            'status' => OpportunityStatus::Completed,
        ]);

        $impact = $subscription->recordRealizedImpact(
            amountMinor: 2000,
            note: 'Cancelled subscription',
            recurringAmountMinor: 2000,
            recurrence: RecurrenceInterval::Month,
        );

        $metrics = $user->metricsForPeriod(now()->startOfMonth(), now()->endOfMonth(), 'EUR');

        $this->assertSame(24000, $impact->annualizedMinor());
        $this->assertSame(2000, $metrics->realizedSaveMinor);
        $this->assertSame(2000, $metrics->realizedMinor);
    }

    #[Test]
    public function recurring_amounts_are_rejected_on_non_save_impact(): void
    {
        $earn = Opportunity::factory()->create(['type' => OpportunityType::Earn, 'stage' => 'paid']);

        $this->expectException(InvalidArgumentException::class);

        $earn->recordRealizedImpact(
            amountMinor: 10000,
            recurringAmountMinor: 10000,
            recurrence: RecurrenceInterval::Month,
        );
    }

    #[Test]
    public function a_completed_opportunity_keeps_its_impact_and_actions(): void
    {
        $user = User::factory()->create();
        $jacket = Opportunity::factory()->versaceJacket()->for($user)->create();
        $action = OpportunityAction::factory()->for($jacket)->create();

        $jacket->recordRealizedImpact(41000);
        $action->complete();
        $jacket->complete();

        $stored = $jacket->fresh();

        $this->assertSame(OpportunityStatus::Completed, $stored->status);
        $this->assertSame(41000, $stored->realizedMinor());
        $this->assertSame(1, $stored->actions()->count());
        $this->assertSame(41000, $user->lifetimeMetrics('EUR')->realizedSellMinor);
    }

    #[Test]
    public function deleting_an_opportunity_keeps_the_money_ledger(): void
    {
        $user = User::factory()->create();
        $subscription = Opportunity::factory()->subscriptionAudit()->for($user)->create();
        $impact = $subscription->recordRealizedImpact(2000, note: 'Cancelled one subscription');

        $subscription->delete();

        $stored = FinancialImpact::query()->find($impact->id);

        $this->assertNotNull($stored);
        $this->assertNull($stored->opportunity_id);
        $this->assertSame(OpportunityType::Save, $stored->type);
        $this->assertSame('Subscription review', $stored->opportunity_title);
        $this->assertSame(2000, $stored->amount_minor);
        $this->assertSame(2000, $user->lifetimeMetrics('EUR')->realizedSaveMinor);
    }

    #[Test]
    public function full_settlement_clears_expected_and_can_complete_without_erasing_potential(): void
    {
        $opportunity = Opportunity::factory()->create([
            'type' => OpportunityType::Recover,
            'stage' => 'expected',
            'status' => OpportunityStatus::Waiting,
            'expected_amount_minor' => 300000,
            'potential_min_minor' => 300000,
            'potential_max_minor' => 300000,
        ]);

        app(RecordOpportunitySettlement::class)(
            opportunity: $opportunity,
            amountMinor: 300000,
            occurredAt: now(),
            note: 'Paid in full',
            recurringAmountMinor: null,
            recurrence: null,
            settlement: SettlementMode::Full,
            remainingExpectedMinor: null,
            complete: true,
        );

        $stored = $opportunity->fresh();

        $this->assertSame(300000, $stored->realizedMinor());
        $this->assertNull($stored->expected_amount_minor);
        $this->assertSame(300000, $stored->potential_min_minor);
        $this->assertSame(OpportunityStatus::Completed, $stored->status);
        $this->assertSame(0, $stored->user->metricsForPeriod(now()->startOfMonth(), now()->endOfMonth(), 'EUR')->expectedMinor);
    }

    #[Test]
    public function partial_settlement_keeps_the_explicit_remainder_and_leaves_the_opportunity_open(): void
    {
        $opportunity = Opportunity::factory()->create([
            'type' => OpportunityType::Recover,
            'stage' => 'expected',
            'status' => OpportunityStatus::Waiting,
            'expected_amount_minor' => 300000,
        ]);

        app(RecordOpportunitySettlement::class)(
            opportunity: $opportunity,
            amountMinor: 100000,
            occurredAt: now(),
            note: null,
            recurringAmountMinor: null,
            recurrence: null,
            settlement: SettlementMode::Partial,
            remainingExpectedMinor: 200000,
            complete: false,
        );

        $stored = $opportunity->fresh();

        $this->assertSame(100000, $stored->realizedMinor());
        $this->assertSame(200000, $stored->expected_amount_minor);
        $this->assertSame(OpportunityStatus::Waiting, $stored->status);
    }

    #[Test]
    public function recording_impact_without_settlement_does_not_change_expected(): void
    {
        $opportunity = Opportunity::factory()->friendRepayment()->create();

        $opportunity->recordRealizedImpact(10000);

        $this->assertSame(25000, $opportunity->fresh()->expected_amount_minor);
        $this->assertSame(10000, $opportunity->realizedMinor());
    }
}
