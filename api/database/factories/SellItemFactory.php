<?php

namespace Database\Factories;

use App\Models\Opportunity;
use App\Models\SellItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SellItem>
 */
class SellItemFactory extends Factory
{
    protected $model = SellItem::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'opportunity_id' => Opportunity::factory(),
            'name' => 'Jacket',
            'category' => 'wardrobe',
            'subcategory' => 'jacket',
            'currency' => 'EUR',
            'setup_step' => 'identity',
            'origin' => 'setup',
        ];
    }
}
