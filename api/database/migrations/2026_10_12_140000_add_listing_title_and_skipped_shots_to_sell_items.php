<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sell_items', function (Blueprint $table) {
            $table->string('listing_title')->nullable()->after('name');
            $table->json('skipped_shots')->nullable()->after('listing_description');
        });
    }

    public function down(): void
    {
        Schema::table('sell_items', function (Blueprint $table) {
            $table->dropColumn(['listing_title', 'skipped_shots']);
        });
    }
};
