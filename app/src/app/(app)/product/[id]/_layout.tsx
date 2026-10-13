import { Stack } from 'expo-router';

import { useTheme } from '@/state/theme';

export default function ProductLayout() {
  const { color } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen
        name="photos"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: false,
          sheetAllowedDetents: [1],
          sheetExpandsWhenScrolledToEdge: false,
          gestureEnabled: true,
          contentStyle: { backgroundColor: color.paper },
        }}
      />
    </Stack>
  );
}
