<?php

namespace App\Enums;

enum OpportunityStatus: string
{
    case Explore = 'explore';
    case Active = 'active';
    case Waiting = 'waiting';
    case Completed = 'completed';
    case Abandoned = 'abandoned';
    case Paused = 'paused';

    /**
     * Statuses that still belong in pipeline totals.
     *
     * @return list<self>
     */
    public static function open(): array
    {
        return [
            self::Explore,
            self::Active,
            self::Waiting,
        ];
    }
}
