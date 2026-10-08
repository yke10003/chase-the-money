<?php

namespace App\Models;

use App\Domain\Sell\SellCatalog;
use Database\Factories\SellItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'user_id',
    'opportunity_id',
    'name',
    'category',
    'subcategory',
    'brand',
    'condition',
    'details',
    'value_min_minor',
    'value_max_minor',
    'value_confidence',
    'currency',
    'setup_step',
    'origin',
])]
class SellItem extends Model
{
    /** @use HasFactory<SellItemFactory> */
    use HasFactory;

    public const STEPS = ['identity', 'photos', 'details', 'research', 'estimate', 'done'];

    protected static function booted(): void
    {
        static::deleting(function (SellItem $item): void {
            $item->loadMissing('photos');

            foreach ($item->photos as $photo) {
                Storage::disk($photo->disk)->delete($photo->path);
            }
        });
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'details' => 'array',
            'value_min_minor' => 'integer',
            'value_max_minor' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function opportunity(): BelongsTo
    {
        return $this->belongsTo(Opportunity::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(SellItemPhoto::class)->orderBy('sort_order')->orderBy('id');
    }

    public function comparables(): HasMany
    {
        return $this->hasMany(SellComparable::class)->orderBy('id');
    }

    public function cover(): ?SellItemPhoto
    {
        return $this->photos->firstWhere('is_cover', true) ?? $this->photos->first();
    }

    public function setupDone(): bool
    {
        return $this->setup_step === 'done';
    }

    public function categoryLabel(): string
    {
        foreach (SellCatalog::categories() as $category) {
            if ($category['key'] === $this->category) {
                return $category['label'];
            }
        }

        return 'Item';
    }

    public function subcategoryLabel(): ?string
    {
        if ($this->subcategory === null) {
            return null;
        }

        foreach (SellCatalog::categories() as $category) {
            if ($category['key'] !== $this->category) {
                continue;
            }

            foreach ($category['subcategories'] as $subcategory) {
                if ($subcategory['key'] === $this->subcategory) {
                    return $subcategory['label'];
                }
            }
        }

        return null;
    }

    public function conditionLabel(): ?string
    {
        foreach (SellCatalog::conditions() as $condition) {
            if ($condition['key'] === $this->condition) {
                return $condition['label'];
            }
        }

        return null;
    }

    public function nextStepLabel(): string
    {
        return match ($this->setup_step) {
            'identity' => 'Name it',
            'photos' => 'Add photos',
            'details' => 'Add details',
            'research' => 'Add similar sales',
            'estimate' => 'Estimate value',
            default => 'Prepare the listing',
        };
    }
}
