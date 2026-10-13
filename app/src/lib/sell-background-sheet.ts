import { useSyncExternalStore } from 'react';

export type BackgroundSheetState = {
  cropToSubject: boolean;
  setCropToSubject: (value: boolean) => void;
  detail: 'full' | 'lighter';
  setDetail: (value: 'full' | 'lighter') => void;
  background: string;
  setBackground: (value: string) => void;
  applying: boolean;
  error: string | null;
  apply: () => void;
};

let current: BackgroundSheetState | null = null;
const listeners = new Set<() => void>();

export function publishBackgroundSheet(next: BackgroundSheetState | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function useBackgroundSheet() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current,
  );
}
