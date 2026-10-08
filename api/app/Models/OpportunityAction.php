<?php

namespace App\Models;

use App\Enums\ActionStatus;
use App\Enums\XpReason;
use Carbon\CarbonInterface;
use Database\Factories\OpportunityActionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

#[Fillable([
    'opportunity_id',
    'title',
    'description',
    'status',
    'estimated_minutes',
    'xp_reward',
    'sort_order',
    'system_owned',
    'playbook_key',
    'due_on',
    'completed_at',
])]
class OpportunityAction extends Model
{
    /** @use HasFactory<OpportunityActionFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::saving(function (OpportunityAction $action): void {
            $action->assertInvariants();
        });
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function xpEvent(): HasOne
    {
        return $this->hasOne(XpEvent::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ActionStatus::class,
            'estimated_minutes' => 'integer',
            'xp_reward' => 'integer',
            'sort_order' => 'integer',
            'system_owned' => 'boolean',
            'due_on' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function assertInvariants(): void
    {
        if ($this->xp_reward !== null && $this->xp_reward < 0) {
            throw new InvalidArgumentException('XP reward cannot be negative.');
        }

        if ($this->estimated_minutes !== null && $this->estimated_minutes < 1) {
            throw new InvalidArgumentException('Estimated minutes must be at least 1.');
        }
    }

    /**
     * Mark the action done and award its intended XP once.
     *
     * Calling this again does not create another XP event.
     */
    public function complete(?CarbonInterface $at = null): void
    {
        try {
            DB::transaction(function () use ($at): void {
                $locked = static::query()->lockForUpdate()->findOrFail($this->id);

                if ($locked->status === ActionStatus::Completed) {
                    return;
                }

                $locked->status = ActionStatus::Completed;
                $locked->completed_at = $at ?? now();
                $locked->save();

                if ($locked->xp_reward !== null && $locked->xp_reward > 0) {
                    $opportunity = $locked->opportunity()->firstOrFail();

                    XpEvent::query()->create([
                        'user_id' => $opportunity->user_id,
                        'opportunity_id' => $opportunity->id,
                        'opportunity_action_id' => $locked->id,
                        'amount' => $locked->xp_reward,
                        'reason' => XpReason::ActionCompleted,
                        'description' => $locked->title,
                        'occurred_at' => $locked->completed_at,
                    ]);
                }

                Log::info('Completed opportunity action', [
                    'action_id' => $locked->id,
                    'opportunity_id' => $locked->opportunity_id,
                    'user_id' => $locked->opportunity->user_id,
                    'xp_reward' => $locked->xp_reward,
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            Log::info('Skipped duplicate XP award for action', [
                'action_id' => $this->id,
            ]);
        }

        $this->refresh();
    }
}
