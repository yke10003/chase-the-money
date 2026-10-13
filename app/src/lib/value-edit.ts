import { majorToMinor, minorToMajorInput } from '@/lib/money';

export type ValueDraft = {
  low: string;
  high: string;
  unknown: boolean;
};

export type ValueSave =
  | { value_min_minor: number | null; value_max_minor: number | null }
  | { error: string };

/**
 * An unknown saved value still opens ready to type. "I don't know yet" stays
 * available, but it is not preselected.
 */
export function valueDraft(item: { value_min_minor: number | null; value_max_minor: number | null }): ValueDraft {
  if (item.value_min_minor == null) {
    return { low: '', high: '', unknown: false };
  }

  const low = minorToMajorInput(item.value_min_minor);
  const ranged = item.value_max_minor != null && item.value_max_minor !== item.value_min_minor;

  return {
    low,
    high: ranged ? minorToMajorInput(item.value_max_minor) : '',
    unknown: false,
  };
}

/** Toggling unknown keeps whatever was typed so turning it off restores the fields. */
export function withUnknown(draft: ValueDraft, unknown: boolean): ValueDraft {
  return { ...draft, unknown };
}

/** Blank, without the unknown choice, is not a value. Confidence is not part of this save. */
export function parseValueEdit(draft: ValueDraft): ValueSave {
  if (draft.unknown) {
    return { value_min_minor: null, value_max_minor: null };
  }

  if (draft.low.trim() === '') {
    return { error: 'Enter an estimate, or choose I don\'t know yet.' };
  }

  const min = majorToMinor(draft.low);

  if (min == null) {
    return { error: 'Enter an amount like 450.' };
  }

  if (draft.high.trim() === '') {
    return { value_min_minor: min, value_max_minor: min };
  }

  const max = majorToMinor(draft.high);

  if (max == null) {
    return { error: 'Enter the top of the range like 600.' };
  }

  if (max < min) {
    return { error: 'The top of the range cannot be below the bottom.' };
  }

  return { value_min_minor: min, value_max_minor: max };
}
