import { useQuery } from '@tanstack/react-query';
import { Stack, useNavigationContainerRef, usePathname, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect } from 'react';
import { Platform, View } from 'react-native';

import { getCurrentGoal } from '@/api/endpoints';
import { useFeedback } from '@/components/feedback';
import { NativeTabWash } from '@/components/hero-wash-host';
import { AppShell, FocusShell } from '@/components/shell';
import { ErrorState } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { space } from '@/design/tokens';
import { appWrapper, openWithoutGoal, secondaryPresentation } from '@/lib/app-shell';
import { errorMessage } from '@/lib/errors';
import { appFinishTransitioning, appScreenListeners, navLog, useRouteStateLog } from '@/lib/nav-log';
import { appBackAction, navigation } from '@/lib/navigation';
import { useAuth } from '@/state/auth';
import { useBoot } from '@/state/boot';
import { useTheme } from '@/state/theme';

// A cold link to a detail or secondary page still builds the tabs, and the
// cockpit, underneath it. Close then reveals that shell instead of nothing.
export const unstable_settings = { anchor: '(tabs)' };

// The native signal that a present or dismiss on this stack has finished.
// navigation.ts waits for it between closing one top-level modal and opening the next.
function stackFinished() {
  appFinishTransitioning();
  navigation.nativeSettled();
}

export default function AppLayout() {
  const { user, loading } = useAuth();
  const { markReady } = useBoot();
  const pathname = usePathname();
  const router = useRouter();
  const goal = useQuery({
    queryKey: ['goal', 'current'],
    queryFn: getCurrentGoal,
    enabled: !loading && user != null,
  });
  const phone = useLayout().phone;
  const { color } = useTheme();
  const redirecting = goal.isSuccess && goal.data === null && !openWithoutGoal(pathname);
  const settled = goal.isSuccess || goal.isError;
  const wrapper = appWrapper({ os: Platform.OS, phone, pathname });
  const topLevel = secondaryPresentation(Platform.OS, phone);
  const creationOptions = {
    presentation: topLevel.presentation,
    animation: topLevel.animation,
    contentStyle: { backgroundColor: topLevel.presentation === 'fullScreenModal' ? color.paper : 'transparent' },
  } as const;
  const containerRef = useNavigationContainerRef();
  const feedback = useFeedback();

  useRouteStateLog();

  // A layout effect, so it is attached before any screen's mount effect asks it to navigate.
  useLayoutEffect(() => {
    const detach = navigation.attach({
      getRootState: () => (containerRef.isReady() ? containerRef.getRootState() : undefined),
      // Targeted at the (app) navigator: closing a top-level experience must not pop a page inside it.
      back: () => {
        const action = appBackAction(containerRef.isReady() ? containerRef.getRootState() : undefined);

        if (action == null) {
          router.back();
          return;
        }

        containerRef.dispatch(action);
      },
      push: (href) => router.push(href),
      dismissTo: (href) => router.dismissTo(href),
      setParams: (params) => router.setParams(params),
      notify: (message) => feedback({ title: message }),
      log: navLog,
      nativeSettle: Platform.OS === 'ios',
    });
    const unsubscribe = containerRef.addListener('state', () => navigation.stateChanged());

    return () => {
      unsubscribe();
      detach();
    };
  }, [containerRef, feedback, router]);

  // A different wrapper element remounts the whole (app) stack, cockpit included.
  useEffect(() => {
    navLog('app.wrapper', { wrapper, path: pathname });
  }, [wrapper]);

  useEffect(() => {
    if (redirecting) {
      router.replace('/onboarding');
    }
  }, [redirecting, router]);

  useEffect(() => {
    if (loading || !user || !settled || redirecting) {
      return;
    }

    markReady();
  }, [loading, user, settled, redirecting, markReady]);

  // Screens under here fire their own requests. Wait until the token is loaded
  // and /me has succeeded, or the first launch 401s and sticks (retry is off).
  if (loading || user == null) {
    return null;
  }

  if (goal.isError) {
    return (
      <View style={{ padding: space.xl }}>
        <ErrorState message={errorMessage(goal.error)} onRetry={() => goal.refetch()} />
      </View>
    );
  }

  const stack = (
    <Stack
      // The shader lives behind this navigator. An opaque stack container
      // covers it on every main page.
      unstable_nativeProps={{
        nativeContainerStyle: { backgroundColor: 'transparent' },
        onFinishTransitioning: stackFinished,
      }}
      screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      screenListeners={__DEV__ ? appScreenListeners : undefined}
    >
      <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen
        name="product/[id]"
        // A second push of the same item moves it to the top instead of stacking a duplicate. The coordinator
        // already ignores that request, so this only covers links that do not go through it.
        dangerouslySingular
        options={{
          presentation: Platform.OS === 'ios' ? 'fullScreenModal' : 'card',
          animation: Platform.OS === 'ios' ? 'slide_from_bottom' : 'fade',
          gestureEnabled: true,
          contentStyle: { backgroundColor: color.paper },
        }}
      />
      <Stack.Screen
        name="(secondary)"
        options={{
          presentation: topLevel.presentation,
          animation: topLevel.animation,
          contentStyle: { backgroundColor: topLevel.presentation === 'fullScreenModal' ? color.paper : 'transparent' },
        }}
      />
      <Stack.Screen name="create/sell" options={creationOptions} />
      {/* Single-screen creation forms. Same presentation as Sell creation, one route each. */}
      <Stack.Screen name="create/freelance" options={creationOptions} />
      <Stack.Screen name="create/recover" options={creationOptions} />
      <Stack.Screen name="create/build" options={creationOptions} />
    </Stack>
  );
  const shell = wrapper === 'FocusShell' ? (
    <FocusShell>
      {stack}
    </FocusShell>
  ) : wrapper === 'NativeTabWash' ? (
    <NativeTabWash>
      {stack}
    </NativeTabWash>
  ) : (
    <AppShell>
      {stack}
    </AppShell>
  );

  return <View style={{ flex: 1 }}>{shell}</View>;
}
