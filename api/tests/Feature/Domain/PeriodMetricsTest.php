<?php

namespace Tests\Feature\Domain;

use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PeriodMetricsTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function period_metrics_ignore_other_months_and_closed_pipeline_money(): void
    {
        $user = User::factory()->create();
        $october = now()->setDate(2026, 10, 15)->startOfSecond();

        $openPotential = Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Sell,
            'title' => 'Versace jacket',
            'status' => OpportunityStatus::Active,
            'stage' => 'valuing',
            'potential_min_minor' => 40000,
            'potential_max_minor' => 60000,
        ]);
        $unknown = Opportunity::factory()->silverCollection()->for($user)->create();
        $expected = Opportunity::factory()->friendRepayment()->for($user)->create();
        $closed = Opportunity::factory()->for($user)->create([
            'type' => OpportunityType::Earn,
            'status' => OpportunityStatus::Completed,
            'stage' => 'paid',
            'expected_amount_minor' => 99999,
            'potential_min_minor' => 99999,
            'potential_max_minor' => 99999,
            'completed_at' => $october,
        ]);

        $openPotential->recordRealizedImpact(41000, $october);
        $closed->recordRealizedImpact(5000, now()->setDate(2026, 9, 1));

        OpportunityAction::factory()->for($openPotential)->create([
            'xp_reward' => 25,
        ])->complete($october);

        OpportunityAction::factory()->for($unknown)->create([
            'xp_reward' => 100,
        ])->complete(now()->setDate(2026, 11, 2));

        $metrics = $user->metricsForPeriod(
            now()->setDate(2026, 10, 1),
            now()->setDate(2026, 10, 31),
            'EUR',
        );

        $this->assertSame(41000, $metrics->realizedMinor);
        $this->assertSame(41000, $metrics->realizedSellMinor);
        $this->assertSame(0, $metrics->realizedEarnMinor);
        $this->assertSame(25000, $metrics->expectedMinor);
        $this->assertSame(40000, $metrics->potentialMinMinor);
        $this->assertSame(60000, $metrics->potentialMaxMinor);
        $this->assertSame(2, $metrics->potentialUnknownCount);
        $this->assertSame(25, $metrics->xp);
        $this->assertSame(1, $metrics->actionsCompleted);
        $this->assertSame(1, $metrics->opportunitiesCompleted);
        $this->assertSame(125, $user->xpTotal());
    }
}
