import { Stack } from 'expo-router';

import { AreaStack } from '@/components/cockpit-shell';

// These routes only fill the cover sheet. A stack push here would slide the
// overview away underneath that sheet.
const still = { animation: 'none' as const };

export default function SellLayout() {
  return (
    // The stack's default initial route is its first screen. `index` has to be
    // that screen, or the first visit to Sell opens "What kind of thing are you selling?".
    <AreaStack initialRouteName="index">
      <Stack.Screen name="index" options={still} />
      <Stack.Screen name="new" options={still} />
      <Stack.Screen name="listed" options={still} />
      <Stack.Screen name="setup/[id]" options={still} />
    </AreaStack>
  );
}
