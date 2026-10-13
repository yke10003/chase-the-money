import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Scheme } from '@/design/palette';

export const liquidGlass = isLiquidGlassAvailable();

const webBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(32px) saturate(1.8)' } as object) : null;

/** Native liquid glass on iOS 26, and a frosted fallback everywhere else. */
export function GlassSurface({
  children,
  style,
  scheme = 'light',
  tone = 'bar',
  interactive = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  scheme?: Scheme;
  /** `hero` sits on a saturated wash. `bar` sits on the page. */
  tone?: 'bar' | 'hero';
  /** Liquid glass flexes under a finger. Set once; the native view ignores later changes. */
  interactive?: boolean;
}) {
  if (liquidGlass) {
    return (
      <GlassView
        glassEffectStyle={tone === 'hero' ? 'clear' : 'regular'}
        colorScheme={tone === 'hero' ? 'light' : scheme}
        isInteractive={interactive}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  return <View style={[fallback(scheme, tone), style]}>{children}</View>;
}

function fallback(scheme: Scheme, tone: 'bar' | 'hero'): ViewStyle {
  if (tone === 'hero') {
    return {
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.42)',
      ...webBlur,
    };
  }

  const dark = scheme === 'dark';
  const web = Platform.OS === 'web';
  const fill = dark
    ? (web ? 'rgba(28,30,36,0.55)' : 'rgba(28,30,36,0.92)')
    : (web ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.94)');
  const edge = dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.8)';
  const shadow = dark
    ? '0 16px 40px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.2)'
    : '0 12px 32px rgba(28,27,25,0.14), inset 0 1px 0 rgba(255,255,255,0.85)';

  return {
    backgroundColor: fill,
    borderWidth: 1,
    borderColor: edge,
    boxShadow: shadow,
    ...webBlur,
  };
}
