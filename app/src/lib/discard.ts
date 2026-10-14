/**
 * One discard dialog at a time. A swipe and a Close tap can both ask before the first answer is in.
 * The second request is answered "no" at once, so the person only ever sees one dialog.
 */
export function createDiscardGuard(ask: () => Promise<boolean>) {
  let asking = false;

  return {
    async request(): Promise<boolean> {
      if (asking) {
        return false;
      }

      asking = true;

      try {
        return await ask();
      } finally {
        asking = false;
      }
    },
  };
}

function normalize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      const entry = normalize((value as Record<string, unknown>)[key]);

      // Blank and missing are the same thing to a form.
      if (entry !== '' && entry != null) {
        clean[key] = entry;
      }
    }

    return clean;
  }

  return value;
}

/** Has a form changed from how it opened? Blank and missing match, and so do different key orders. */
export function isDirty(initial: unknown, current: unknown): boolean {
  return JSON.stringify(normalize(initial)) !== JSON.stringify(normalize(current));
}
