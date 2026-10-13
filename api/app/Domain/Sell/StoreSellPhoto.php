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

    /** Listing sites often reject uploads over 2 MB. The stored JPEG stays under that. */
    private const TARGET_BYTES = 2 * 1024 * 1024;

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

        [$bytes, $width, $height, $quality, $extension] = $mime === 'image/png'
            ? $this->normalizePng($file)
            : $this->normalize($file);
        $disk = (string) config('filesystems.sell_disk', 'public');
        $path = 'sell/'.$item->user_id.'/'.$item->id.'/'.Str::uuid()->toString().'.'.$extension;
        Storage::disk($disk)->put($path, $bytes);

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
            'bytes' => strlen($bytes),
            'quality' => $quality,
        ]);

        return $photo;
    }

    public function storeEdit(SellItemPhoto $photo, UploadedFile $file, string $background): SellItemPhoto
    {
        $image = $this->readImage($file);
        $width = imagesx($image);
        $height = imagesy($image);

        if (max($width, $height) > self::MAX_EDGE) {
            [$image, $width, $height] = $this->scale($image, $width, $height, self::MAX_EDGE, true);
        }

        $transparent = $this->hasTransparency($image);
        $disk = $photo->disk;
        $owner = $photo->item;
        $folder = 'sell/'.$owner->user_id.'/'.$photo->sell_item_id.'/';
        $previousEdited = $photo->edited_path;
        $previousCutout = $photo->cutout_path;
        $background = strtoupper($background);

        if ($transparent) {
            $png = $this->png($image);

            if ($png === '') {
                imagedestroy($image);

                throw ValidationException::withMessages([
                    'photo' => 'Could not save that photo.',
                ]);
            }

            $flat = $this->flatten($image, $background);
            $jpeg = $this->jpegUnder($flat);
            imagedestroy($flat);
            $cutout = $folder.Str::uuid()->toString().'.png';
            $edited = $folder.Str::uuid()->toString().'.jpg';
            Storage::disk($disk)->put($cutout, $png);
            Storage::disk($disk)->put($edited, $jpeg);
            $photo->cutout_path = $cutout;
            $photo->edited_path = $edited;
            $photo->background = $background;
        } else {
            $jpeg = $this->jpegUnder($image);
            imagedestroy($image);
            $edited = $folder.Str::uuid()->toString().'.jpg';
            Storage::disk($disk)->put($edited, $jpeg);
            $photo->edited_path = $edited;
            $photo->cutout_path = null;
            $photo->background = null;
        }

        if ($jpeg === '') {
            throw ValidationException::withMessages([
                'photo' => 'Could not save that photo.',
            ]);
        }

        $photo->save();
        $this->deleteStored($disk, $previousEdited, $photo->edited_path);
        $this->deleteStored($disk, $previousCutout, $photo->cutout_path);

        Log::info('sell.photo.edited', [
            'sell_item_id' => $photo->sell_item_id,
            'photo_id' => $photo->id,
            'transparent' => $transparent,
            'background' => $photo->background,
            'bytes' => strlen($jpeg),
        ]);

        return $photo;
    }

    public function recolor(SellItemPhoto $photo, string $background): SellItemPhoto
    {
        if (! $photo->cutout_path) {
            throw ValidationException::withMessages([
                'background' => 'Remove the background before changing its color.',
            ]);
        }

        $binary = Storage::disk($photo->disk)->get($photo->cutout_path);

        if (! is_string($binary) || $binary === '') {
            throw ValidationException::withMessages([
                'background' => 'The cutout for that photo is missing.',
            ]);
        }

        $image = @imagecreatefromstring($binary);

        if ($image === false) {
            throw ValidationException::withMessages([
                'background' => 'Could not read that cutout.',
            ]);
        }

        $flat = $this->flatten($image, $background);
        $jpeg = $this->jpegUnder($flat);
        imagedestroy($flat);

        if ($jpeg === '') {
            throw ValidationException::withMessages([
                'background' => 'Could not save that photo.',
            ]);
        }

        $owner = $photo->item;
        $path = 'sell/'.$owner->user_id.'/'.$photo->sell_item_id.'/'.Str::uuid()->toString().'.jpg';
        Storage::disk($photo->disk)->put($path, $jpeg);
        $previous = $photo->edited_path;
        $photo->edited_path = $path;
        $photo->background = strtoupper($background);
        $photo->save();
        $this->deleteStored($photo->disk, $previous, $path);

        Log::info('sell.photo.recolored', [
            'sell_item_id' => $photo->sell_item_id,
            'photo_id' => $photo->id,
            'background' => $photo->background,
            'bytes' => strlen($jpeg),
        ]);

        return $photo;
    }

    public function clearEdit(SellItemPhoto $photo): void
    {
        $disk = Storage::disk($photo->disk);

        if ($photo->edited_path) {
            $disk->delete($photo->edited_path);
        }

        if ($photo->cutout_path) {
            $disk->delete($photo->cutout_path);
        }

        $photo->edited_path = null;
        $photo->cutout_path = null;
        $photo->background = null;
        $photo->save();

        Log::info('sell.photo.edit_cleared', [
            'sell_item_id' => $photo->sell_item_id,
            'photo_id' => $photo->id,
        ]);
    }

    private function readImage(UploadedFile $file): \GdImage
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

        if (! imageistruecolor($image)) {
            imagepalettetotruecolor($image);
        }

        imagealphablending($image, false);
        imagesavealpha($image, true);

        return $image;
    }

    private function hasTransparency(\GdImage $image): bool
    {
        imagealphablending($image, false);
        $width = imagesx($image);
        $height = imagesy($image);
        $stepX = max(1, intdiv($width, 48));
        $stepY = max(1, intdiv($height, 48));

        for ($y = 0; $y < $height; $y += $stepY) {
            for ($x = 0; $x < $width; $x += $stepX) {
                $alpha = (imagecolorat($image, $x, $y) >> 24) & 0x7F;

                if ($alpha > 8) {
                    return true;
                }
            }
        }

        return false;
    }

    private function png(\GdImage $image): string
    {
        imagealphablending($image, false);
        imagesavealpha($image, true);
        ob_start();
        imagepng($image);
        $png = ob_get_clean();

        return is_string($png) ? $png : '';
    }

    private function jpegUnder(\GdImage $image): string
    {
        $jpeg = '';

        foreach ([90, 80, 70, 60] as $quality) {
            $jpeg = $this->jpeg($image, $quality);

            if ($jpeg !== '' && strlen($jpeg) <= self::TARGET_BYTES) {
                return $jpeg;
            }
        }

        if ($jpeg === '') {
            throw ValidationException::withMessages([
                'photo' => 'Could not save that photo.',
            ]);
        }

        return $jpeg;
    }

    private function deleteStored(string $disk, ?string $previous, ?string $current): void
    {
        if ($previous && $previous !== $current) {
            Storage::disk($disk)->delete($previous);
        }
    }

    /**
     * @return array{0: string, 1: int, 2: int, 3: int, 4: string}
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
        $passes = [
            ['edge' => self::MAX_EDGE, 'quality' => 86],
            ['edge' => self::MAX_EDGE, 'quality' => 72],
            ['edge' => 1800, 'quality' => 68],
            ['edge' => 1400, 'quality' => 60],
        ];
        $jpeg = '';
        $quality = 86;

        foreach ($passes as $pass) {
            if (max($width, $height) > $pass['edge']) {
                [$image, $width, $height] = $this->scale($image, $width, $height, $pass['edge']);
            }

            $quality = $pass['quality'];
            $jpeg = $this->jpeg($image, $quality);

            if ($jpeg !== '' && strlen($jpeg) <= self::TARGET_BYTES) {
                break;
            }
        }

        imagedestroy($image);

        if ($jpeg === '') {
            throw ValidationException::withMessages([
                'photo' => 'Could not save that photo.',
            ]);
        }

        return [$jpeg, $width, $height, $quality, 'jpg'];
    }

    /**
     * A cutout is a PNG with transparency. JPEG would paint the subject onto black.
     *
     * @return array{0: string, 1: int, 2: int, 3: int, 4: string}
     */
    private function normalizePng(UploadedFile $file, ?string $background = null): array
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

        imagealphablending($image, false);
        imagesavealpha($image, true);
        $width = imagesx($image);
        $height = imagesy($image);

        if (max($width, $height) > self::MAX_EDGE) {
            [$image, $width, $height] = $this->scale($image, $width, $height, self::MAX_EDGE, true);
        }

        if ($background !== null) {
            $image = $this->flatten($image, $background);
            $jpeg = $this->jpeg($image, 90);
            imagedestroy($image);

            if ($jpeg === '') {
                throw ValidationException::withMessages([
                    'photo' => 'Could not save that photo.',
                ]);
            }

            return [$jpeg, $width, $height, 90, 'jpg'];
        }

        ob_start();
        imagepng($image);
        $png = ob_get_clean();
        imagedestroy($image);

        if (! is_string($png) || $png === '') {
            throw ValidationException::withMessages([
                'photo' => 'Could not save that photo.',
            ]);
        }

        return [$png, $width, $height, 0, 'png'];
    }

    private function flatten(\GdImage $image, string $hex): \GdImage
    {
        $width = imagesx($image);
        $height = imagesy($image);
        $flat = imagecreatetruecolor($width, $height);
        [$red, $green, $blue] = $this->hexRgb($hex);
        $color = imagecolorallocate($flat, $red, $green, $blue);
        imagefilledrectangle($flat, 0, 0, $width, $height, $color);
        imagealphablending($flat, true);
        imagecopy($flat, $image, 0, 0, 0, 0, $width, $height);
        imagedestroy($image);

        return $flat;
    }

    /**
     * @return array{0: int, 1: int, 2: int}
     */
    private function hexRgb(string $hex): array
    {
        $hex = ltrim($hex, '#');

        if (strlen($hex) !== 6 || ! ctype_xdigit($hex)) {
            return [255, 255, 255];
        }

        return [hexdec(substr($hex, 0, 2)), hexdec(substr($hex, 2, 2)), hexdec(substr($hex, 4, 2))];
    }

    /**
     * @return array{0: \GdImage, 1: int, 2: int}
     */
    private function scale(\GdImage $image, int $width, int $height, int $edge, bool $keepAlpha = false): array
    {
        $scale = $edge / max($width, $height);
        $nextWidth = max(1, (int) round($width * $scale));
        $nextHeight = max(1, (int) round($height * $scale));
        $scaled = imagecreatetruecolor($nextWidth, $nextHeight);

        if ($keepAlpha) {
            imagealphablending($scaled, false);
            imagesavealpha($scaled, true);
            $clear = imagecolorallocatealpha($scaled, 0, 0, 0, 127);
            imagefilledrectangle($scaled, 0, 0, $nextWidth, $nextHeight, $clear);
            imagealphablending($scaled, true);
        }

        imagecopyresampled($scaled, $image, 0, 0, 0, 0, $nextWidth, $nextHeight, $width, $height);

        if ($keepAlpha) {
            imagealphablending($scaled, false);
            imagesavealpha($scaled, true);
        }

        imagedestroy($image);

        return [$scaled, $nextWidth, $nextHeight];
    }

    private function jpeg(\GdImage $image, int $quality): string
    {
        ob_start();
        imagejpeg($image, null, $quality);
        $jpeg = ob_get_clean();

        return is_string($jpeg) ? $jpeg : '';
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
