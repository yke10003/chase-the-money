import { useQuery } from '@tanstack/react-query';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { getCurrentGoal } from '@/api/endpoints';
import { NativeTabWash } from '@/components/hero-wash-host';
import { AppShell, FocusShell, keepsNativeTabs } from '@/components/shell';
import { ErrorState } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { space } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { appFinishTransitioning, appScreenListeners, navLog, useRouteStateLog } from '@/lib/nav-log';
import { useAuth } from '@/state/auth';
import { useBoot } from '@/state/boot';
import { useTheme } from '@/state/theme';

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
  const onboarding = pathname === '/onboarding';
  const nativeTabs = Platform.OS === 'ios' && phone && keepsNativeTabs(pathname);
  const allowedWithoutGoal = onboarding || pathname === '/settings';
  const redirecting = goal.isSuccess && goal.data === null && !allowedWithoutGoal;
  const settled = goal.isSuccess || goal.isError;
  const wrapper = onboarding ? 'FocusShell' : nativeTabs ? 'NativeTabWash' : 'AppShell';

  useRouteStateLog();

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
        onFinishTransitioning: __DEV__ ? appFinishTransitioning : undefined,
      }}
      screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      screenListeners={__DEV__ ? appScreenListeners : undefined}
    >
      <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: 'transparent' } }} />
      <Stack.Screen
        name="product/[id]"
        options={{
          presentation: Platform.OS === 'ios' ? 'fullScreenModal' : 'card',
          animation: Platform.OS === 'ios' ? 'slide_from_bottom' : 'fade',
          gestureEnabled: true,
          contentStyle: { backgroundColor: color.paper },
        }}
      />
    </Stack>
  );
  const shell = onboarding ? (
    <FocusShell>
      {stack}
    </FocusShell>
  ) : nativeTabs ? (
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
