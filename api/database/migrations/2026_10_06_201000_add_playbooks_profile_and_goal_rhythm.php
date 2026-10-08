<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            $table->string('rhythm')->default('monthly')->after('status');
            $table->unsignedTinyInteger('anchor_day')->nullable()->after('rhythm');
        });

        Schema::table('opportunities', function (Blueprint $table) {
            $table->string('playbook')->nullable()->after('type');
            $table->json('context')->nullable()->after('notes');
        });

        Schema::table('opportunity_actions', function (Blueprint $table) {
            $table->boolean('system_owned')->default(false)->after('sort_order');
            $table->string('playbook_key')->nullable()->after('system_owned');
        });

        Schema::create('user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('work_category')->nullable();
            $table->string('experience_level')->nullable();
            $table->string('availability')->nullable();
            $table->string('starting_capital')->nullable();
            $table->json('willing')->nullable();
            $table->json('excluded')->nullable();
            $table->json('situation')->nullable();
            $table->timestamps();
        });

        Schema::create('user_skills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('proficiency')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_skills');
        Schema::dropIfExists('user_profiles');
        Schema::table('opportunity_actions', function (Blueprint $table) {
            $table->dropColumn(['system_owned', 'playbook_key']);
        });
        Schema::table('opportunities', function (Blueprint $table) {
            $table->dropColumn(['playbook', 'context']);
        });
        Schema::table('goals', function (Blueprint $table) {
            $table->dropColumn(['rhythm', 'anchor_day']);
        });
    }
};
