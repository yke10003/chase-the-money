<?php

namespace Database\Factories;

use App\Enums\XpReason;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<XpEvent>
 */
class XpEventFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'opportunity_id' => null,
            'opportunity_action_id' => null,
            'amount' => 10,
            'reason' => XpReason::ActionCompleted,
            'description' => null,
            'occurred_at' => now(),
        ];
    }
}
