<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('opportunities', function (Blueprint $table) {
            $table->string('outcome')->nullable()->after('stage');
            $table->unsignedInteger('agreed_amount_minor')->nullable()->after('expected_amount_minor');
        });

        Schema::table('opportunity_actions', function (Blueprint $table) {
            $table->date('due_on')->nullable()->after('playbook_key');
        });
    }

    public function down(): void
    {
        Schema::table('opportunity_actions', function (Blueprint $table) {
            $table->dropColumn('due_on');
        });

        Schema::table('opportunities', function (Blueprint $table) {
            $table->dropColumn(['outcome', 'agreed_amount_minor']);
        });
    }
};
