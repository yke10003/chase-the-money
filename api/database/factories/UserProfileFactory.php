<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<UserProfile>
 */
class UserProfileFactory extends Factory
{
    protected $model = UserProfile::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'work_categories' => ['software'],
            'experience_level' => 'experienced',
            'availability' => '4_8',
            'starting_capital' => 'none',
            'willing' => ['freelance', 'sell'],
            'excluded' => [],
            'situation' => [],
        ];
    }
}
