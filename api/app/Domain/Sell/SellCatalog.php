<?php

namespace App\Domain\Sell;

/**
 * Sell taxonomy, photo-shot primitives, and the plans that map a category onto those shots.
 *
 * Screens read this catalog. They do not grow their own category conditionals.
 */
final class SellCatalog
{
    /**
     * @return array<string, mixed>
     */
    public static function payload(): array
    {
        return [
            'categories' => array_map(fn (array $category) => [
                'key' => $category['key'],
                'label' => $category['label'],
                'icon' => $category['icon'],
                'subcategories' => $category['subcategories'],
                'identity' => $category['identity'],
                'details' => $category['details'],
                'condition_hint' => $category['condition_hint'],
            ], self::categories()),
            'conditions' => self::conditions(),
            'shots' => self::shots(),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function categories(): array
    {
        return [
            self::category('wardrobe', 'Wardrobe & fashion', 'tshirt', 'How it looks and wears.', [
                ['key' => 'jacket', 'label' => 'Jacket / coat'],
                ['key' => 'shoes', 'label' => 'Shoes'],
                ['key' => 'shirt', 'label' => 'Shirt / top'],
                ['key' => 'trousers', 'label' => 'Trousers'],
                ['key' => 'bag', 'label' => 'Bag'],
                ['key' => 'accessories', 'label' => 'Accessories'],
                ['key' => 'other', 'label' => 'Other'],
            ], [
                ['key' => 'brand', 'label' => 'Brand', 'placeholder' => 'Versace'],
            ], [
                ['key' => 'size', 'label' => 'Size', 'placeholder' => 'M'],
                ['key' => 'material', 'label' => 'Material', 'placeholder' => 'Cotton'],
                ['key' => 'flaws', 'label' => 'Obvious flaws', 'placeholder' => 'Small mark on the cuff'],
            ]),
            self::category('jewelry', 'Jewelry & watches', 'watch', 'Scratches, function, and whether the box is included.', [
                ['key' => 'watch', 'label' => 'Watch'],
                ['key' => 'ring', 'label' => 'Ring'],
                ['key' => 'necklace', 'label' => 'Necklace'],
                ['key' => 'bracelet', 'label' => 'Bracelet'],
                ['key' => 'earrings', 'label' => 'Earrings'],
                ['key' => 'other', 'label' => 'Other'],
            ], [
                ['key' => 'brand', 'label' => 'Brand', 'placeholder' => 'Seiko'],
            ], [
                ['key' => 'size', 'label' => 'Size', 'placeholder' => '54 mm'],
                ['key' => 'flaws', 'label' => 'Obvious flaws', 'placeholder' => 'Light scratches on the case'],
            ]),
            self::category('metals', 'Precious metals & coins', 'coins', 'Wear on the piece. The metal price is separate.', [
                ['key' => 'coin', 'label' => 'Coin'],
                ['key' => 'bar', 'label' => 'Bar'],
                ['key' => 'jewelry', 'label' => 'Jewelry'],
                ['key' => 'scrap', 'label' => 'Scrap / mixed'],
                ['key' => 'other', 'label' => 'Other'],
            ], [
                ['key' => 'metal', 'label' => 'Metal, if you know it', 'placeholder' => 'Silver', 'detail' => true],
            ], [
                ['key' => 'weight', 'label' => 'Weight, if you know it', 'placeholder' => '42 g'],
                ['key' => 'purity', 'label' => 'Purity or hallmark', 'placeholder' => '925'],
            ]),
            self::category('tech', 'Tech & electronics', 'deviceMobile', 'Whether it works matters more than light scratches.', [
                ['key' => 'phone', 'label' => 'Phone'],
                ['key' => 'laptop', 'label' => 'Laptop'],
                ['key' => 'tablet', 'label' => 'Tablet'],
                ['key' => 'camera', 'label' => 'Camera'],
                ['key' => 'audio', 'label' => 'Audio'],
                ['key' => 'gaming', 'label' => 'Gaming'],
                ['key' => 'other', 'label' => 'Other'],
            ], [
                ['key' => 'brand', 'label' => 'Brand', 'placeholder' => 'Apple'],
                ['key' => 'model', 'label' => 'Model', 'placeholder' => 'iPhone 13', 'detail' => true],
            ], [
                ['key' => 'storage', 'label' => 'Storage or spec', 'placeholder' => '128 GB'],
                ['key' => 'working', 'label' => 'Does it work?', 'choices' => ['Yes', 'Partly', 'No', 'Not sure']],
                ['key' => 'accessories', 'label' => 'Accessories included', 'placeholder' => 'Charger, no box'],
            ]),
            self::category('collectibles', 'Toys & collectibles', 'package', 'Completeness, corners, and whether it is sealed.', [
                ['key' => 'cards', 'label' => 'Trading cards'],
                ['key' => 'figures', 'label' => 'Figures'],
                ['key' => 'lego', 'label' => 'LEGO / construction'],
                ['key' => 'games', 'label' => 'Games'],
                ['key' => 'memorabilia', 'label' => 'Memorabilia'],
                ['key' => 'other', 'label' => 'Other'],
            ], [
                ['key' => 'brand', 'label' => 'Brand or series', 'placeholder' => 'Pokémon'],
            ], [
                ['key' => 'edition', 'label' => 'Edition or version', 'placeholder' => '1st edition'],
                ['key' => 'boxed', 'label' => 'Packaging', 'choices' => ['Sealed', 'Boxed', 'Loose']],
            ]),
            self::category('sports', 'Sports & hobbies', 'bicycle', 'How it looks and whether it is complete.', [
                ['key' => 'bike', 'label' => 'Bike'],
                ['key' => 'gear', 'label' => 'Gear'],
                ['key' => 'instrument', 'label' => 'Instrument'],
                ['key' => 'other', 'label' => 'Other'],
            ], [
                ['key' => 'brand', 'label' => 'Brand', 'placeholder' => 'Trek'],
            ], [
                ['key' => 'size', 'label' => 'Size', 'placeholder' => '54 cm'],
                ['key' => 'flaws', 'label' => 'Obvious flaws', 'placeholder' => 'Worn saddle'],
            ]),
            self::category('home', 'Home & furniture', 'armchair', 'Size and visible wear.', [
                ['key' => 'furniture', 'label' => 'Furniture'],
                ['key' => 'lighting', 'label' => 'Lighting'],
                ['key' => 'decor', 'label' => 'Decor'],
                ['key' => 'other', 'label' => 'Other'],
            ], [], [
                ['key' => 'dimensions', 'label' => 'Dimensions', 'placeholder' => '80 × 40 × 45 cm'],
                ['key' => 'flaws', 'label' => 'Obvious flaws', 'placeholder' => 'Chip on one leg'],
            ]),
            self::category('tools', 'Tools & equipment', 'wrench', 'Whether it still runs.', [
                ['key' => 'power', 'label' => 'Power tool'],
                ['key' => 'hand', 'label' => 'Hand tool'],
                ['key' => 'kit', 'label' => 'Kit'],
                ['key' => 'other', 'label' => 'Other'],
            ], [
                ['key' => 'brand', 'label' => 'Brand', 'placeholder' => 'Makita'],
            ], [
                ['key' => 'working', 'label' => 'Does it work?', 'choices' => ['Yes', 'Partly', 'No', 'Not sure']],
                ['key' => 'accessories', 'label' => 'What is included', 'placeholder' => 'Battery and case'],
            ]),
            self::category('other', 'Other', 'package', 'Anything a buyer would want to know.', [
                ['key' => 'other', 'label' => 'Something else'],
            ], [], [
                ['key' => 'note', 'label' => 'Anything that affects the price', 'placeholder' => 'Complete, with the original box'],
            ]),
        ];
    }

    /**
     * @param  list<array{key: string, label: string}>  $subcategories
     * @param  list<array<string, mixed>>  $identity
     * @param  list<array<string, mixed>>  $details
     * @return array<string, mixed>
     */
    private static function category(
        string $key,
        string $label,
        string $icon,
        string $conditionHint,
        array $subcategories,
        array $identity,
        array $details,
    ): array {
        return [
            'key' => $key,
            'label' => $label,
            'icon' => $icon,
            'condition_hint' => $conditionHint,
            'subcategories' => $subcategories,
            'identity' => $identity,
            'details' => $details,
        ];
    }

    /**
     * @return list<array{key: string, label: string}>
     */
    public static function conditions(): array
    {
        return [
            ['key' => 'new', 'label' => 'New / unused'],
            ['key' => 'excellent', 'label' => 'Excellent'],
            ['key' => 'good', 'label' => 'Good'],
            ['key' => 'fair', 'label' => 'Fair'],
            ['key' => 'poor', 'label' => 'Poor / damaged'],
        ];
    }

    /**
     * @return array<string, array{title: string, guidance: string, icon: string}>
     */
    public static function shots(): array
    {
        return [
            'main' => ['title' => 'Take the front', 'guidance' => 'Fill the frame. Keep the whole item in view.', 'icon' => 'camera'],
            'back' => ['title' => 'Turn it around', 'guidance' => 'The reverse side, as clear as the front.', 'icon' => 'arrowsClockwise'],
            'side' => ['title' => 'Show the side', 'guidance' => 'One angle so the shape is obvious.', 'icon' => 'image'],
            'detail' => ['title' => 'A close detail', 'guidance' => 'Texture, hardware, or a feature a buyer would zoom in on.', 'icon' => 'image'],
            'brand_label' => ['title' => 'Show the brand label', 'guidance' => 'The logo or neck label, readable if you can.', 'icon' => 'tag'],
            'size_label' => ['title' => 'Show the size label', 'guidance' => 'Size and care text. Get close enough to read it.', 'icon' => 'ruler'],
            'model_serial' => ['title' => 'Show the model number', 'guidance' => 'The model, serial, or IMEI. Cover a serial if you would rather not share it.', 'icon' => 'barcode'],
            'hallmark' => ['title' => 'Show the hallmark', 'guidance' => 'Stamp, mint mark, or purity mark.', 'icon' => 'coins'],
            'edge' => ['title' => 'Show the edge', 'guidance' => 'The rim or side, where wear and lettering show.', 'icon' => 'coins'],
            'ports' => ['title' => 'Show the ports', 'guidance' => 'Connectors, buttons, and anything missing.', 'icon' => 'plug'],
            'packaging' => ['title' => 'Show the packaging', 'guidance' => 'Box, slab, or papers, if you still have them.', 'icon' => 'package'],
            'accessories' => ['title' => 'Show what is included', 'guidance' => 'Charger, straps, extra parts. Only what goes with the sale.', 'icon' => 'package'],
            'damage' => ['title' => 'Show any wear', 'guidance' => 'Stains, scratches, or a fault. Skip this if there is nothing to show.', 'icon' => 'warning'],
            'scale_weight' => ['title' => 'Show the scale', 'guidance' => 'The item on a scale, if you have one. The number should be readable.', 'icon' => 'ruler'],
            'dimensions' => ['title' => 'Show the size', 'guidance' => 'Next to a tape, or a view that makes the size obvious.', 'icon' => 'ruler'],
            'screen_on' => ['title' => 'Screen on', 'guidance' => 'Turn it on. A buyer wants to see that it lights up.', 'icon' => 'deviceMobile'],
            'sole' => ['title' => 'Show the sole', 'guidance' => 'The underside, including the tread and any wear.', 'icon' => 'sneaker'],
        ];
    }

    /**
     * @return list<array{key: string, recommended: bool, title: string, guidance: string, icon: string}>
     */
    public static function plan(string $category, ?string $subcategory): array
    {
        $key = $subcategory ? $category.'/'.$subcategory : $category;
        $shots = self::plans()[$key] ?? self::plans()[$category] ?? self::plans()['other'];
        $primitives = self::shots();
        $plan = [];

        foreach ($shots as $shot) {
            $primitive = $primitives[$shot['key']] ?? null;

            if ($primitive === null) {
                continue;
            }

            $plan[] = [
                'key' => $shot['key'],
                'recommended' => $shot['recommended'],
                'title' => $primitive['title'],
                'guidance' => $primitive['guidance'],
                'icon' => $primitive['icon'],
            ];
        }

        return $plan;
    }

    /**
     * @return array<string, list<array{key: string, recommended: bool}>>
     */
    private static function plans(): array
    {
        $shot = fn (string $key, bool $recommended = true) => ['key' => $key, 'recommended' => $recommended];

        return [
            'wardrobe' => [$shot('main'), $shot('back'), $shot('brand_label'), $shot('detail'), $shot('damage', false)],
            'wardrobe/jacket' => [$shot('main'), $shot('back'), $shot('brand_label'), $shot('size_label'), $shot('detail'), $shot('damage', false)],
            'wardrobe/shoes' => [$shot('main'), $shot('sole'), $shot('brand_label'), $shot('detail'), $shot('damage', false)],
            'jewelry' => [$shot('main'), $shot('back'), $shot('hallmark'), $shot('detail'), $shot('damage', false)],
            'jewelry/watch' => [$shot('main'), $shot('back'), $shot('hallmark'), $shot('detail'), $shot('damage', false), $shot('packaging', false)],
            'metals' => [$shot('main'), $shot('hallmark'), $shot('scale_weight'), $shot('detail')],
            'metals/coin' => [$shot('main'), $shot('back'), $shot('hallmark'), $shot('edge'), $shot('scale_weight')],
            'tech' => [$shot('main'), $shot('back'), $shot('model_serial'), $shot('ports'), $shot('damage', false)],
            'tech/phone' => [$shot('main'), $shot('screen_on'), $shot('back'), $shot('model_serial'), $shot('damage'), $shot('accessories', false)],
            'collectibles' => [$shot('main'), $shot('back'), $shot('detail'), $shot('packaging', false)],
            'collectibles/cards' => [$shot('main'), $shot('back'), $shot('detail'), $shot('packaging', false)],
            'sports' => [$shot('main'), $shot('detail'), $shot('brand_label'), $shot('damage', false)],
            'home' => [$shot('main'), $shot('side'), $shot('dimensions'), $shot('damage', false)],
            'tools' => [$shot('main'), $shot('model_serial'), $shot('accessories', false), $shot('damage', false)],
            'other' => [$shot('main'), $shot('detail'), $shot('damage', false)],
        ];
    }

    public static function has(string $category, ?string $subcategory): bool
    {
        $match = null;

        foreach (self::categories() as $candidate) {
            if ($candidate['key'] !== $category) {
                continue;
            }

            $match = $candidate;
            break;
        }

        if ($match === null) {
            return false;
        }

        if ($subcategory === null || $subcategory === '') {
            return true;
        }

        foreach ($match['subcategories'] as $candidate) {
            if ($candidate['key'] === $subcategory) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{0: string, 1: string}
     */
    public static function legacy(string $title, ?string $raw): array
    {
        $haystack = strtolower($title.' '.($raw ?? ''));

        if (str_contains($haystack, 'silver') || str_contains($haystack, 'gold') || str_contains($haystack, 'coin') || str_contains($haystack, 'metal')) {
            return ['metals', str_contains($haystack, 'coin') ? 'coin' : 'other'];
        }

        if (str_contains($haystack, 'jacket') || str_contains($haystack, 'gilet') || str_contains($haystack, 'coat') || str_contains($haystack, 'wardrobe') || str_contains($haystack, 'clothes')) {
            $sub = (str_contains($haystack, 'jacket') || str_contains($haystack, 'gilet') || str_contains($haystack, 'coat')) ? 'jacket' : 'other';

            return ['wardrobe', $sub];
        }

        if (str_contains($haystack, 'phone') || str_contains($haystack, 'laptop') || str_contains($haystack, 'electronic')) {
            return ['tech', 'other'];
        }

        return ['other', 'other'];
    }

    /**
     * Money Hunt still speaks in room labels. Map those onto this taxonomy.
     *
     * @return array{0: string, 1: string|null}
     */
    public static function fromHunt(string $label): array
    {
        return match ($label) {
            'Wardrobe' => ['wardrobe', null],
            'Electronics' => ['tech', null],
            'Jewelry / metals' => ['metals', null],
            'Collectibles' => ['collectibles', null],
            'Tools' => ['tools', null],
            'Sports / hobby gear' => ['sports', null],
            'Furniture' => ['home', null],
            default => ['other', null],
        };
    }
}
