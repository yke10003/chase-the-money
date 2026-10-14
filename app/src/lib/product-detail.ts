export type ProductFact = { label: string; value: string };

/** Saved order stays put. The gallery opens on the cover within that order. */
export function coverIndex(photos: Array<{ is_cover: boolean }>): number {
  const index = photos.findIndex((photo) => photo.is_cover);

  return index < 0 ? 0 : index;
}

/**
 * Only filled-in attributes. Brand and condition are columns. Everything else
 * comes from the catalog fields for this category.
 */
export function productFacts(
  item: { brand: string | null; condition_label: string | null; details: Record<string, string> },
  fields: Array<{ key: string; label: string }>,
): ProductFact[] {
  const rows: ProductFact[] = [];
  const brand = item.brand?.trim();

  if (brand) {
    rows.push({ label: 'Brand', value: brand });
  }

  if (item.condition_label) {
    rows.push({ label: 'Condition', value: item.condition_label });
  }

  for (const field of fields) {
    if (field.key === 'brand') {
      continue;
    }

    const value = item.details[field.key]?.trim();

    if (value) {
      rows.push({ label: field.label, value });
    }
  }

  return rows;
}

const SHOT_LABELS: Record<string, string> = {
  main: 'Front',
  back: 'Back',
  side: 'Side',
  detail: 'Detail',
  brand_label: 'Brand label',
  size_label: 'Size label',
  model_serial: 'Model number',
  hallmark: 'Hallmark',
  edge: 'Edge',
  ports: 'Ports',
  packaging: 'Packaging',
  accessories: 'Included',
  damage: 'Wear',
  scale_weight: 'Scale',
  dimensions: 'Size',
  screen_on: 'Screen',
  sole: 'Sole',
};

/** A short row label. Catalog titles are instructions ("Take the front"), not names. */
export function shotLabel(shotKey: string | null, collage: unknown): string {
  if (collage) {
    return 'Collage';
  }

  if (!shotKey) {
    return 'Photo';
  }

  return SHOT_LABELS[shotKey] ?? 'Photo';
}

/** Move one photo. Cover stays on the photo object, not the slot it left. */
export function movePhoto<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }

  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);

  return next;
}

export function samePhotoOrder(left: Array<{ id: number }>, right: Array<{ id: number }>): boolean {
  return left.length === right.length && left.every((item, index) => item.id === right[index]?.id);
}

export function listingStatus(state: 'sold' | 'asking' | 'unknown'): string {
  if (state === 'sold') {
    return 'Sold';
  }

  if (state === 'asking') {
    return 'Asking';
  }

  return 'Unknown';
}

/** The marketplace name when we have one, otherwise the site in the link. */
export function listingPlace(platform: string | null, url: string): string {
  const named = platform?.trim();

  if (named) {
    return named;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Listing';
  }
}

/** Edit and collage are pushes inside the Photos sheet. */
export function itemLeaf(id: number, leaf: 'edit' | 'collage'): string {
  return `/product/${id}/photos/${leaf}`;
}
