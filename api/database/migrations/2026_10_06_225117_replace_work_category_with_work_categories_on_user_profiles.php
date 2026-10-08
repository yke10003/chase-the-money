<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->json('work_categories')->nullable()->after('user_id');
        });

        DB::table('user_profiles')
            ->whereNotNull('work_category')
            ->orderBy('id')
            ->each(function (object $profile): void {
                DB::table('user_profiles')
                    ->where('id', $profile->id)
                    ->update(['work_categories' => json_encode([$profile->work_category])]);
            });

        Schema::table('user_profiles', function (Blueprint $table) {
            $table->dropColumn('work_category');
        });
    }

    public function down(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->string('work_category')->nullable()->after('user_id');
        });

        DB::table('user_profiles')
            ->whereNotNull('work_categories')
            ->orderBy('id')
            ->each(function (object $profile): void {
                $categories = json_decode($profile->work_categories, true) ?: [];

                DB::table('user_profiles')
                    ->where('id', $profile->id)
                    ->update(['work_category' => $categories[0] ?? null]);
            });

        Schema::table('user_profiles', function (Blueprint $table) {
            $table->dropColumn('work_categories');
        });
    }
};
