import { useRef, useState } from 'react';
import { Appearance, Image, StyleSheet, View, useColorScheme } from 'react-native';

import type { Scheme } from '@/design/palette';

export function useLaunchScheme(): Scheme | null {
  const os = useColorScheme() ?? Appearance.getColorScheme();
  const resolved = os === 'light' || os === 'dark' ? os : null;
  const [locked, setLocked] = useState<Scheme | null>(resolved);

  if (locked == null && resolved != null) {
    setLocked(resolved);
  }

  return locked;
}

/** Keep in sync with expo-splash-screen imageWidth in app.json. */
export const SPLASH_SIDE = 192;

/** App paper colors, so the splash and the first screen share a ground. */
const BACKGROUND: Record<Scheme, string> = {
  dark: '#131315',
  light: '#F5F5F7',
};

const LOCKUP: Record<Scheme, number> = {
  dark: require('../../assets/branding/splash-lockup-dark.png'),
  light: require('../../assets/branding/splash-lockup-light.png'),
};

export function BloomSplash({ onReady }: { onReady?: () => void }) {
  const scheme = useLaunchScheme();
  const background = BACKGROUND[scheme ?? 'dark'];
  const signaled = useRef(false);

  function signalReady() {
    if (signaled.current) {
      return;
    }

    signaled.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onReady?.();
      });
    });
  }

  return (
    <View style={[styles.fill, { backgroundColor: background }]}>
      {scheme ? (
        <View style={styles.stage}>
          <Image
            source={LOCKUP[scheme]}
            fadeDuration={0}
            resizeMode="contain"
            accessibilityLabel="Nolume."
            accessible={false}
            onLoad={signalReady}
            onError={signalReady}
            style={styles.lockup}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: {
    width: SPLASH_SIDE,
    height: SPLASH_SIDE,
  },
});
