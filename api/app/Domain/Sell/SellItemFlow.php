<?php

namespace App\Domain\Sell;

use App\Domain\Playbooks\PlaybookKit;
use App\Domain\Playbooks\SellPlaybook;
use App\Domain\XpEconomy;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Models\Opportunity;
use App\Models\SellComparable;
use App\Models\SellItem;
use App\Models\SellItemPhoto;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Draft Sell items, their evidence, and the handoff into the existing sell playbook.
 *
 * Estimated value is potential money on the opportunity. It is never a financial impact.
 */
final class SellItemFlow
{
    public function __construct(private SellPlaybook $playbook, private StoreSellPhoto $photos) {}

    public function start(User $user, string $category, ?string $subcategory, ?string $name = null, ?int $worthMinor = null): SellItem
    {
        $this->assertTaxonomy($category, $subcategory);

        return DB::transaction(function () use ($user, $category, $subcategory, $name, $worthMinor): SellItem {
            $title = $this->clean($name) ?? 'Untitled item';
            $opportunity = PlaybookKit::make($user, OpportunityType::Sell->value, 'sell_item', $title, [
                'status' => OpportunityStatus::Explore,
                'stage' => 'valuing',
                'context' => [
                    'sell_setup' => 'draft',
                    'category' => $category,
                    'subcategory' => $subcategory,
                ],
            ]);

            $item = $opportunity->sellItem()->create([
                'user_id' => $user->id,
                'name' => $this->clean($name),
                'category' => $category,
                'subcategory' => $subcategory,
                'currency' => $opportunity->currency,
                'setup_step' => $this->clean($name) === null ? 'identity' : 'photos',
                'origin' => 'setup',
                'value_min_minor' => $worthMinor,
                'value_max_minor' => $worthMinor,
            ]);

            if ($this->clean($name) !== null) {
                $this->awardOnce($opportunity, 'identify_item', 'Name the item', 'Say what it is, in your own words.', XpEconomy::SMALL);
            }

            Log::info('sell.item.started', [
                'user_id' => $user->id,
                'sell_item_id' => $item->id,
                'category' => $category,
                'subcategory' => $subcategory,
            ]);

            return $item;
        });
    }

    public function startListed(User $user, array $input): SellItem
    {
        $category = (string) ($input['category'] ?? '');
        $subcategory = $this->clean($input['subcategory'] ?? null);
        $this->assertTaxonomy($category, $subcategory);
        $opportunity = $this->playbook->start($user, [
            'title' => $input['title'],
            'start' => 'listed',
            'category' => $category,
            'asking_price_minor' => $input['asking_price_minor'],
            'listed_on' => $input['listed_on'],
            'listing_url' => $input['listing_url'] ?? null,
        ]);
        $context = $opportunity->context ?? [];
        $context['sell_setup'] = 'ready';
        $context['subcategory'] = $subcategory;
        $context['listed_on_date'] = $input['listed_on_date'] ?? null;
        $opportunity->context = $context;
        $opportunity->save();

        $item = $opportunity->sellItem()->create([
            'user_id' => $user->id,
            'name' => $opportunity->title,
            'category' => $category,
            'subcategory' => $subcategory,
            'currency' => $opportunity->currency,
            'setup_step' => 'done',
            'origin' => 'listed',
        ]);

        Log::info('sell.item.listed', [
            'user_id' => $user->id,
            'sell_item_id' => $item->id,
            'listed_on' => $input['listed_on'],
        ]);

        return $item;
    }

    /**
     * Attach a Sell item to an opportunity the playbook already created.
     * Used for the founder fixture and any sell mission that predates the item row.
     */
    public function ensureFor(Opportunity $opportunity): SellItem
    {
        $existing = $opportunity->sellItem;

        if ($existing !== null) {
            return $existing;
        }

        $context = $opportunity->context ?? [];
        $raw = is_string($context['category'] ?? null) ? $context['category'] : null;
        [$category, $subcategory] = SellCatalog::legacy($opportunity->title, $raw);
        $context['sell_setup'] = 'ready';
        $context['category'] = $category;
        $opportunity->context = $context;
        $opportunity->save();

        return $opportunity->sellItem()->create([
            'user_id' => $opportunity->user_id,
            'name' => $opportunity->title,
            'category' => $category,
            'subcategory' => $subcategory,
            'value_min_minor' => $opportunity->potential_min_minor,
            'value_max_minor' => $opportunity->potential_max_minor,
            'currency' => $opportunity->currency,
            'setup_step' => 'done',
            'origin' => $opportunity->stage === 'listed' ? 'listed' : 'setup',
        ]);
    }

    public function save(SellItem $item, array $input): SellItem
    {
        if ($item->setupDone() && ($input['advance'] ?? false)) {
            return $item;
        }

        if (array_key_exists('name', $input)) {
            $name = $this->clean($input['name']);
            $item->name = $name;
            $item->opportunity->title = $name ?? 'Untitled item';
        }

        if (array_key_exists('brand', $input)) {
            $item->brand = $this->clean($input['brand']);
        }

        if (array_key_exists('condition', $input)) {
            $condition = $input['condition'];
            if ($condition !== null && ! in_array($condition, array_column(SellCatalog::conditions(), 'key'), true)) {
                throw ValidationException::withMessages([
                    'condition' => 'Pick a condition from the list.',
                ]);
            }
            $item->condition = $condition;
        }

        if (array_key_exists('details', $input) && is_array($input['details'])) {
            $item->details = $this->details($item, $input['details']);
        }

        $item->save();
        $item->opportunity->save();

        if ($item->name !== null && $item->name !== '') {
            $this->awardOnce($item->opportunity, 'identify_item', 'Name the item', 'Say what it is, in your own words.', XpEconomy::SMALL);
        }

        if (($input['advance'] ?? false) === true) {
            $this->advance($item);
        }

        return $item->refresh();
    }

    public function finish(SellItem $item, array $input): SellItem
    {
        $unknown = ($input['unknown'] ?? false) === true;
        $min = $unknown ? null : $this->amount($input, 'value_min_minor', 'Enter what you think it is worth, or skip it.');
        $max = $unknown ? null : ($this->amount($input, 'value_max_minor', 'Enter the top of the range.', false) ?? $min);

        if (! $unknown && $min !== null && $max !== null && $max < $min) {
            throw ValidationException::withMessages([
                'value_max_minor' => 'The top of the range cannot be below the bottom.',
            ]);
        }

        $confidence = $input['value_confidence'] ?? null;

        if ($confidence !== null && ! in_array($confidence, ['sure', 'rough'], true)) {
            throw ValidationException::withMessages([
                'value_confidence' => 'Pick how sure you are, or leave it blank.',
            ]);
        }

        return DB::transaction(function () use ($item, $min, $max, $confidence): SellItem {
            $item->value_min_minor = $min;
            $item->value_max_minor = $max;
            $item->value_confidence = $min === null ? null : $confidence;
            $item->setup_step = 'done';
            $item->save();

            $opportunity = $item->opportunity;
            $opportunity->title = $item->name ?? $opportunity->title;
            $opportunity->potential_min_minor = $min;
            $opportunity->potential_max_minor = $max;
            $context = $opportunity->context ?? [];
            $context['sell_setup'] = 'ready';
            $context['category'] = $item->category;
            $context['subcategory'] = $item->subcategory;
            $opportunity->context = $context;

            if (in_array($opportunity->stage, [null, 'valuing'], true)) {
                $opportunity->stage = 'preparing';
                $opportunity->status = OpportunityStatus::Active;
                $opportunity->save();
                $this->playbook->queuePrepare($opportunity);
            } else {
                $opportunity->status = OpportunityStatus::Active;
                $opportunity->save();
            }

            if ($min !== null) {
                $this->awardOnce($opportunity, 'value_item', 'Figure out what it\'s worth', 'Check recent sold listings for similar items.', XpEconomy::SMALL);
            }

            Log::info('sell.item.finished', [
                'user_id' => $item->user_id,
                'sell_item_id' => $item->id,
                'value_min_minor' => $min,
                'value_max_minor' => $max,
                'unknown' => $min === null,
            ]);

            return $item->refresh();
        });
    }

    public function addPhoto(SellItem $item, UploadedFile $file, ?string $shotKey): SellItemPhoto
    {
        return ($this->photos)($item, $file, $shotKey);
    }

    public function addComparable(SellItem $item, array $input): SellComparable
    {
        $url = trim((string) ($input['url'] ?? ''));

        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw ValidationException::withMessages([
                'url' => 'Paste a link to the similar sale.',
            ]);
        }

        $amount = $this->amount($input, 'amount_minor', 'Enter the price you saw.');
        $state = $input['state'] ?? 'unknown';

        if (! in_array($state, ['sold', 'asking', 'unknown'], true)) {
            throw ValidationException::withMessages([
                'state' => 'Say whether it sold, or is only asking that price.',
            ]);
        }

        $comparable = $item->comparables()->create([
            'url' => $url,
            'platform' => $this->platform($url),
            'amount_minor' => $amount,
            'state' => $state,
            'note' => $this->clean($input['note'] ?? null),
        ]);

        Log::info('sell.comparable.added', [
            'user_id' => $item->user_id,
            'sell_item_id' => $item->id,
            'comparable_id' => $comparable->id,
            'state' => $state,
            'platform' => $comparable->platform,
        ]);

        return $comparable;
    }

    public function researchPrompt(SellItem $item): string
    {
        $name = $item->name ?: 'an item';
        $parts = array_filter([
            $item->brand,
            $item->subcategoryLabel(),
            $item->categoryLabel(),
        ]);
        $kind = $parts === [] ? '' : ' ('.implode(', ', array_unique($parts)).')';
        $condition = $item->conditionLabel();
        $conditionLine = $condition === null ? '' : " Condition: {$condition}.";
        $detailLine = $this->detailSentence($item);
        $confidence = $item->value_confidence === 'rough' ? ' I only have a rough idea so far.' : '';

        return "Help me estimate the current resale value of {$name}{$kind}.{$conditionLine}{$detailLine}{$confidence} Compare recent sold listings where possible rather than only asking prices. Say what a realistic range looks like, and what would change it.";
    }

    private function advance(SellItem $item): void
    {
        $index = array_search($item->setup_step, SellItem::STEPS, true);

        if ($index === false || $item->setup_step === 'estimate' || $item->setup_step === 'done') {
            return;
        }

        if ($item->setup_step === 'identity' && ($item->name === null || trim($item->name) === '')) {
            throw ValidationException::withMessages([
                'name' => 'Name the item first.',
            ]);
        }

        if ($item->setup_step === 'photos' && $item->photos()->exists()) {
            $this->awardOnce($item->opportunity, 'photograph_item', 'Photograph the item', 'Take the photos a buyer would want.', XpEconomy::PREPARATION);
        }

        $item->setup_step = SellItem::STEPS[$index + 1];
        $item->save();

        Log::info('sell.item.advanced', [
            'user_id' => $item->user_id,
            'sell_item_id' => $item->id,
            'setup_step' => $item->setup_step,
        ]);
    }

    private function awardOnce(Opportunity $opportunity, string $key, string $title, string $description, int $xp): void
    {
        $existing = $opportunity->actions()->where('playbook_key', $key)->first();

        if ($existing !== null) {
            return;
        }

        $action = PlaybookKit::addAction($opportunity, $key, $title, $description, null, $xp);
        $action->complete();
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @return array<string, string>
     */
    private function details(SellItem $item, array $incoming): array
    {
        $allowed = [];

        foreach (SellCatalog::categories() as $category) {
            if ($category['key'] !== $item->category) {
                continue;
            }

            foreach ([...$category['details'], ...$category['identity']] as $field) {
                $allowed[] = $field['key'];
            }
        }

        $details = $item->details ?? [];

        foreach ($incoming as $key => $value) {
            if (! in_array($key, $allowed, true) || ! is_string($value)) {
                continue;
            }

            $clean = trim($value);
            if ($clean === '') {
                unset($details[$key]);
            } else {
                $details[$key] = $clean;
            }
        }

        return $details;
    }

    private function detailSentence(SellItem $item): string
    {
        $details = $item->details ?? [];
        $bits = [];

        foreach (['size', 'material', 'model', 'storage', 'weight', 'purity', 'metal', 'edition', 'working', 'boxed'] as $key) {
            if (! empty($details[$key])) {
                $bits[] = str_replace('_', ' ', $key).' '.$details[$key];
            }
        }

        return $bits === [] ? '' : ' '.ucfirst(implode(', ', $bits)).'.';
    }

    private function assertTaxonomy(string $category, ?string $subcategory): void
    {
        if (! SellCatalog::has($category, $subcategory)) {
            throw ValidationException::withMessages([
                'category' => 'Pick a kind of thing from the list.',
            ]);
        }
    }

    private function amount(array $input, string $key, string $message, bool $required = true): ?int
    {
        if (! array_key_exists($key, $input) || $input[$key] === null || $input[$key] === '') {
            if ($required) {
                throw ValidationException::withMessages([$key => $message]);
            }

            return null;
        }

        if (! is_numeric($input[$key]) || (int) $input[$key] < 0) {
            throw ValidationException::withMessages([$key => $message]);
        }

        return (int) $input[$key];
    }

    private function platform(string $url): string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host) ?? $host;

        foreach (['vinted', 'grailed', 'marktplaats', 'ebay', 'depop', 'vestiaire'] as $name) {
            if (str_contains($host, $name)) {
                return ucfirst($name);
            }
        }

        return $host !== '' ? $host : 'Other';
    }

    private function clean(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value === '' ? null : $value;
    }
}
