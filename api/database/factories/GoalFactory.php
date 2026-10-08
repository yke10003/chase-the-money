<?php

namespace Database\Factories;

use App\Enums\GoalStatus;
use App\Models\Goal;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Goal>
 */
class GoalFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $start = now()->startOfMonth();

        return [
            'user_id' => User::factory(),
            'amount_minor' => 200000,
            'currency' => 'EUR',
            'starts_on' => $start->toDateString(),
            'ends_on' => $start->copy()->endOfMonth()->toDateString(),
            'status' => GoalStatus::Active,
        ];
    }

    public function abandoned(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => GoalStatus::Abandoned,
        ]);
    }
}
