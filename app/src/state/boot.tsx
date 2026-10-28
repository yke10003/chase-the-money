import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

import { navLog } from '@/lib/nav-log';
import { useAuth } from '@/state/auth';

type Boot = {
  /** The signed-in shell has a goal result, so the splash can come down. */
  shellReady: boolean;
  /** The cockpit wash has painted its first frame. A timeout does not set this. */
  washReady: boolean;
  /** The native splash has finished leaving, so the cockpit sheet may present. */
  cockpitRevealed: boolean;
  markReady: () => void;
  markWashReady: () => void;
  revealCockpit: () => void;
};

const BootContext = createContext<Boot | null>(null);

export function BootProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const [readyFor, setReadyFor] = useState<number | null>(null);
  const [washFor, setWashFor] = useState<number | null>(null);
  const [cockpitRevealed, setCockpitRevealed] = useState(false);
  const washLogged = useRef<number | null>(null);
  const markReady = useCallback(() => {
    setReadyFor(userIdRef.current);
  }, []);
  const markWashReady = useCallback(() => {
    const id = userIdRef.current;

    if (id == null || washLogged.current === id) {
      return;
    }

    washLogged.current = id;
    navLog('wash.frame');
    setWashFor(id);
  }, []);
  const revealCockpit = useCallback(() => {
    setCockpitRevealed(true);
  }, []);
  const shellReady = userId != null && readyFor === userId;
  const washReady = userId != null && washFor === userId;
  const value = useMemo(
    () => ({ shellReady, washReady, cockpitRevealed, markReady, markWashReady, revealCockpit }),
    [shellReady, washReady, cockpitRevealed, markReady, markWashReady, revealCockpit],
  );

  return <BootContext.Provider value={value}>{children}</BootContext.Provider>;
}

export function useBoot(): Boot {
  const value = useContext(BootContext);

  if (!value) {
    throw new Error('useBoot must be used inside BootProvider');
  }

  return value;
}
