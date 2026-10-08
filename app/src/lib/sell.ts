import { majorToMinor } from '@/lib/money';

export const JOURNEY = ['category', 'identity', 'photos', 'details', 'research', 'estimate'] as const;

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

export async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(value);

    return true;
  }

  return false;
}
