import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/state/auth';

type Boot = {
  /** The signed-in shell has a goal result, so the splash can come down. */
  shellReady: boolean;
  markReady: () => void;
};

const BootContext = createContext<Boot | null>(null);

export function BootProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const [readyFor, setReadyFor] = useState<number | null>(null);
  const markReady = useCallback(() => {
    setReadyFor(userIdRef.current);
  }, []);
  const shellReady = userId != null && readyFor === userId;
  const value = useMemo(() => ({ shellReady, markReady }), [shellReady, markReady]);

  return <BootContext.Provider value={value}>{children}</BootContext.Provider>;
}

export function useBoot(): Boot {
  const value = useContext(BootContext);

  if (!value) {
    throw new Error('useBoot must be used inside BootProvider');
  }

  return value;
}
