<?php

namespace Tests\Feature\Api;

use App\Domain\Sell\SellCatalog;
use App\Enums\XpReason;
use App\Models\FinancialImpact;
use App\Models\SellItem;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SellItemApiTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function a_jacket_can_be_drafted_photographed_valued_and_resumed(): void
    {
        Storage::fake('public');
        $user = User::factory()->create();
        $other = User::factory()->create();

        $created = $this->actingAs($user)->postJson('/api/v1/sell/items', [
            'category' => 'wardrobe',
            'subcategory' => 'jacket',
        ])->assertCreated()
            ->assertJsonPath('data.setup_step', 'identity')
            ->assertJsonPath('data.category', 'wardrobe');

        $id = $created->json('data.id');
        $opportunityId = $created->json('data.opportunity_id');

        $this->actingAs($user)->getJson('/api/v1/home')
            ->assertOk()
            ->assertJsonPath('data.suggested_actions', []);

        $this->actingAs($user)->patchJson("/api/v1/sell/items/{$id}", [
            'name' => 'Versace Medusa bomber jacket',
            'brand' => 'Versace',
            'advance' => true,
        ])->assertOk()
            ->assertJsonPath('data.setup_step', 'photos')
            ->assertJsonPath('data.photo_plan.0.key', 'main')
            ->assertJsonPath('data.photo_plan.3.key', 'size_label');

        $this->actingAs($user)->post("/api/v1/sell/items/{$id}/photos", [
            'photo' => UploadedFile::fake()->image('front.jpg', 80, 60),
            'shot_key' => 'main',
        ])->assertOk()
            ->assertJsonPath('data.photos.0.is_cover', true);

        $second = $this->actingAs($user)->post("/api/v1/sell/items/{$id}/photos", [
            'photo' => UploadedFile::fake()->image('back.jpg', 40, 40),
            'shot_key' => 'back',
        ])->assertOk();

        $firstId = $second->json('data.photos.0.id');
        $secondId = $second->json('data.photos.1.id');

        $this->actingAs($user)->postJson("/api/v1/sell/items/{$id}/photos/reorder", [
            'ids' => [$secondId, $firstId],
        ])->assertOk()
            ->assertJsonPath('data.photos.0.id', $secondId);

        $this->actingAs($user)->postJson("/api/v1/sell/items/{$id}/photos/{$secondId}/cover")
            ->assertOk()
            ->assertJsonPath('data.photos.0.is_cover', true)
            ->assertJsonPath('data.cover_url', $second->json('data.photos.1.url'));

        $this->actingAs($user)->patchJson("/api/v1/sell/items/{$id}", [
            'advance' => true,
        ])->assertOk()->assertJsonPath('data.setup_step', 'details');

        $this->actingAs($user)->patchJson("/api/v1/sell/items/{$id}", [
            'condition' => 'good',
            'details' => ['size' => 'M'],
            'advance' => true,
        ])->assertOk()->assertJsonPath('data.setup_step', 'research');

        $prompt = $this->actingAs($user)->getJson("/api/v1/sell/items/{$id}")
            ->assertOk()
            ->json('data.research_prompt');

        $this->assertStringContainsString('Versace Medusa bomber jacket', $prompt);
        $this->assertStringContainsString('sold listings', $prompt);

        $this->actingAs($user)->postJson("/api/v1/sell/items/{$id}/comparables", [
            'url' => 'https://www.grailed.com/listings/1',
            'amount_minor' => 45000,
            'state' => 'sold',
        ])->assertOk();

        $this->actingAs($user)->postJson("/api/v1/sell/items/{$id}/comparables", [
            'url' => 'https://www.vinted.com/items/2',
            'amount_minor' => 60000,
            'state' => 'asking',
        ])->assertOk()
            ->assertJsonPath('data.comparables.0.platform', 'Grailed')
            ->assertJsonPath('data.comparables.0.state', 'sold')
            ->assertJsonPath('data.comparables.1.state', 'asking');

        $this->actingAs($user)->patchJson("/api/v1/sell/items/{$id}", [
            'advance' => true,
        ])->assertOk()->assertJsonPath('data.setup_step', 'estimate');

        $finished = $this->actingAs($user)->postJson("/api/v1/sell/items/{$id}/finish", [
            'value_min_minor' => 40000,
            'value_max_minor' => 60000,
            'value_confidence' => 'rough',
        ])->assertOk()
            ->assertJsonPath('data.setup_done', true)
            ->assertJsonPath('data.value_min_minor', 40000)
            ->assertJsonPath('data.value_max_minor', 60000)
            ->assertJsonPath('data.stage', 'preparing')
            ->assertJsonPath('data.next.title', 'Prepare the listing');

        $this->assertSame(0, FinancialImpact::query()->count());
        $this->assertSame(40000, $finished->json('data.value_min_minor'));
        $this->assertSame([10, 15, 10], XpEvent::query()->orderBy('id')->pluck('amount')->all());
        $this->assertSame(XpReason::ActionCompleted, XpEvent::query()->first()->reason);

        $before = XpEvent::query()->count();
        $this->actingAs($user)->postJson("/api/v1/sell/items/{$id}/finish", [
            'value_min_minor' => 40000,
            'value_max_minor' => 60000,
        ])->assertOk();
        $this->assertSame($before, XpEvent::query()->count());

        $this->actingAs($other)->patchJson("/api/v1/sell/items/{$id}", [
            'name' => 'Stolen',
        ])->assertForbidden();

        $this->actingAs($user)->deleteJson("/api/v1/opportunities/{$opportunityId}")
            ->assertNoContent();

        $this->assertSame(0, SellItem::query()->count());
        $this->assertSame([], Storage::disk('public')->allFiles('sell/'.$user->id));
    }

    #[Test]
    public function a_coin_uses_a_different_photo_plan_and_a_listing_skips_setup(): void
    {
        $user = User::factory()->create();

        $coin = $this->actingAs($user)->postJson('/api/v1/sell/items', [
            'category' => 'metals',
            'subcategory' => 'coin',
        ])->assertCreated();

        $this->assertSame(
            ['main', 'back', 'hallmark', 'edge', 'scale_weight'],
            array_column($coin->json('data.photo_plan'), 'key'),
        );

        $phone = $this->actingAs($user)->postJson('/api/v1/sell/items', [
            'category' => 'tech',
            'subcategory' => 'phone',
        ])->assertCreated();

        $this->assertContains('screen_on', array_column($phone->json('data.photo_plan'), 'key'));

        $this->actingAs($user)->postJson('/api/v1/sell/items/listed', [
            'title' => 'Already on Vinted',
            'category' => 'wardrobe',
            'subcategory' => 'jacket',
            'listed_on' => 'Vinted',
            'asking_price_minor' => 8000,
            'listing_url' => 'https://www.vinted.com/items/9',
        ])->assertCreated()
            ->assertJsonPath('data.setup_done', true)
            ->assertJsonPath('data.origin', 'listed')
            ->assertJsonPath('data.stage', 'listed')
            ->assertJsonPath('data.asking_price_minor', 8000)
            ->assertJsonPath('data.value_min_minor', null);
    }

    #[Test]
    public function the_catalog_plan_for_a_jacket_asks_for_the_label_shots(): void
    {
        $keys = array_column(SellCatalog::plan('wardrobe', 'jacket'), 'key');

        $this->assertSame(['main', 'back', 'brand_label', 'size_label', 'detail', 'damage'], $keys);
        $this->assertFalse(SellCatalog::plan('wardrobe', 'jacket')[5]['recommended']);
    }
}
