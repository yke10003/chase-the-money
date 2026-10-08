<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'sell_item_id',
    'url',
    'platform',
    'amount_minor',
    'state',
    'note',
])]
class SellComparable extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(SellItem::class, 'sell_item_id');
    }
}
