export type EditStep = {
  uri: string;
  kind: 'raw' | 'cut';
  fresh: boolean;
  transparent: boolean;
  background: string;
};

export type EditHistory = {
  steps: EditStep[];
  future: EditStep[];
};

export function seedHistory(steps: EditStep[]): EditHistory {
  return { steps, future: [] };
}

export function currentStep(history: EditHistory): EditStep | null {
  return history.steps[history.steps.length - 1] ?? null;
}

export function canUndo(history: EditHistory): boolean {
  return history.steps.length > 1;
}

export function canRedo(history: EditHistory): boolean {
  return history.future.length > 0;
}

/** Reset drops later steps. Undone steps still in the future are not a reason to reset. */
export function canReset(history: EditHistory): boolean {
  return history.steps.length > 1;
}

export function pushStep(history: EditHistory, step: EditStep): EditHistory {
  return { steps: [...history.steps, step], future: [] };
}

export function undoEdit(history: EditHistory): EditHistory {
  if (!canUndo(history)) {
    return history;
  }

  const steps = history.steps.slice(0, -1);
  const popped = history.steps[history.steps.length - 1];

  return { steps, future: [popped, ...history.future] };
}

export function redoEdit(history: EditHistory): EditHistory {
  const next = history.future[0];

  if (!next) {
    return history;
  }

  return { steps: [...history.steps, next], future: history.future.slice(1) };
}

export function resetEdit(history: EditHistory): EditHistory {
  return { steps: history.steps.slice(0, 1), future: [] };
}

/** A color change keeps the same pixels, including a cutout that has not been saved yet. */
export function recolorStep(history: EditHistory, background: string): EditHistory {
  const current = currentStep(history);
  const next = background.toUpperCase();

  if (!current || current.background.toUpperCase() === next) {
    return history;
  }

  return pushStep(history, { ...current, background: next });
}

export function editIsDirty(current: EditStep | null, saved: { hasEdit: boolean; background: string }): boolean {
  if (!current) {
    return false;
  }

  if (current.fresh) {
    return true;
  }

  if (current.kind === 'raw' && saved.hasEdit) {
    return true;
  }

  return current.transparent && current.background.toUpperCase() !== saved.background.toUpperCase();
}
