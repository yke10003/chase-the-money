import { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Accent } from '@/design/palette';

/** Static wash used on native, and on web until a shader is available. */
export function HeroWash({ paint }: { paint: Accent; wash?: string }) {
  const raw = useId();
  const id = `wash-${raw.replace(/:/g, '')}`;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={paint.mid} />
          <Stop offset="0.45" stopColor={paint.from} />
          <Stop offset="1" stopColor={paint.to} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
