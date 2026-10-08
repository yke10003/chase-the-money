<?php

namespace Tests\Feature\Domain;

use App\Models\Opportunity;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\FounderFixtureSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FounderFixtureSeederTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function the_founder_fixture_matches_the_documented_scenario(): void
    {
        $this->seed(FounderFixtureSeeder::class);

        $user = User::query()->where('email', 'founder@example.test')->firstOrFail();
        $goal = $user->currentGoal(now()->setDate(2026, 10, 6));

        $this->assertNotNull($goal);
        $this->assertSame(200000, $goal->amount_minor);
        $this->assertSame('EUR', $goal->currency);
        $this->assertSame(9, $user->opportunities()->count());
        $this->assertSame(0, $user->financialImpacts()->count());
        $this->assertSame(0, $user->xpTotal());

        $jacket = $this->opportunity($user, 'Versace jacket');
        $this->assertSame(40000, $jacket->potential_min_minor);
        $this->assertSame(60000, $jacket->potential_max_minor);
        $this->assertSame('sell_item', $jacket->playbook);
        $this->assertTrue($jacket->nextAction()->system_owned);
        $this->assertSame('Figure out what it\'s worth', $jacket->nextAction()->title);
        $this->assertSame(10, $jacket->nextAction()->xp_reward);
        $this->assertSame(30, $jacket->nextAction()->estimated_minutes);

        $silver = $this->opportunity($user, 'Silver collection');
        $this->assertNull($silver->potential_min_minor);
        $this->assertNull($silver->potential_max_minor);

        $halloween = $this->opportunity($user, 'Halloween jacket and gilet');
        $this->assertSame(20000, $halloween->potential_min_minor);
        $this->assertSame(20000, $halloween->potential_max_minor);
        $this->assertSame('Prepare the listing', $halloween->nextAction()->title);

        $proposal = $this->opportunity($user, 'Freelance proposal');
        $this->assertNull($proposal->potential_min_minor);
        $this->assertNull($proposal->expected_amount_minor);
        $this->assertSame('waiting', $proposal->status->value);

        $outreach = $this->opportunity($user, 'Contact previous colleagues');
        $this->assertSame('lead', $outreach->context['current_state'] ?? null);
        $this->assertNull($outreach->expected_amount_minor);
        $this->assertNull($outreach->potential_min_minor);

        $repayment = $this->opportunity($user, 'Friend repayment');
        $this->assertSame(25000, $repayment->expected_amount_minor);
        $this->assertSame('waiting', $repayment->status->value);
        $this->assertSame('Follow up', $repayment->nextAction()->title);

        $invoice = $this->opportunity($user, 'Outstanding invoice');
        $this->assertNull($invoice->expected_amount_minor);

        $this->assertNull(
            $user->opportunities()->where('title', 'like', '%landlord%')->first()
        );

        $metrics = $user->metricsForPeriod(
            now()->setDate(2026, 10, 1),
            now()->setDate(2026, 10, 31),
            'EUR',
        );

        $this->assertSame(0, $metrics->realizedMinor);
        $this->assertSame(25000, $metrics->expectedMinor);
        $this->assertSame(60000, $metrics->potentialMinMinor);
        $this->assertSame(80000, $metrics->potentialMaxMinor);
    }

    #[Test]
    public function the_default_seeder_does_not_load_the_founder_fixture(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertDatabaseMissing('users', [
            'email' => 'founder@example.test',
        ]);
    }

    private function opportunity(User $user, string $title): Opportunity
    {
        return $user->opportunities()->where('title', $title)->firstOrFail();
    }
}
