<?php

namespace App\Enums;

enum GoalRhythm: string
{
    case Weekly = 'weekly';
    case Monthly = 'monthly';
    case ByDate = 'by_date';
}
