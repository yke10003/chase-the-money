import { StyleSheet, View } from 'react-native';

import HeroShader from '@/components/hero-shader';
import { useLayout } from '@/design/layout';
import type { Accent } from '@/design/palette';
import { useReduceMotion } from '@/lib/motion';

/** Same corner as the hero card. Phone heroes are square to the screen edge. */
const HERO_CORNER = 28;

export function HeroWash({ paint }: { paint: Accent; wash?: string }) {
  const phone = useLayout().phone;
  const reduce = useReduceMotion();

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', overflow: 'hidden' }]}>
      <HeroShader
        from={paint.from}
        to={paint.to}
        mid={paint.mid}
        onColor={paint.on}
        corner={phone ? 0 : HERO_CORNER}
        reduce={reduce}
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
