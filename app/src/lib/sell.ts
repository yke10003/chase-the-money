import type { SellItemView } from '@/api/types';
import { majorToMinor } from '@/lib/money';

export const JOURNEY = ['category', 'identity', 'photos', 'details', 'research', 'estimate', 'description'] as const;

export type JourneyStep = (typeof JOURNEY)[number];

export function journeyIndex(step: string): number {
  const index = JOURNEY.indexOf(step as JourneyStep);

  return index < 0 ? JOURNEY.length - 1 : index;
}

export type EstimateInput =
  | { unknown: true }
  | { unknown: false; value_min_minor: number; value_max_minor: number }
  | { error: string };

/** Empty means the value is still unknown. A single figure is an exact estimate. */
export function parseEstimate(lowRaw: string, highRaw: string, unknown: boolean): EstimateInput {
  if (unknown || (lowRaw.trim() === '' && highRaw.trim() === '')) {
    return { unknown: true };
  }

  const low = majorToMinor(lowRaw);

  if (low == null) {
    return { error: 'Enter an amount like 450.' };
  }

  if (highRaw.trim() === '') {
    return { unknown: false, value_min_minor: low, value_max_minor: low };
  }

  const high = majorToMinor(highRaw);

  if (high == null) {
    return { error: 'Enter the top of the range like 600.' };
  }

  if (high < low) {
    return { error: 'The top of the range cannot be below the bottom.' };
  }

  return { unknown: false, value_min_minor: low, value_max_minor: high };
}

export type ShotPlanEntry = {
  key: string;
  recommended: boolean;
  taken?: boolean;
  skipped?: boolean;
};

/** The next shot that has not been taken or skipped. Null means photography can move on. */
export function openShot(plan: ShotPlanEntry[]): string | null {
  const open = (entry: ShotPlanEntry) => !entry.taken && !entry.skipped;

  return (plan.find((entry) => entry.recommended && open(entry)) ?? plan.find(open))?.key ?? null;
}

/** The next open shot after the one on screen, so skipping does not jump backwards. */
export function shotAfter(plan: ShotPlanEntry[], currentKey: string): string | null {
  const index = plan.findIndex((entry) => entry.key === currentKey);

  return openShot(plan.slice(index + 1));
}

/**
 * What the description step shows before anyone edits it.
 * A future on-device generator can return this same shape. Persistence stays separate.
 */
export function listingDraft(item: { name: string | null; listing_title: string | null; listing_description: string | null }): { title: string; description: string } {
  const stored = item.listing_title?.trim();

  return {
    title: stored || item.name?.trim() || '',
    description: item.listing_description ?? '',
  };
}

/** A listing blurb from what we already know, for the seller to edit. */
export function listingSuggestion(item: SellItemView): string {
  const name = item.name?.trim() || 'This item';
  const titled = item.brand?.trim() ? `${item.brand.trim()} ${name}` : name;
  const sentences = [`${titled}.`];
  const size = item.details.size?.trim();
  const material = item.details.material?.trim();
  const facts = [size ? `Size ${size}` : null, material].filter((value): value is string => Boolean(value));

  if (facts.length > 0) {
    sentences.push(`${facts.join(', ')}.`);
  }

  if (item.condition_label) {
    sentences.push(`${item.condition_label}.`);
  }

  const flaws = item.details.flaws?.trim();

  if (flaws) {
    sentences.push(flaws.endsWith('.') ? flaws : `${flaws}.`);
  }

  const used = new Set(['size', 'material', 'flaws']);

  for (const [key, value] of Object.entries(item.details)) {
    const trimmed = value.trim();

    if (used.has(key) || trimmed === '') {
      continue;
    }

    sentences.push(trimmed.endsWith('.') ? trimmed : `${trimmed}.`);
  }

  return sentences.join(' ');
}

export async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(value);

    return true;
  }

  return false;
}
