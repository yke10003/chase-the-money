import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BloomSplash, useLaunchScheme } from '@/components/bloom-splash';
import { FeedbackProvider } from '@/components/feedback';
import { isCockpitRoot } from '@/components/shell';
import { useLayout } from '@/design/layout';
import { AuthProvider, useAuth } from '@/state/auth';
import { BootProvider, useBoot } from '@/state/boot';
import { createQueryClient } from '@/state/query';
import { ThemeProvider, useTheme } from '@/state/theme';

SplashScreen.setOptions({ duration: 200, fade: true });
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [client] = useState(createQueryClient);

  return (
    <SafeAreaProvider>
      {Platform.OS === 'web' ? (
        <Head>
          <title>Nolume</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        </Head>
      ) : null}
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <AuthProvider>
            <BootProvider>
              <FeedbackProvider>
                <ThemedTree />
              </FeedbackProvider>
            </BootProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function ThemedTree() {
  const { color } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover');
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.paper }}>
      <Gate />
    </GestureHandlerRootView>
  );
}

function Gate() {
  const { scheme } = useTheme();
  const launchScheme = useLaunchScheme();
  const { user, loading } = useAuth();
  const { shellReady } = useBoot();
  const segments = useSegments();
  const pathname = usePathname();
  const phone = useLayout().phone;
  const router = useRouter();
  const onAuthScreen = segments[0] === 'login' || segments[0] === 'register';
  const devBloom = __DEV__ && segments[0] === 'bloom-preview';
  const redirecting = !devBloom && !loading && ((user && onAuthScreen) || (!user && !onAuthScreen));
  const splash = !devBloom && (loading || redirecting || (user != null && !shellReady));
  const immersive = phone && isCockpitRoot(pathname);
  const [hidden, setHidden] = useState(devBloom);
  const [opacity] = useState(() => new Animated.Value(1));
  const visible = splash || !hidden;
  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (loading || devBloom) {
      return;
    }

    if (!user && !onAuthScreen) {
      router.replace('/login');
    }

    if (user && onAuthScreen) {
      router.replace('/');
    }
  }, [loading, user, onAuthScreen, router, devBloom]);

  useEffect(() => {
    if (!splash && !devBloom) {
      hideNativeSplash();
    }
  }, [splash, devBloom, hideNativeSplash]);

  useEffect(() => {
    const timer = setTimeout(hideNativeSplash, 8000);

    return () => clearTimeout(timer);
  }, [hideNativeSplash]);

  useEffect(() => {
    if (splash) {
      opacity.setValue(1);
    }

    if (splash || hidden) {
      return;
    }

    let cancelled = false;
    let fade: Animated.CompositeAnimation | null = null;
    const reducePromise = AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), 300);
    });

    Promise.race([reducePromise, timeout]).then((reduce) => {
      if (cancelled) {
        return;
      }

      if (reduce) {
        setHidden(true);
        return;
      }

      fade = Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: Platform.OS !== 'web',
      });
      fade.start(({ finished }) => {
        if (!cancelled && finished) {
          setHidden(true);
        }
      });
    });

    return () => {
      cancelled = true;
      fade?.stop();
    };
  }, [splash, hidden, opacity]);

  const bloomBar = launchScheme === 'light' ? 'dark' : 'light';
  const onProduct = pathname.startsWith('/product/');
  const bar = visible ? bloomBar : onProduct || immersive || scheme === 'dark' ? 'light' : 'dark';

  return (
    <View style={{ flex: 1 }}>
      {devBloom ? null : <StatusBar style={bar} />}
      <Slot />
      {visible ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: splash ? 1 : opacity, pointerEvents: splash ? 'auto' : 'none' }]}>
          <BloomSplash onReady={hideNativeSplash} />
        </Animated.View>
      ) : null}
    </View>
  );
}
