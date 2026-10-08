<?php

namespace App\Models;

use App\Enums\XpReason;
use Database\Factories\XpEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

#[Fillable([
    'user_id',
    'opportunity_id',
    'opportunity_action_id',
    'amount',
    'reason',
    'description',
    'occurred_at',
])]
class XpEvent extends Model
{
    /** @use HasFactory<XpEventFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::saving(function (XpEvent $event): void {
            $event->assertInvariants();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function action(): BelongsTo
    {
        return $this->belongsTo(OpportunityAction::class, 'opportunity_action_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'reason' => XpReason::class,
            'occurred_at' => 'datetime',
        ];
    }

    public function assertInvariants(): void
    {
        if ($this->amount < 1) {
            throw new InvalidArgumentException('XP events must award at least 1 XP.');
        }
    }
}
