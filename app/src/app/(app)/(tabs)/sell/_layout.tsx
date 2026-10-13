import { Stack } from 'expo-router';

import { AreaStack } from '@/components/cockpit-shell';

const still = { animation: 'none' as const };

export default function SellLayout() {
  return (
    // The stack's default initial route is its first screen. `index` has to be
    // that screen, or the first visit to Sell opens a nested page.
    // Sell creation is not in this stack. It is the (app) route create/sell.
    <AreaStack initialRouteName="index">
      <Stack.Screen name="index" options={still} />
    </AreaStack>
  );
}
