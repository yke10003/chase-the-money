<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('opportunities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('title');
            $table->text('notes')->nullable();
            $table->string('status');
            $table->string('stage')->nullable();
            $table->unsignedInteger('potential_min_minor')->nullable();
            $table->unsignedInteger('potential_max_minor')->nullable();
            $table->unsignedInteger('expected_amount_minor')->nullable();
            $table->char('currency', 3);
            $table->date('expected_on')->nullable();
            $table->string('effort')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('abandoned_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('opportunities');
    }
};
