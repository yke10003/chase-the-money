<?php

namespace App\Policies;

use App\Models\SellItem;
use App\Models\User;

class SellItemPolicy
{
    public function view(User $user, SellItem $item): bool
    {
        return $item->user_id === $user->id;
    }

    public function update(User $user, SellItem $item): bool
    {
        return $item->user_id === $user->id;
    }

    public function delete(User $user, SellItem $item): bool
    {
        return $item->user_id === $user->id;
    }
}
