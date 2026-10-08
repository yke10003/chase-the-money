<?php

namespace Database\Seeders;

use App\Domain\PlaybookRunner;
use App\Domain\Sell\SellItemFlow;
use App\Enums\GoalStatus;
use App\Enums\OpportunityStatus;
use App\Models\Goal;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Opt-in demo data for the founder fixture.
 *
 * Not called from DatabaseSeeder. Standard actions use the first XP economy.
 */
class FounderFixtureSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::factory()->create([
            'name' => 'Founder',
            'email' => 'founder@example.test',
        ]);

        Goal::factory()->for($user)->create([
            'amount_minor' => 200000,
            'currency' => 'EUR',
            'starts_on' => '2026-10-01',
            'ends_on' => '2026-10-31',
            'status' => GoalStatus::Active,
            'rhythm' => 'monthly',
            'anchor_day' => 1,
        ]);

        $user->profile()->create([
            'work_categories' => ['software'],
            'experience_level' => 'experienced',
            'availability' => '4_8',
            'starting_capital' => 'none',
            'willing' => ['freelance', 'sell', 'recover', 'reduce_expenses', 'consult'],
            'excluded' => ['delivery', 'microtasks'],
            'situation' => ['owns_sellable', 'money_owed', 'unpaid_invoice', 'waiting_response', 'subscriptions'],
        ]);

        $user->skills()->createMany([
            ['name' => 'Software development', 'proficiency' => 'experienced'],
            ['name' => 'Product development', 'proficiency' => 'experienced'],
            ['name' => 'Technical consulting', 'proficiency' => 'experienced'],
        ]);

        $playbooks = app(PlaybookRunner::class);
        $sellItems = app(SellItemFlow::class);

        $playbooks->start($user, 'freelance', [
            'title' => 'Freelance proposal',
            'current_state' => 'proposal_sent',
            'follow_up_on' => '2026-10-13',
        ]);

        $playbooks->start($user, 'freelance', [
            'title' => 'Contact previous colleagues',
            'current_state' => 'lead',
        ]);

        $jacket = $playbooks->start($user, 'sell_item', [
            'title' => 'Versace jacket',
            'category' => 'Wardrobe',
        ]);
        $jacket->notes = 'Exact value is unknown. Similar items have sold for more. Would probably accept around €400.';
        $jacket->stage = 'valuing';
        $jacket->status = OpportunityStatus::Active;
        $jacket->potential_min_minor = 40000;
        $jacket->potential_max_minor = 60000;
        $jacket->save();
        $sellItems->ensureFor($jacket);

        $silver = $playbooks->start($user, 'sell_item', [
            'title' => 'Silver collection',
            'category' => 'Jewelry / metals',
        ]);
        $silver->notes = 'Some pieces are mixed with other metals. Value depends on weight and purity.';
        $silver->status = OpportunityStatus::Explore;
        $silver->save();
        $sellItems->ensureFor($silver);

        $halloween = $playbooks->start($user, 'sell_item', [
            'title' => 'Halloween jacket and gilet',
            'category' => 'Wardrobe',
            'start' => 'known_value',
            'worth_min_minor' => 20000,
            'worth_max_minor' => 20000,
        ]);
        $halloween->notes = 'Willing to sell. Roughly €200.';
        $halloween->save();
        $sellItems->ensureFor($halloween);

        $invoice = $playbooks->start($user, 'recover_money', [
            'title' => 'Outstanding invoice',
            'kind' => 'invoice',
        ]);
        $invoice->notes = 'Expected to be paid. The amount is not recorded yet.';
        $invoice->save();

        $playbooks->start($user, 'recover_money', [
            'title' => 'Friend repayment',
            'kind' => 'friend',
            'amount_minor' => 25000,
            'expected_on' => '2026-10-20',
        ]);

        $playbooks->start($user, 'recover_money', [
            'title' => 'Tax refund',
            'kind' => 'tax',
        ]);

        $playbooks->start($user, 'reduce_expense', [
            'title' => 'Subscription audit',
        ]);
    }
}
