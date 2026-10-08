<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[Fillable([
    'sell_item_id',
    'disk',
    'path',
    'shot_key',
    'sort_order',
    'is_cover',
    'width',
    'height',
])]
class SellItemPhoto extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_cover' => 'boolean',
            'width' => 'integer',
            'height' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(SellItem::class, 'sell_item_id');
    }

    public function deleteFile(): void
    {
        Storage::disk($this->disk)->delete($this->path);
    }

    public function url(): string
    {
        $disk = Storage::disk($this->disk);
        $driver = config('filesystems.disks.'.$this->disk.'.driver');

        if ($driver === 's3') {
            return $disk->temporaryUrl($this->path, now()->addHour());
        }

        return $disk->url($this->path);
    }
}
