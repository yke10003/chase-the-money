<?php

namespace App\Policies;

use App\Models\OpportunityAction;
use App\Models\User;

class OpportunityActionPolicy
{
    public function update(User $user, OpportunityAction $action): bool
    {
        return $action->opportunity->user_id === $user->id;
    }

    public function delete(User $user, OpportunityAction $action): bool
    {
        return $action->opportunity->user_id === $user->id;
    }
}
