<?php

namespace App\Models;

use App\Domain\Money;
use App\Enums\OpportunityType;
use App\Enums\RecurrenceInterval;
use Database\Factories\FinancialImpactFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

#[Fillable([
    'user_id',
    'opportunity_id',
    'type',
    'opportunity_title',
    'amount_minor',
    'currency',
    'recurring_amount_minor',
    'recurrence_interval',
    'occurred_at',
    'note',
])]
class FinancialImpact extends Model
{
    /** @use HasFactory<FinancialImpactFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::saving(function (FinancialImpact $impact): void {
            $impact->currency = Money::currency($impact->currency);
            $impact->assertInvariants();
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

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => OpportunityType::class,
            'amount_minor' => 'integer',
            'recurring_amount_minor' => 'integer',
            'recurrence_interval' => RecurrenceInterval::class,
            'occurred_at' => 'datetime',
        ];
    }

    public function annualizedMinor(): ?int
    {
        if ($this->recurring_amount_minor === null || $this->recurrence_interval === null) {
            return null;
        }

        return match ($this->recurrence_interval) {
            RecurrenceInterval::Month => $this->recurring_amount_minor * 12,
            RecurrenceInterval::Year => $this->recurring_amount_minor,
        };
    }

    public function assertInvariants(): void
    {
        if ($this->amount_minor < 1) {
            throw new InvalidArgumentException('Realized impact must be at least 1 minor unit.');
        }

        $hasRecurringAmount = $this->recurring_amount_minor !== null;
        $hasRecurrence = $this->recurrence_interval !== null;

        if ($hasRecurringAmount !== $hasRecurrence) {
            throw new InvalidArgumentException('Recurring amount and recurrence interval must be set together.');
        }

        if ($hasRecurringAmount && $this->recurring_amount_minor < 1) {
            throw new InvalidArgumentException('Recurring amount must be at least 1 minor unit.');
        }

        if ($hasRecurringAmount && $this->type !== OpportunityType::Save) {
            throw new InvalidArgumentException('Only Save impact can carry a recurring amount.');
        }
    }
}
