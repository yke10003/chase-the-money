import { Stack } from 'expo-router';

import { useTheme } from '@/state/theme';

/** Pushes inside the Photos sheet, so Edit stays above the list instead of replacing it. */
export default function PhotosLayout() {
  const { color } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="edit" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="collage" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="background"
        options={{
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          sheetAllowedDetents: 'fitToContents',
          sheetExpandsWhenScrolledToEdge: false,
          contentStyle: { backgroundColor: color.paper },
        }}
      />
    </Stack>
  );
}
