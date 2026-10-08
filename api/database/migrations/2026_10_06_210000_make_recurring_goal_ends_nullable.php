<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('goals', function (Blueprint $table) {
            $table->date('ends_on')->nullable()->change();
        });

        DB::table('goals')
            ->whereIn('rhythm', ['weekly', 'monthly'])
            ->update(['ends_on' => null]);
    }

    public function down(): void
    {
        DB::table('goals')->whereNull('ends_on')->update(['ends_on' => '9999-12-31']);

        Schema::table('goals', function (Blueprint $table) {
            $table->date('ends_on')->nullable(false)->change();
        });
    }
};
