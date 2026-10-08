import { useQuery } from '@tanstack/react-query';
import { Slot, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { getCurrentGoal } from '@/api/endpoints';
import { AppShell, FocusShell } from '@/components/shell';
import { ErrorState } from '@/components/ui';
import { space } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/state/theme';

export default function AppLayout() {
  const { color } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const goal = useQuery({ queryKey: ['goal', 'current'], queryFn: getCurrentGoal });
  const onboarding = pathname === '/onboarding';
  const allowedWithoutGoal = onboarding || pathname === '/settings';
  const redirecting = goal.isSuccess && goal.data === null && !allowedWithoutGoal;

  useEffect(() => {
    if (redirecting) {
      router.replace('/onboarding');
    }
  }, [redirecting, router]);

  if (goal.isLoading || redirecting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: color.paper }}>
        <ActivityIndicator color={color.ink} />
      </View>
    );
  }

  if (goal.isError) {
    return (
      <View style={{ padding: space.xl }}>
        <ErrorState message={errorMessage(goal.error)} onRetry={() => goal.refetch()} />
      </View>
    );
  }

  if (onboarding) {
    return (
      <FocusShell>
        <Slot />
      </FocusShell>
    );
  }

  return (
    <AppShell>
      <Slot />
    </AppShell>
  );
}
