<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Domain\Money;
use App\Domain\PeriodMetrics;
use App\Enums\GoalStatus;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function goals(): HasMany
    {
        return $this->hasMany(Goal::class);
    }

    public function profile(): HasOne
    {
        return $this->hasOne(UserProfile::class);
    }

    public function skills(): HasMany
    {
        return $this->hasMany(UserSkill::class);
    }

    public function opportunities(): HasMany
    {
        return $this->hasMany(Opportunity::class);
    }

    public function sellItems(): HasMany
    {
        return $this->hasMany(SellItem::class);
    }

    protected static function booted(): void
    {
        static::deleting(function (User $user): void {
            $user->sellItems()->get()->each->delete();
        });
    }

    public function financialImpacts(): HasMany
    {
        return $this->hasMany(FinancialImpact::class);
    }

    public function xpEvents(): HasMany
    {
        return $this->hasMany(XpEvent::class);
    }

    public function xpTotal(): int
    {
        return (int) $this->xpEvents()->sum('amount');
    }

    /**
     * The active goal whose dates cover $on.
     * If several do, the one with the latest start wins.
     */
    public function currentGoal(?CarbonInterface $on = null): ?Goal
    {
        $day = ($on ?? now())->toDateString();

        return $this->goals()
            ->where('status', GoalStatus::Active)
            ->whereDate('starts_on', '<=', $day)
            ->where(function ($query) use ($day): void {
                $query->where(function ($recurring) use ($day): void {
                    $recurring->whereIn('rhythm', ['weekly', 'monthly'])
                        ->where(function ($end) use ($day): void {
                            $end->whereNull('ends_on')
                                ->orWhereDate('ends_on', '>=', $day);
                        });
                })->orWhere(function ($dated) use ($day): void {
                    $dated->where('rhythm', 'by_date')
                        ->whereDate('ends_on', '>=', $day);
                });
            })
            ->orderByDesc('starts_on')
            ->orderByDesc('id')
            ->first();
    }

    public function lifetimeMetrics(string $currency): PeriodMetrics
    {
        return $this->metricsForPeriod(
            Carbon::create(1970, 1, 1)->startOfDay(),
            now(),
            $currency,
        );
    }

    public function metricsForPeriod(CarbonInterface $startsOn, CarbonInterface $endsOn, string $currency): PeriodMetrics
    {
        $currency = Money::currency($currency);
        $from = $startsOn->copy()->startOfDay();
        $to = $endsOn->copy()->endOfDay();

        $realizedByType = $this->financialImpacts()
            ->where('currency', $currency)
            ->whereBetween('occurred_at', [$from, $to])
            ->selectRaw('type, sum(amount_minor) as total')
            ->groupBy('type')
            ->pluck('total', 'type');

        $earn = (int) ($realizedByType[OpportunityType::Earn->value] ?? 0);
        $sell = (int) ($realizedByType[OpportunityType::Sell->value] ?? 0);
        $recover = (int) ($realizedByType[OpportunityType::Recover->value] ?? 0);
        $save = (int) ($realizedByType[OpportunityType::Save->value] ?? 0);

        $open = $this->opportunities()
            ->where('currency', $currency)
            ->whereIn('status', OpportunityStatus::open());

        $expectedMinor = (int) (clone $open)
            ->whereNotNull('expected_amount_minor')
            ->sum('expected_amount_minor');

        $potentialRows = (clone $open)->get(['potential_min_minor', 'potential_max_minor']);
        $potentialMin = null;
        $potentialMax = null;
        $unknownPotential = 0;

        foreach ($potentialRows as $row) {
            if ($row->potential_min_minor === null && $row->potential_max_minor === null) {
                $unknownPotential++;

                continue;
            }

            if ($row->potential_min_minor !== null) {
                $potentialMin = ($potentialMin ?? 0) + $row->potential_min_minor;
            }

            if ($row->potential_max_minor !== null) {
                $potentialMax = ($potentialMax ?? 0) + $row->potential_max_minor;
            }
        }

        $xp = (int) $this->xpEvents()
            ->whereBetween('occurred_at', [$from, $to])
            ->sum('amount');

        $actionsCompleted = OpportunityAction::query()
            ->whereHas('opportunity', function ($query): void {
                $query->where('user_id', $this->id);
            })
            ->whereBetween('completed_at', [$from, $to])
            ->count();

        $opportunitiesCompleted = $this->opportunities()
            ->whereBetween('completed_at', [$from, $to])
            ->count();

        return new PeriodMetrics(
            currency: $currency,
            realizedMinor: $earn + $sell + $recover + $save,
            realizedEarnMinor: $earn,
            realizedSellMinor: $sell,
            realizedRecoverMinor: $recover,
            realizedSaveMinor: $save,
            expectedMinor: $expectedMinor,
            potentialMinMinor: $potentialMin,
            potentialMaxMinor: $potentialMax,
            potentialUnknownCount: $unknownPotential,
            xp: $xp,
            actionsCompleted: $actionsCompleted,
            opportunitiesCompleted: $opportunitiesCompleted,
        );
    }
}
