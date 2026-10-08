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
        Schema::create('financial_impacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('opportunity_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type');
            $table->string('opportunity_title')->nullable();
            $table->unsignedInteger('amount_minor');
            $table->char('currency', 3);
            $table->unsignedInteger('recurring_amount_minor')->nullable();
            $table->string('recurrence_interval')->nullable();
            $table->timestamp('occurred_at');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'occurred_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_impacts');
    }
};
