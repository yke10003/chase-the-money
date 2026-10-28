import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from '@/components/feedback';
import { isCockpitRoot } from '@/components/shell';
import { useLayout } from '@/design/layout';
import { appWrapper } from '@/lib/app-shell';
import { navLog, startNavLog } from '@/lib/nav-log';
import { AuthProvider, useAuth } from '@/state/auth';
import { BootProvider, useBoot } from '@/state/boot';
import { createQueryClient } from '@/state/query';
import { ThemeProvider, useTheme } from '@/state/theme';

/** Matches `SplashScreen.setOptions`. */
const SPLASH_FADE_MS = 200;
/**
 * `hideAsync` returns as soon as the hide is queued. UIKit starts the fade on
 * the next turn, then takes `SPLASH_FADE_MS` to remove the loading view.
 * The sheet sits above that view, so it waits until the fade has finished.
 */
const SPLASH_RELEASE_MS = SPLASH_FADE_MS + 50;
/** The wash may load slowly. This releases the splash. It does not count as a painted frame. */
const WASH_GIVE_UP_MS = 4000;
/** Last resort if auth or the goal request never settles. */
const SPLASH_SAFETY_MS = 8000;

SplashScreen.setOptions({ duration: SPLASH_FADE_MS, fade: true });
SplashScreen.preventAutoHideAsync().catch(() => {});
startNavLog();

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
              {/* On iOS phone the cockpit form sheet covers the bottom of this view. */}
              <FeedbackProvider placement={Platform.OS === 'ios' ? 'top' : 'bottom'}>
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
  const { user, loading } = useAuth();
  const { shellReady, washReady, revealCockpit } = useBoot();
  const segments = useSegments();
  const pathname = usePathname();
  const phone = useLayout().phone;
  const router = useRouter();
  const onAuthScreen = segments[0] === 'login' || segments[0] === 'register';
  const devBloom = __DEV__ && segments[0] === 'bloom-preview';
  const redirecting = !devBloom && !loading && ((user && onAuthScreen) || (!user && !onAuthScreen));
  const washExpected = user != null && appWrapper({ os: Platform.OS, phone, pathname }) === 'NativeTabWash';
  const [washGaveUp, setWashGaveUp] = useState(false);
  const [forced, setForced] = useState(false);
  const userId = user?.id ?? null;
  const hold = !devBloom && !forced && (loading || redirecting || (user != null && !shellReady) || (washExpected && !washReady && !washGaveUp));
  const immersive = phone && isCockpitRoot(pathname);
  const dismissed = useRef(false);

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
    setWashGaveUp(false);
  }, [userId]);

  useEffect(() => {
    if (!hold) {
      return;
    }

    navLog('splash.hold', {
      loading,
      redirecting,
      shell: shellReady,
      wash: washExpected ? washReady : 'skip',
      gaveUp: washGaveUp,
    });
  }, [hold, loading, redirecting, shellReady, washExpected, washReady, washGaveUp]);

  useEffect(() => {
    if (!washExpected || washReady || washGaveUp) {
      return;
    }

    const timer = setTimeout(() => {
      navLog('wash.timeout', { ms: WASH_GIVE_UP_MS });
      setWashGaveUp(true);
    }, WASH_GIVE_UP_MS);

    return () => clearTimeout(timer);
  }, [washExpected, washReady, washGaveUp]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (dismissed.current) {
        return;
      }

      navLog('splash.safety', { ms: SPLASH_SAFETY_MS });
      setForced(true);
    }, SPLASH_SAFETY_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (devBloom) {
      SplashScreen.hideAsync().catch(() => {});
      return;
    }

    if (hold || dismissed.current) {
      return;
    }

    dismissed.current = true;
    navLog('splash.hide', { wash: washReady, gaveUp: washGaveUp, forced });
    SplashScreen.hideAsync().catch(() => {});
    let revealed = false;
    const timer = setTimeout(() => {
      revealed = true;
      navLog('splash.dismissed');
      revealCockpit();
    }, SPLASH_RELEASE_MS);

    return () => {
      clearTimeout(timer);

      if (!revealed) {
        dismissed.current = false;
      }
    };
  }, [hold, devBloom, washReady, washGaveUp, forced, revealCockpit]);

  const onProduct = pathname.startsWith('/product/');
  const bar = onProduct || immersive || scheme === 'dark' ? 'light' : 'dark';

  return (
    <View style={{ flex: 1 }}>
      {devBloom ? null : <StatusBar style={bar} />}
      <Slot />
    </View>
  );
}
