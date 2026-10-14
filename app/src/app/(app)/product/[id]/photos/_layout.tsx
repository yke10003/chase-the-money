import { Stack } from 'expo-router';

import { photosStackGestures } from '@/lib/photos-nav';
import { useTheme } from '@/state/theme';

/**
 * Pushes inside the Photos sheet, so Edit stays above the list instead of replacing it.
 * No screen here pops by swipe. Editors leave through Back/Close only (lib/photos-nav.ts).
 */
export default function PhotosLayout() {
  const { color } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="index" options={{ animation: 'none', ...photosStackGestures }} />
      <Stack.Screen name="edit" options={{ animation: 'slide_from_right', ...photosStackGestures }} />
      <Stack.Screen name="collage" options={{ animation: 'slide_from_right', ...photosStackGestures }} />
    </Stack>
  );
}
