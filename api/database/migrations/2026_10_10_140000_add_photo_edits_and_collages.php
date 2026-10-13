<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sell_item_photos', function (Blueprint $table) {
            $table->string('edited_path')->nullable();
            $table->json('collage')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sell_item_photos', function (Blueprint $table) {
            $table->dropColumn(['edited_path', 'collage']);
        });
    }
};
