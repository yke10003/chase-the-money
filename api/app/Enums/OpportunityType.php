<?php

namespace App\Enums;

enum OpportunityType: string
{
    case Earn = 'earn';
    case Sell = 'sell';
    case Recover = 'recover';
    case Save = 'save';
}
