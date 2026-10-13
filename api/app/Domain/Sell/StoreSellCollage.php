<?php

namespace App\Domain\Sell;

use App\Models\SellItem;
use App\Models\SellItemPhoto;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class StoreSellCollage
{
    private const WIDTH = 1200;

    private const HEIGHT = 1500;

    /**
     * @param  array{0: array{id: int, zoom: float}, 1: array{id: int, zoom: float}, 2: array{id: int, zoom: float}}  $slots
     */
    public function __invoke(SellItem $item, array $slots, ?SellItemPhoto $existing, string $background = '#FFFFFF'): SellItemPhoto
    {
        $item->loadMissing('photos');
        $sources = [];

        foreach ($slots as $slot) {
            $source = $item->photos->firstWhere('id', $slot['id']);

            if ($source === null || $source->collage !== null) {
                throw ValidationException::withMessages([
                    'left_id' => 'Pick three photos that belong to this item.',
                ]);
            }

            $sources[] = ['photo' => $source, 'zoom' => $slot['zoom']];
        }

        $jpeg = $this->compose($sources, $background);
        $disk = (string) config('filesystems.sell_disk', 'public');
        $path = 'sell/'.$item->user_id.'/'.$item->id.'/'.Str::uuid()->toString().'.jpg';
        Storage::disk($disk)->put($path, $jpeg);
        $stored = [
            'background' => $background,
            'slots' => array_map(fn (array $slot) => ['id' => $slot['id'], 'zoom' => $slot['zoom']], $slots),
        ];

        if ($existing !== null) {
            Storage::disk($existing->disk)->delete($existing->path);
            $existing->path = $path;
            $existing->disk = $disk;
            $existing->collage = $stored;
            $existing->width = self::WIDTH;
            $existing->height = self::HEIGHT;
            $existing->save();
            $photo = $existing;
        } else {
            $item->photos()->update(['is_cover' => false]);
            $sort = (int) $item->photos()->max('sort_order') + 1;
            $photo = $item->photos()->create([
                'disk' => $disk,
                'path' => $path,
                'shot_key' => null,
                'sort_order' => $sort,
                'is_cover' => true,
                'width' => self::WIDTH,
                'height' => self::HEIGHT,
                'collage' => $stored,
            ]);
        }

        Log::info('sell.collage.stored', [
            'sell_item_id' => $item->id,
            'photo_id' => $photo->id,
            'slots' => $stored,
            'bytes' => strlen($jpeg),
        ]);

        return $photo;
    }

    /**
     * @param  list<array{photo: SellItemPhoto, zoom: float}>  $sources
     */
    private function compose(array $sources, string $background): string
    {
        $canvas = imagecreatetruecolor(self::WIDTH, self::HEIGHT);
        imagealphablending($canvas, true);
        [$red, $green, $blue] = $this->hexRgb($background);
        $paper = imagecolorallocate($canvas, $red, $green, $blue);
        imagefilledrectangle($canvas, 0, 0, self::WIDTH, self::HEIGHT, $paper);

        $leftWidth = (int) (self::WIDTH * 2 / 3);
        $rightWidth = self::WIDTH - $leftWidth;
        $half = (int) (self::HEIGHT / 2);
        $slots = [
            [0, 0, $leftWidth, self::HEIGHT],
            [$leftWidth, 0, $rightWidth, $half],
            [$leftWidth, $half, $rightWidth, self::HEIGHT - $half],
        ];

        foreach ($sources as $index => $source) {
            [$x, $y, $width, $height] = $slots[$index];
            $image = $this->load($source['photo']);
            $this->paintCover($canvas, $image, $x, $y, $width, $height, $source['zoom']);
            imagedestroy($image);
        }

        ob_start();
        imagejpeg($canvas, null, 86);
        $jpeg = ob_get_clean();
        imagedestroy($canvas);

        if (! is_string($jpeg) || $jpeg === '') {
            throw ValidationException::withMessages([
                'left_id' => 'Could not build that collage.',
            ]);
        }

        return $jpeg;
    }

    private function load(SellItemPhoto $photo): \GdImage
    {
        $path = $photo->edited_path ?: $photo->path;
        $binary = Storage::disk($photo->disk)->get($path);
        $image = is_string($binary) ? @imagecreatefromstring($binary) : false;

        if ($image === false) {
            throw ValidationException::withMessages([
                'left_id' => 'One of those photos could not be read.',
            ]);
        }

        return $image;
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

    private function paintCover(\GdImage $canvas, \GdImage $source, int $x, int $y, int $width, int $height, float $zoom): void
    {
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        $cover = max($width / $sourceWidth, $height / $sourceHeight);
        $scale = $cover * $zoom;
        $drawWidth = $sourceWidth * $scale;
        $drawHeight = $sourceHeight * $scale;

        if ($drawWidth + 0.5 >= $width && $drawHeight + 0.5 >= $height) {
            $cropWidth = max(1, min($sourceWidth, (int) round($width / $scale)));
            $cropHeight = max(1, min($sourceHeight, (int) round($height / $scale)));
            $originX = max(0, (int) (($sourceWidth - $cropWidth) / 2));
            $originY = max(0, (int) (($sourceHeight - $cropHeight) / 2));
            imagecopyresampled($canvas, $source, $x, $y, $originX, $originY, $width, $height, $cropWidth, $cropHeight);

            return;
        }

        $placedWidth = max(1, (int) round($drawWidth));
        $placedHeight = max(1, (int) round($drawHeight));
        $placedX = $x + (int) (($width - $placedWidth) / 2);
        $placedY = $y + (int) (($height - $placedHeight) / 2);
        imagecopyresampled($canvas, $source, $placedX, $placedY, 0, 0, $placedWidth, $placedHeight, $sourceWidth, $sourceHeight);
    }
}
