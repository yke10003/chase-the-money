<?php

namespace App\Models;

use App\Domain\Money;
use App\Domain\OpportunityStageCatalog;
use App\Enums\ActionStatus;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Enums\RecurrenceInterval;
use App\Enums\RoughEffort;
use Carbon\CarbonInterface;
use Database\Factories\OpportunityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

#[Fillable([
    'user_id',
    'type',
    'playbook',
    'title',
    'notes',
    'context',
    'status',
    'stage',
    'outcome',
    'potential_min_minor',
    'potential_max_minor',
    'expected_amount_minor',
    'agreed_amount_minor',
    'currency',
    'expected_on',
    'effort',
    'completed_at',
    'abandoned_at',
])]
class Opportunity extends Model
{
    /** @use HasFactory<OpportunityFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::saving(function (Opportunity $opportunity): void {
            $opportunity->currency = Money::currency($opportunity->currency);
            $opportunity->assertInvariants();
        });

        static::deleting(function (Opportunity $opportunity): void {
            $opportunity->sellItem?->delete();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function actions(): HasMany
    {
        return $this->hasMany(OpportunityAction::class);
    }

    public function financialImpacts(): HasMany
    {
        return $this->hasMany(FinancialImpact::class);
    }

    public function xpEvents(): HasMany
    {
        return $this->hasMany(XpEvent::class);
    }

    public function sellItem(): HasOne
    {
        return $this->hasOne(SellItem::class);
    }

    /**
     * The id the app opens as Product Detail (/product/{id}). It is a sell item id, never this opportunity's id.
     *
     * Null when there is no item, or when the item belongs to someone else (stale data).
     * Uses the loaded relation when there is one. Without it, only the sell_item playbook has an item to look up,
     * so every other mission skips the query.
     */
    public function sellItemId(): ?int
    {
        if ($this->playbook !== 'sell_item' && ! $this->relationLoaded('sellItem')) {
            return null;
        }

        $item = $this->sellItem;

        if ($item === null) {
            return null;
        }

        if ($item->user_id !== $this->user_id) {
            Log::warning('opportunity.sell_item.owner_mismatch', [
                'opportunity_id' => $this->id,
                'opportunity_user_id' => $this->user_id,
                'sell_item_id' => $item->id,
                'sell_item_user_id' => $item->user_id,
            ]);

            return null;
        }

        return $item->id;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => OpportunityType::class,
            'status' => OpportunityStatus::class,
            'context' => 'array',
            'potential_min_minor' => 'integer',
            'potential_max_minor' => 'integer',
            'expected_amount_minor' => 'integer',
            'agreed_amount_minor' => 'integer',
            'expected_on' => 'date',
            'effort' => RoughEffort::class,
            'completed_at' => 'datetime',
            'abandoned_at' => 'datetime',
        ];
    }

    public function assertInvariants(): void
    {
        $this->assertAmount('potential_min_minor');
        $this->assertAmount('potential_max_minor');
        $this->assertAmount('expected_amount_minor');
        $this->assertAmount('agreed_amount_minor');

        if ($this->potential_min_minor !== null
            && $this->potential_max_minor !== null
            && $this->potential_min_minor > $this->potential_max_minor) {
            throw new InvalidArgumentException('Potential minimum cannot exceed potential maximum.');
        }

        OpportunityStageCatalog::assert($this->type, $this->stage);
    }

    public function changeStage(?string $stage): void
    {
        $this->stage = $stage;
        $this->save();
    }

    public function markExploring(): void
    {
        $this->moveTo(OpportunityStatus::Explore);
    }

    public function markActive(): void
    {
        $this->moveTo(OpportunityStatus::Active);
    }

    public function markWaiting(): void
    {
        $this->moveTo(OpportunityStatus::Waiting);
    }

    public function complete(?CarbonInterface $at = null): void
    {
        $this->moveTo(OpportunityStatus::Completed, $at);
    }

    public function abandon(?CarbonInterface $at = null): void
    {
        $this->moveTo(OpportunityStatus::Abandoned, $at);
    }

    public function reopen(OpportunityStatus $status = OpportunityStatus::Active): void
    {
        if (! in_array($status, OpportunityStatus::open(), true)) {
            throw new InvalidArgumentException('An opportunity can only be reopened into explore, active, or waiting.');
        }

        $this->moveTo($status);
    }

    public function nextAction(): ?OpportunityAction
    {
        return $this->actions()
            ->where('status', ActionStatus::Open)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->first();
    }

    public function realizedMinor(): int
    {
        return (int) $this->financialImpacts()->sum('amount_minor');
    }

    public function recordRealizedImpact(
        int $amountMinor,
        ?CarbonInterface $occurredAt = null,
        ?string $note = null,
        ?int $recurringAmountMinor = null,
        ?RecurrenceInterval $recurrence = null,
    ): FinancialImpact {
        $impact = $this->financialImpacts()->create([
            'user_id' => $this->user_id,
            'type' => $this->type,
            'opportunity_title' => $this->title,
            'amount_minor' => $amountMinor,
            'currency' => $this->currency,
            'recurring_amount_minor' => $recurringAmountMinor,
            'recurrence_interval' => $recurrence,
            'occurred_at' => $occurredAt ?? now(),
            'note' => $note,
        ]);

        Log::info('Recorded financial impact', [
            'user_id' => $this->user_id,
            'opportunity_id' => $this->id,
            'type' => $this->type->value,
            'amount_minor' => $amountMinor,
            'currency' => $this->currency,
            'recurrence_interval' => $recurrence?->value,
        ]);

        return $impact;
    }

    private function moveTo(OpportunityStatus $status, ?CarbonInterface $at = null): void
    {
        $this->status = $status;

        if ($status === OpportunityStatus::Completed) {
            $this->completed_at ??= $at ?? now();
            $this->abandoned_at = null;
        } elseif ($status === OpportunityStatus::Abandoned) {
            $this->abandoned_at ??= $at ?? now();
            $this->completed_at = null;
        } else {
            $this->completed_at = null;
            $this->abandoned_at = null;
        }

        $this->save();
    }

    private function assertAmount(string $attribute): void
    {
        $amount = $this->{$attribute};

        if ($amount !== null && $amount < 0) {
            throw new InvalidArgumentException("{$attribute} cannot be negative.");
        }
    }
}
