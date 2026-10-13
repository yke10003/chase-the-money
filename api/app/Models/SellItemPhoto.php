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
    'edited_path',
    'cutout_path',
    'background',
    'collage',
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
            'collage' => 'array',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(SellItem::class, 'sell_item_id');
    }

    public function deleteFile(): void
    {
        $disk = Storage::disk($this->disk);
        $disk->delete($this->path);

        if ($this->edited_path) {
            $disk->delete($this->edited_path);
        }

        if ($this->cutout_path) {
            $disk->delete($this->cutout_path);
        }
    }

    public function url(): string
    {
        return $this->fileUrl($this->edited_path ?: $this->path);
    }

    public function cutoutUrl(): ?string
    {
        if (! $this->cutout_path) {
            return null;
        }

        return $this->fileUrl($this->cutout_path);
    }

    public function originalUrl(): string
    {
        return $this->fileUrl($this->path);
    }

    private function fileUrl(string $path): string
    {
        $disk = Storage::disk($this->disk);
        $driver = config('filesystems.disks.'.$this->disk.'.driver');

        if ($driver === 's3') {
            return $disk->temporaryUrl($path, now()->addHour());
        }

        return $disk->url($path);
    }
}
