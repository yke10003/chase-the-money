import type { SellCatalog, SellItemView } from '@/api/types';

export type ListingFact = { label: string; value: string };

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();

  return text ? text : null;
}

function push(facts: ListingFact[], label: string, value: string | null | undefined) {
  const text = trimmed(value);

  if (text) {
    facts.push({ label, value: text });
  }
}

export function listingFacts(item: SellItemView, catalog?: SellCatalog | null): ListingFact[] {
  const facts: ListingFact[] = [];
  const category = catalog?.categories.find((entry) => entry.key === item.category);
  const fields = [...(category?.identity ?? []), ...(category?.details ?? [])];
  const labels = new Map(fields.map((field) => [field.key, field.label]));

  push(facts, 'Category', item.category_label);
  push(facts, 'Subcategory', item.subcategory_label);
  push(facts, 'Product name', item.name);
  push(facts, labels.get('brand') ?? 'Brand', item.brand);
  // The saved value is the catalog label ("New / unused"), not a guess about tags.
  push(facts, 'Condition', item.condition_label ?? item.condition);

  for (const [key, value] of Object.entries(item.details)) {
    if (key === 'brand') {
      continue;
    }

    push(facts, labels.get(key) ?? key, value);
  }

  return facts;
}
