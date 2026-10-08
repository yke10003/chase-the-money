<?php

use App\Domain\Sell\SellCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sell_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('opportunity_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name')->nullable();
            $table->string('category');
            $table->string('subcategory')->nullable();
            $table->string('brand')->nullable();
            $table->string('condition')->nullable();
            $table->json('details')->nullable();
            $table->unsignedInteger('value_min_minor')->nullable();
            $table->unsignedInteger('value_max_minor')->nullable();
            $table->string('value_confidence')->nullable();
            $table->char('currency', 3);
            $table->string('setup_step');
            $table->string('origin');
            $table->timestamps();
        });

        Schema::create('sell_item_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sell_item_id')->constrained()->cascadeOnDelete();
            $table->string('disk');
            $table->string('path');
            $table->string('shot_key')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_cover')->default(false);
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->timestamps();
        });

        Schema::create('sell_comparables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sell_item_id')->constrained()->cascadeOnDelete();
            $table->string('url');
            $table->string('platform')->nullable();
            $table->unsignedInteger('amount_minor');
            $table->string('state');
            $table->string('note')->nullable();
            $table->timestamps();
        });

        $this->backfill();
    }

    public function down(): void
    {
        Schema::dropIfExists('sell_comparables');
        Schema::dropIfExists('sell_item_photos');
        Schema::dropIfExists('sell_items');
    }

    private function backfill(): void
    {
        $rows = DB::table('opportunities')->where('playbook', 'sell_item')->orderBy('id')->get();

        foreach ($rows as $row) {
            $context = json_decode($row->context ?? 'null', true);
            $context = is_array($context) ? $context : [];
            $raw = is_string($context['category'] ?? null) ? $context['category'] : null;
            [$category, $subcategory] = SellCatalog::legacy($row->title, $raw);
            $now = now();

            DB::table('sell_items')->insert([
                'user_id' => $row->user_id,
                'opportunity_id' => $row->id,
                'name' => $row->title,
                'category' => $category,
                'subcategory' => $subcategory,
                'value_min_minor' => $row->potential_min_minor,
                'value_max_minor' => $row->potential_max_minor,
                'currency' => $row->currency,
                'setup_step' => 'done',
                'origin' => $row->stage === 'listed' ? 'listed' : 'setup',
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $context['sell_setup'] = 'ready';
            $context['category'] = $category;
            DB::table('opportunities')->where('id', $row->id)->update([
                'context' => json_encode($context),
            ]);
        }
    }
};
