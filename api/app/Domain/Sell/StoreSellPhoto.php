<?php

namespace App\Domain\Sell;

use App\Models\SellItem;
use App\Models\SellItemPhoto;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class StoreSellPhoto
{
    public const MAX_BYTES = 12 * 1024 * 1024;

    public const MAX_EDGE = 2400;

    public function __invoke(SellItem $item, UploadedFile $file, ?string $shotKey): SellItemPhoto
    {
        if ($item->photos()->count() >= 30) {
            throw ValidationException::withMessages([
                'photo' => '30 photos is enough for one item.',
            ]);
        }

        $mime = (string) $file->getMimeType();

        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
            throw ValidationException::withMessages([
                'photo' => 'Use a JPEG, PNG, or WebP photo.',
            ]);
        }

        if ($file->getSize() > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                'photo' => 'That photo is over 12 MB.',
            ]);
        }

        if ($shotKey !== null && ! array_key_exists($shotKey, SellCatalog::shots())) {
            throw ValidationException::withMessages([
                'shot_key' => 'That photo step is not part of this item.',
            ]);
        }

        [$jpeg, $width, $height] = $this->normalize($file);
        $disk = (string) config('filesystems.sell_disk', 'public');
        $path = 'sell/'.$item->user_id.'/'.$item->id.'/'.Str::uuid()->toString().'.jpg';
        Storage::disk($disk)->put($path, $jpeg);

        $sort = (int) $item->photos()->max('sort_order') + 1;
        $cover = $item->photos()->where('is_cover', true)->doesntExist();

        $photo = $item->photos()->create([
            'disk' => $disk,
            'path' => $path,
            'shot_key' => $shotKey,
            'sort_order' => $sort,
            'is_cover' => $cover,
            'width' => $width,
            'height' => $height,
        ]);

        Log::info('sell.photo.stored', [
            'user_id' => $item->user_id,
            'sell_item_id' => $item->id,
            'photo_id' => $photo->id,
            'shot_key' => $shotKey,
            'bytes' => strlen($jpeg),
        ]);

        return $photo;
    }

    /**
     * @return array{0: string, 1: int, 2: int}
     */
    private function normalize(UploadedFile $file): array
    {
        $binary = file_get_contents($file->getRealPath());

        if ($binary === false || ! function_exists('imagecreatefromstring')) {
            throw ValidationException::withMessages([
                'photo' => 'This server cannot read that photo.',
            ]);
        }

        $image = @imagecreatefromstring($binary);

        if ($image === false) {
            throw ValidationException::withMessages([
                'photo' => 'That file is not a photo we can use.',
            ]);
        }

        $image = $this->orient($image, $file->getRealPath());
        $width = imagesx($image);
        $height = imagesy($image);
        $long = max($width, $height);

        if ($long > self::MAX_EDGE) {
            $scale = self::MAX_EDGE / $long;
            $nextWidth = max(1, (int) round($width * $scale));
            $nextHeight = max(1, (int) round($height * $scale));
            $scaled = imagecreatetruecolor($nextWidth, $nextHeight);
            imagecopyresampled($scaled, $image, 0, 0, 0, 0, $nextWidth, $nextHeight, $width, $height);
            imagedestroy($image);
            $image = $scaled;
            $width = $nextWidth;
            $height = $nextHeight;
        }

        ob_start();
        imagejpeg($image, null, 86);
        $jpeg = ob_get_clean();
        imagedestroy($image);

        if (! is_string($jpeg) || $jpeg === '') {
            throw ValidationException::withMessages([
                'photo' => 'Could not save that photo.',
            ]);
        }

        return [$jpeg, $width, $height];
    }

    private function orient(\GdImage $image, string $path): \GdImage
    {
        if (! function_exists('exif_read_data')) {
            return $image;
        }

        $exif = @exif_read_data($path);
        $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;
        $rotated = match ($orientation) {
            3 => imagerotate($image, 180, 0),
            6 => imagerotate($image, -90, 0),
            8 => imagerotate($image, 90, 0),
            default => $image,
        };

        if ($rotated !== $image) {
            imagedestroy($image);
        }

        return $rotated;
    }
}
