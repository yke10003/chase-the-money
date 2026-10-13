import { Slot, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedbackProvider } from '@/components/feedback';
import { GlassClose, GlassIconButton } from '@/components/glass-close';
import { useLayout } from '@/design/layout';
import { space } from '@/design/tokens';
import { navRequest } from '@/lib/nav-log';
import { useTheme } from '@/state/theme';

type FrameNavigation = {
  goBack: () => void;
  getState: () => { routes: { key: string }[] };
  getParent: () => { goBack: () => void } | undefined;
};

/**
 * Profile, Progress, All activity, custom missions and mission detail.
 *
 * On iOS phone this whole group is one fullScreenModal over the cockpit (see
 * the (app) layout). Pages opened from here are pushes inside it, so Back stays
 * in the group and Close removes exactly one native modal. Removing two modals
 * in one update orphans a controller (navigation.md, E3).
 *
 * Everywhere else AppShell draws the page and this is a plain slot.
 */
export default function SecondaryLayout() {
  const phone = useLayout().phone;
  const { color } = useTheme();

  if (Platform.OS !== 'ios' || !phone) {
    return <Slot />;
  }

  return (
    // The app-wide toast renders under this native modal, so the modal needs its own.
    <FeedbackProvider>
      <Stack
        screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: color.paper } }}
        screenLayout={({ children, navigation, route }) => (
          <SecondaryFrame navigation={navigation as FrameNavigation} routeKey={route.key} routeName={route.name}>
            {children}
          </SecondaryFrame>
        )}
      />
    </FeedbackProvider>
  );
}

function SecondaryFrame({ navigation, routeKey, routeName, children }: { navigation: FrameNavigation; routeKey: string; routeName: string; children: ReactNode }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const first = navigation.getState().routes[0]?.key === routeKey;

  function close() {
    navRequest('secondary.close.request', { route: routeName });
    navigation.getParent()?.goBack();
  }

  function back() {
    navRequest('secondary.back.request', { route: routeName });
    navigation.goBack();
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: space.md, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: space.sm }}>
          {first ? <GlassClose onPress={close} /> : <GlassIconButton systemName="chevron.left" icon="arrowLeft" label="Back" onPress={back} />}
          {first ? null : <GlassClose onPress={close} />}
        </View>
        {children}
      </ScrollView>
    </View>
  );
}
