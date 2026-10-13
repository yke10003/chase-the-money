import { usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useWindowDimensions, View, type View as ViewType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroWash } from '@/components/hero-wash';
import { useLayout } from '@/design/layout';
import type { Accent } from '@/design/palette';
import { cockpitArea } from '@/lib/cockpit-scene';
import { useReduceMotion } from '@/lib/motion';

/** Home greens, so the shader can boot before the first screen reports a color. */
const INITIAL_PAINT: Accent = { from: '#0F6B45', to: '#063526', mid: '#3DDC97', on: '#F4FFF8' };

export type HeroBox = { x: number; y: number; width: number; height: number };

type Host = {
  contentRef: RefObject<ViewType | null>;
  reportPaint: (paint: Accent) => void;
  reportBox: (box: HeroBox) => void;
};

type Shown = { paint: Accent | null; box: HeroBox | null };

const HeroWashContext = createContext<Host | null>(null);
const ShownContext = createContext<Shown>({ paint: null, box: null });

const COLOR_MS = 520;

export function HeroWashProvider({ children }: { children: ReactNode }) {
  const reduce = useReduceMotion();
  const contentRef = useRef<ViewType>(null);
  const shownRef = useRef<Accent | null>(null);
  const frameRef = useRef(0);
  const [shown, setShown] = useState<Accent>(INITIAL_PAINT);
  shownRef.current = shownRef.current ?? INITIAL_PAINT;
  const [box, setBox] = useState<HeroBox | null>(null);

  const reportPaint = useCallback((next: Accent) => {
    const current = shownRef.current;

    if (!current || reduce) {
      shownRef.current = next;
      setShown(next);
      return;
    }

    if (sameAccent(current, next)) {
      return;
    }

    const from = current;
    const start = performance.now();
    cancelAnimationFrame(frameRef.current);

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / COLOR_MS);
      const eased = 1 - (1 - t) ** 3;
      const mixed = mixAccent(from, next, eased);
      shownRef.current = mixed;
      setShown(mixed);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);
  }, [reduce]);

  const reportBox = useCallback((next: HeroBox) => {
    setBox((current) => {
      if (current && current.x === next.x && current.y === next.y && current.width === next.width && current.height === next.height) {
        return current;
      }

      return next;
    });
  }, []);

  const host = useMemo(() => ({ contentRef, reportPaint, reportBox }), [reportPaint, reportBox]);
  const shownValue = useMemo(() => ({ paint: shown, box }), [shown, box]);

  return (
    <HeroWashContext.Provider value={host}>
      <ShownContext.Provider value={shownValue}>
        {children}
      </ShownContext.Provider>
    </HeroWashContext.Provider>
  );
}

/**
 * One wash for every section. Place it inside the scrolling content the hero is measured against.
 * `always` keeps it painted behind the iOS tabs, which stay mounted under every modal page.
 */
export function HeroWashSlot({ fill = false, always = false }: { fill?: boolean; always?: boolean }) {
  const { paint, box } = useContext(ShownContext);
  const phone = useLayout().phone;
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const visible = always || cockpitArea(pathname) != null || pathname.startsWith('/product/');
  const frame = box ?? (phone ? { x: 0, y: 0, width, height: fill ? height : 400 + insets.top } : null);

  if (!paint || !frame) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        overflow: 'hidden',
        borderRadius: phone ? 0 : 28,
        zIndex: 0,
        opacity: visible ? 1 : 0,
      }}
    >
      <HeroWash paint={paint} />
    </View>
  );
}

export function useHeroWashHost(): Host | null {
  return useContext(HeroWashContext);
}

/** One shader for the iOS tabs, so changing tabs crossfades the color instead of mounting a new one. */
export function NativeTabWash({ children }: { children: ReactNode }) {
  return (
    <HeroWashProvider>
      <TabWashFrame>{children}</TabWashFrame>
    </HeroWashProvider>
  );
}

function TabWashFrame({ children }: { children: ReactNode }) {
  const host = useHeroWashHost();

  return (
    <View ref={host?.contentRef} style={{ flex: 1 }} collapsable={false}>
      <HeroWashSlot fill always />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function sameAccent(a: Accent, b: Accent): boolean {
  return a.from === b.from && a.to === b.to && a.mid === b.mid && a.on === b.on;
}

function mixAccent(from: Accent, to: Accent, t: number): Accent {
  return {
    from: mixHex(from.from, to.from, t),
    to: mixHex(from.to, to.to, t),
    mid: mixHex(from.mid, to.mid, t),
    on: mixHex(from.on, to.on, t),
  };
}

function mixHex(from: string, to: string, t: number): string {
  const start = channels(from);
  const end = channels(to);
  const mixed = start.map((value, index) => Math.round(value + (end[index] - value) * t));

  return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function channels(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;

  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}
