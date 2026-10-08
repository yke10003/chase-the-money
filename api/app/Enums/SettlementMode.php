<?php

namespace App\Enums;

enum SettlementMode: string
{
    case None = 'none';
    case Partial = 'partial';
    case Full = 'full';
}
