<?php

namespace App\Http\Controllers;

use App\Domain\Sell\SellCatalog;
use App\Domain\Sell\SellItemFlow;
use App\Http\Resources\SellItemResource;
use App\Models\SellComparable;
use App\Models\SellItem;
use App\Models\SellItemPhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SellItemController extends Controller
{
    public function catalog(): JsonResponse
    {
        return response()->json(['data' => SellCatalog::payload()]);
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $items = $request->user()->sellItems()
            ->with(['photos', 'comparables', 'opportunity.xpEvents'])
            ->latest('id')
            ->get();

        return SellItemResource::collection($items);
    }

    public function store(Request $request, SellItemFlow $flow): JsonResponse
    {
        $input = $request->validate([
            'category' => ['required', 'string'],
            'subcategory' => ['nullable', 'string'],
            'name' => ['nullable', 'string', 'max:120'],
            'worth_minor' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = $flow->start(
            $request->user(),
            $input['category'],
            $input['subcategory'] ?? null,
            $input['name'] ?? null,
            isset($input['worth_minor']) ? (int) $input['worth_minor'] : null,
        );

        return (new SellItemResource($this->load($item)))->response()->setStatusCode(201);
    }

    public function storeListed(Request $request, SellItemFlow $flow): JsonResponse
    {
        $input = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'category' => ['required', 'string'],
            'subcategory' => ['nullable', 'string'],
            'listed_on' => ['required', 'string', 'max:80'],
            'listing_url' => ['nullable', 'url', 'max:500'],
            'asking_price_minor' => ['required', 'integer', 'min:0'],
            'listed_on_date' => ['nullable', 'date'],
        ]);

        $item = $flow->startListed($request->user(), $input);

        return (new SellItemResource($this->load($item)))->response()->setStatusCode(201);
    }

    public function show(SellItem $item): SellItemResource
    {
        $this->authorize('view', $item);

        return new SellItemResource($this->load($item));
    }

    public function update(Request $request, SellItemFlow $flow, SellItem $item): SellItemResource
    {
        $this->authorize('update', $item);
        $input = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'brand' => ['sometimes', 'nullable', 'string', 'max:80'],
            'condition' => ['sometimes', 'nullable', 'string', 'max:40'],
            'details' => ['sometimes', 'array'],
            'details.*' => ['nullable', 'string', 'max:200'],
            'advance' => ['sometimes', 'boolean'],
        ]);
        $flow->save($item, $input);

        return new SellItemResource($this->load($item));
    }

    public function finish(Request $request, SellItemFlow $flow, SellItem $item): SellItemResource
    {
        $this->authorize('update', $item);
        $input = $request->validate([
            'unknown' => ['sometimes', 'boolean'],
            'value_min_minor' => ['nullable', 'integer', 'min:0'],
            'value_max_minor' => ['nullable', 'integer', 'min:0'],
            'value_confidence' => ['nullable', Rule::in(['sure', 'rough'])],
        ]);
        $flow->finish($item, $input);

        return new SellItemResource($this->load($item));
    }

    public function storePhoto(Request $request, SellItemFlow $flow, SellItem $item): SellItemResource
    {
        $this->authorize('update', $item);
        $input = $request->validate([
            'photo' => ['required', 'file', 'max:12288'],
            'shot_key' => ['nullable', 'string', 'max:40'],
        ]);
        $flow->addPhoto($item, $input['photo'], $input['shot_key'] ?? null);

        return new SellItemResource($this->load($item));
    }

    public function destroyPhoto(SellItem $item, SellItemPhoto $photo): SellItemResource
    {
        $this->authorize('update', $item);
        $this->ownedPhoto($item, $photo);
        $photo->deleteFile();
        $photo->delete();
        $this->ensureCover($item);

        Log::info('sell.photo.deleted', [
            'user_id' => $item->user_id,
            'sell_item_id' => $item->id,
            'photo_id' => $photo->id,
        ]);

        return new SellItemResource($this->load($item));
    }

    public function reorderPhotos(Request $request, SellItem $item): SellItemResource
    {
        $this->authorize('update', $item);
        $ids = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer'],
        ])['ids'];
        $owned = $item->photos()->pluck('id')->all();
        $wanted = array_map('intval', $ids);

        if (count($wanted) !== count($owned) || array_diff($owned, $wanted) !== []) {
            throw ValidationException::withMessages([
                'ids' => 'Reorder the photos that belong to this item.',
            ]);
        }

        foreach ($wanted as $index => $id) {
            $item->photos()->where('id', $id)->update(['sort_order' => $index]);
        }

        return new SellItemResource($this->load($item));
    }

    public function cover(SellItem $item, SellItemPhoto $photo): SellItemResource
    {
        $this->authorize('update', $item);
        $this->ownedPhoto($item, $photo);
        $item->photos()->update(['is_cover' => false]);
        $photo->is_cover = true;
        $photo->save();

        return new SellItemResource($this->load($item));
    }

    public function storeComparable(Request $request, SellItemFlow $flow, SellItem $item): SellItemResource
    {
        $this->authorize('update', $item);
        $input = $request->validate([
            'url' => ['required', 'string', 'max:500'],
            'amount_minor' => ['required', 'integer', 'min:0'],
            'state' => ['required', Rule::in(['sold', 'asking', 'unknown'])],
            'note' => ['nullable', 'string', 'max:200'],
        ]);
        $flow->addComparable($item, $input);

        return new SellItemResource($this->load($item));
    }

    public function destroyComparable(SellItem $item, SellComparable $comparable): Response
    {
        $this->authorize('update', $item);

        if ($comparable->sell_item_id !== $item->id) {
            abort(404);
        }

        $comparable->delete();

        return response()->noContent();
    }

    private function load(SellItem $item): SellItem
    {
        return $item->fresh()->load(['photos', 'comparables', 'opportunity.xpEvents']);
    }

    private function ownedPhoto(SellItem $item, SellItemPhoto $photo): void
    {
        if ($photo->sell_item_id !== $item->id) {
            abort(404);
        }
    }

    private function ensureCover(SellItem $item): void
    {
        $item->unsetRelation('photos');

        if ($item->photos()->where('is_cover', true)->exists()) {
            return;
        }

        $next = $item->photos()->orderBy('sort_order')->orderBy('id')->first();

        if ($next !== null) {
            $next->is_cover = true;
            $next->save();
        }
    }
}
