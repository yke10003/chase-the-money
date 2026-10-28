import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import HeroShader from '@/components/hero-shader';
import { useLayout } from '@/design/layout';
import type { Accent, Scheme } from '@/design/palette';
import { navLog } from '@/lib/nav-log';
import { useReduceMotion } from '@/lib/motion';
import { useBoot } from '@/state/boot';
import { useTheme } from '@/state/theme';

/** Same corner as the hero card. Phone heroes are square to the screen edge. */
const HERO_CORNER = 28;

/**
 * Fourth stop of each effects-lab preset. Iridescence multiplies the rainbow by this color.
 * Dark and light match the lab's Dark and Light presets for that screen.
 */
const IRI: Record<Scheme, Record<string, string>> = {
  dark: {
    home: '#15744d',
    sell: '#c26724',
    earn: '#3445af',
    build: '#7135d4',
    recover: '#148179',
    save: '#7135d4',
  },
  light: {
    home: '#33c385',
    sell: '#e6954c',
    earn: '#5f76e5',
    build: '#9a75f3',
    recover: '#33bcb2',
    save: '#9a75f3',
  },
};

export function iridescenceColor(wash: string, scheme: Scheme): string {
  return IRI[scheme][wash] ?? IRI[scheme].home;
}

export function HeroWash({
  paint,
  wash,
  color,
  signalsBoot = false,
}: {
  paint: Accent;
  wash?: string;
  /** Crossfaded lab tint. Tiles look their own color up from `wash`. */
  color?: string;
  signalsBoot?: boolean;
}) {
  const phone = useLayout().phone;
  const reduce = useReduceMotion();
  const { scheme } = useTheme();
  const { markWashReady } = useBoot();
  const tint = color ?? iridescenceColor(wash ?? 'home', scheme);

  useEffect(() => {
    if (signalsBoot) {
      navLog('wash.mount');
    }
  }, [signalsBoot]);

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', overflow: 'hidden' }]}>
      <HeroShader
        from={tint}
        to={paint.to}
        mid={paint.mid}
        onColor={paint.on}
        corner={phone ? 0 : HERO_CORNER}
        reduce={reduce}
        onDrawn={signalsBoot ? markWashReady : undefined}
        dom={{
          pointerEvents: 'none',
          scrollEnabled: false,
          bounces: false,
          showsHorizontalScrollIndicator: false,
          showsVerticalScrollIndicator: false,
          style: { flex: 1, backgroundColor: 'transparent' },
          containerStyle: { flex: 1, backgroundColor: 'transparent' },
        }}
      />
    </View>
  );
}
