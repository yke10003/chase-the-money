<?php

namespace Tests\Feature\Api;

use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\SellItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * The app opens a Sell product at /product/{sell item id}. Opportunity ids and sell item ids are different
 * sequences, so the API has to say which item belongs to which mission.
 */
class OpportunitySellItemIdTest extends TestCase
{
    use RefreshDatabase;

    /**
     * A sell mission with its item. A few spare opportunities first, so the two id sequences differ.
     *
     * @return array{0: Opportunity, 1: SellItem}
     */
    private function sellMission(User $user, string $title = 'Versace jacket'): array
    {
        Opportunity::factory()->count(3)->for($user)->create(['title' => 'Spare lead']);

        $opportunity = Opportunity::factory()->versaceJacket()->for($user)->create([
            'title' => $title,
            'playbook' => 'sell_item',
            'context' => ['sell_setup' => 'ready'],
        ]);
        $item = SellItem::factory()->create([
            'user_id' => $user->id,
            'opportunity_id' => $opportunity->id,
            'setup_step' => 'done',
        ]);

        return [$opportunity, $item];
    }

    #[Test]
    public function a_sell_mission_names_its_item_and_keeps_its_own_id(): void
    {
        $user = User::factory()->create();
        [$opportunity, $item] = $this->sellMission($user);

        $this->assertNotSame($opportunity->id, $item->id);

        $this->actingAs($user)->getJson('/api/v1/opportunities/'.$opportunity->id)
            ->assertOk()
            ->assertJsonPath('data.id', $opportunity->id)
            ->assertJsonPath('data.sell_item_id', $item->id)
            ->assertJsonPath('data.title', 'Versace jacket')
            ->assertJsonPath('data.stage', 'valuing');

        $row = collect($this->actingAs($user)->getJson('/api/v1/opportunities')->assertOk()->json('data'))
            ->firstWhere('id', $opportunity->id);

        $this->assertSame($item->id, $row['sell_item_id']);
        $this->assertSame($opportunity->id, $row['id']);
    }

    #[Test]
    public function other_missions_have_no_sell_item_id(): void
    {
        $user = User::factory()->create();
        $recover = Opportunity::factory()->outstandingInvoice()->for($user)->create();
        $freelance = Opportunity::factory()->freelanceProposal()->for($user)->create();
        $custom = Opportunity::factory()->silverCollection()->for($user)->create();

        foreach ([$recover, $freelance, $custom] as $opportunity) {
            $this->actingAs($user)->getJson('/api/v1/opportunities/'.$opportunity->id)
                ->assertOk()
                ->assertJsonPath('data.id', $opportunity->id)
                ->assertJsonPath('data.sell_item_id', null);
        }
    }

    #[Test]
    public function a_sell_mission_whose_item_is_gone_has_no_sell_item_id(): void
    {
        $user = User::factory()->create();
        [$opportunity, $item] = $this->sellMission($user);

        $item->delete();

        $this->actingAs($user)->getJson('/api/v1/opportunities/'.$opportunity->id)
            ->assertOk()
            ->assertJsonPath('data.sell_item_id', null);
    }

    #[Test]
    public function an_item_that_belongs_to_someone_else_is_never_exposed(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        [$opportunity, $item] = $this->sellMission($user);

        // Stale or tampered data: the item row points at another account.
        $item->forceFill(['user_id' => $other->id])->save();

        $this->actingAs($user)->getJson('/api/v1/opportunities/'.$opportunity->id)
            ->assertOk()
            ->assertJsonPath('data.sell_item_id', null);

        $this->actingAs($user)->getJson('/api/v1/opportunities')
            ->assertOk()
            ->assertJsonPath('data.0.sell_item_id', null);
    }

    #[Test]
    public function another_users_mission_is_still_forbidden(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        [$opportunity, $item] = $this->sellMission($owner);

        $response = $this->actingAs($stranger)->getJson('/api/v1/opportunities/'.$opportunity->id)
            ->assertForbidden();

        $this->assertStringNotContainsString('sell_item_id', $response->getContent());

        $this->actingAs($stranger)->getJson('/api/v1/opportunities')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    #[Test]
    public function home_suggestions_and_money_in_motion_name_the_item(): void
    {
        $user = User::factory()->create();
        [$sell, $item] = $this->sellMission($user);
        OpportunityAction::factory()->for($sell)->create(['title' => 'Take photos', 'estimated_minutes' => 20]);

        $recover = Opportunity::factory()->outstandingInvoice()->for($user)->create();
        OpportunityAction::factory()->for($recover)->create(['title' => 'Send a reminder', 'estimated_minutes' => 10]);

        $data = $this->actingAs($user)->getJson('/api/v1/home')->assertOk()->json('data');
        $actions = collect($data['suggested_actions']);

        $sellAction = $actions->firstWhere('opportunity_id', $sell->id);
        $recoverAction = $actions->firstWhere('opportunity_id', $recover->id);

        $this->assertNotNull($sellAction);
        $this->assertNotNull($recoverAction);
        // Existing fields stay as they were.
        $this->assertSame('Take photos', $sellAction['title']);
        $this->assertSame('sell', $sellAction['opportunity_type']);
        $this->assertSame($item->id, $sellAction['sell_item_id']);
        $this->assertNotSame($sellAction['opportunity_id'], $sellAction['sell_item_id']);
        $this->assertNull($recoverAction['sell_item_id']);

        $moving = collect($data['money_in_motion']);

        $this->assertSame($item->id, $moving->firstWhere('id', $sell->id)['sell_item_id'] ?? null);
        $moving->each(fn (array $row) => $this->assertArrayHasKey('sell_item_id', $row));
    }

    #[Test]
    public function an_unfinished_sell_draft_does_not_reach_home(): void
    {
        $user = User::factory()->create();
        [$sell] = $this->sellMission($user);
        OpportunityAction::factory()->for($sell)->create(['title' => 'Take photos']);
        $sell->forceFill(['context' => ['sell_setup' => 'draft']])->save();

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertOk()
            ->assertJsonPath('data.suggested_actions', []);
    }

    #[Test]
    public function the_list_and_home_look_items_up_once_however_many_missions_there_are(): void
    {
        $user = User::factory()->create();

        foreach (range(1, 6) as $number) {
            [$opportunity] = $this->sellMission($user, "Item {$number}");
            OpportunityAction::factory()->for($opportunity)->create(['title' => "Step {$number}"]);
        }

        DB::enableQueryLog();
        $this->actingAs($user)->getJson('/api/v1/opportunities')->assertOk();
        $listQueries = $this->itemQueries();

        DB::flushQueryLog();
        $this->actingAs($user)->getJson('/api/v1/home')->assertOk();
        $homeQueries = $this->itemQueries();

        $this->assertSame(1, $listQueries);
        $this->assertSame(1, $homeQueries);
    }

    #[Test]
    public function a_sell_type_mission_without_the_sell_playbook_costs_no_extra_query(): void
    {
        $user = User::factory()->create();
        Opportunity::factory()->count(4)->for($user)->create([
            'type' => OpportunityType::Earn,
            'status' => OpportunityStatus::Active,
        ]);
        $opportunity = Opportunity::factory()->silverCollection()->for($user)->create();

        // Single reads (create, events, playbook) build the resource without eager loading.
        DB::enableQueryLog();
        $this->actingAs($user)->postJson('/api/v1/opportunities/'.$opportunity->id.'/pause')->assertOk();

        $this->assertSame(0, $this->itemQueries());
    }

    private function itemQueries(): int
    {
        return collect(DB::getQueryLog())
            ->filter(fn (array $query) => str_contains($query['query'], 'from "sell_items"'))
            ->count();
    }
}
