import { Slot, Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useLayout } from '@/design/layout';
import { useTheme } from '@/state/theme';

/**
 * Sell creation: Category, Already listed, and the setup steps.
 *
 * On iOS phone the (app) stack presents this whole group as one fullScreenModal
 * over the cockpit. Category replaces itself with setup/[id] inside this stack,
 * so the modal stays up while the draft gets its id. Setup steps are local
 * state in setup/[id]. Nothing in here presents another top-level modal.
 *
 * Everywhere else AppShell draws the page and this is a plain slot.
 */
export default function SellCreationLayout() {
  const phone = useLayout().phone;
  const { color } = useTheme();

  if (Platform.OS !== 'ios' || !phone) {
    return <Slot />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: color.paper } }} />;
}
