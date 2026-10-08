<?php

namespace App\Models;

use App\Domain\GoalPeriod;
use App\Domain\Money;
use App\Enums\GoalRhythm;
use App\Enums\GoalStatus;
use App\Enums\OpportunityType;
use App\Exceptions\GoalPeriodOverlapException;
use Carbon\CarbonInterface;
use Database\Factories\GoalFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\AsEnumCollection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InvalidArgumentException;

#[Fillable([
    'user_id',
    'amount_minor',
    'currency',
    'starts_on',
    'ends_on',
    'status',
    'included_types',
    'rhythm',
    'anchor_day',
])]
class Goal extends Model
{
    /** @use HasFactory<GoalFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::saving(function (Goal $goal): void {
            if ($goal->included_types === null) {
                $goal->included_types = OpportunityType::cases();
            }

            if ($goal->rhythm === null) {
                $goal->rhythm = GoalRhythm::Monthly;
            }

            if ($goal->isRecurring()) {
                $goal->ends_on = null;

                if ($goal->anchor_day === null && $goal->starts_on !== null) {
                    $goal->anchor_day = $goal->rhythm === GoalRhythm::Weekly
                        ? (int) $goal->starts_on->isoWeekday()
                        : min(28, (int) $goal->starts_on->day);
                }
            }

            $goal->currency = Money::currency($goal->currency);
            $goal->assertInvariants();
            $goal->assertPeriodIsAvailable();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_minor' => 'integer',
            'starts_on' => 'date',
            'ends_on' => 'date',
            'status' => GoalStatus::class,
            'rhythm' => GoalRhythm::class,
            'anchor_day' => 'integer',
            'included_types' => AsEnumCollection::of(OpportunityType::class),
        ];
    }

    public function isRecurring(): bool
    {
        return in_array($this->rhythm, [GoalRhythm::Weekly, GoalRhythm::Monthly], true);
    }

    /**
     * The window that counts toward this goal on $on.
     * Weekly and monthly goals derive it. A dated goal uses its stored dates.
     *
     * @return array{starts_on: string, ends_on: string}
     */
    public function periodOn(?CarbonInterface $on = null): array
    {
        $day = $on ?? now();

        if (! $this->isRecurring()) {
            return [
                'starts_on' => $this->starts_on->toDateString(),
                'ends_on' => $this->ends_on->toDateString(),
            ];
        }

        return GoalPeriod::current($this->rhythm, $this->anchor_day ?? 1, $day);
    }

    /**
     * @return array{starts_on: string, ends_on: string}
     */
    public function displayPeriod(): array
    {
        if ($this->status === GoalStatus::Active && $this->isRecurring()) {
            return $this->periodOn(now());
        }

        if ($this->ends_on === null) {
            return $this->periodOn($this->starts_on);
        }

        return [
            'starts_on' => $this->starts_on->toDateString(),
            'ends_on' => $this->ends_on->toDateString(),
        ];
    }

    public function includes(OpportunityType $type): bool
    {
        return $this->included_types->contains(
            fn (OpportunityType $included) => $included === $type,
        );
    }

    public function realizedMinor(): int
    {
        $types = $this->included_types
            ->map(fn (OpportunityType $type) => $type->value)
            ->all();

        $period = $this->periodOn();

        return (int) FinancialImpact::query()
            ->where('user_id', $this->user_id)
            ->where('currency', $this->currency)
            ->whereIn('type', $types)
            ->whereBetween('occurred_at', [
                $period['starts_on'].' 00:00:00',
                $period['ends_on'].' 23:59:59',
            ])
            ->sum('amount_minor');
    }

    /**
     * @return array{realized_minor: int, remaining_minor: int, progress_percent: int}
     */
    public function progress(): array
    {
        $realized = $this->realizedMinor();

        return [
            'realized_minor' => $realized,
            'remaining_minor' => max(0, $this->amount_minor - $realized),
            'progress_percent' => min(100, intdiv($realized * 100, $this->amount_minor)),
        ];
    }

    public function assertInvariants(): void
    {
        if ($this->amount_minor < 1) {
            throw new InvalidArgumentException('A goal amount must be at least 1 minor unit.');
        }

        if ($this->starts_on === null) {
            throw new InvalidArgumentException('A goal needs a start.');
        }

        if (! $this->isRecurring() && $this->ends_on === null) {
            throw new InvalidArgumentException('A dated goal needs an end.');
        }

        if ($this->ends_on !== null && $this->ends_on->toDateString() < $this->starts_on->toDateString()) {
            throw new InvalidArgumentException('A goal cannot end before it starts.');
        }

        if ($this->included_types === null || $this->included_types->isEmpty()) {
            throw new InvalidArgumentException('A goal must include at least one opportunity type.');
        }

        $values = $this->included_types
            ->map(fn (OpportunityType $type) => $type->value)
            ->all();

        if (count($values) !== count(array_unique($values))) {
            throw new InvalidArgumentException('A goal cannot include the same opportunity type twice.');
        }
    }

    public function assertPeriodIsAvailable(): void
    {
        if ($this->status !== GoalStatus::Active) {
            return;
        }

        $start = $this->starts_on->toDateString();
        $end = $this->isRecurring() ? '9999-12-31' : $this->ends_on->toDateString();

        $overlap = static::query()
            ->where('user_id', $this->user_id)
            ->where('status', GoalStatus::Active)
            ->when($this->exists, fn ($query) => $query->whereKeyNot($this->getKey()))
            ->whereDate('starts_on', '<=', $end)
            ->where(function ($query) use ($start): void {
                $query->whereNull('ends_on')
                    ->orWhereDate('ends_on', '>=', $start);
            })
            ->exists();

        if ($overlap) {
            throw new GoalPeriodOverlapException('An active goal already covers this period.');
        }
    }
}
