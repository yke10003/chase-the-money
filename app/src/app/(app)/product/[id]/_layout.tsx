import { Stack } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';

import { photosSheetGestureEnabled } from '@/lib/photos-nav';
import { useTheme } from '@/state/theme';

export default function ProductLayout() {
  const { color } = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen
        name="photos"
        options={({ route }) => ({
          presentation: 'formSheet',
          sheetGrabberVisible: false,
          sheetAllowedDetents: [1],
          sheetExpandsWhenScrolledToEdge: false,
          // Draggable only on the overview. While an editor is open, a drag would target this
          // route and close the editor and Photos together (lib/photos-nav.ts).
          gestureEnabled: photosSheetGestureEnabled(getFocusedRouteNameFromRoute(route)),
          contentStyle: { backgroundColor: color.paper },
        })}
      />
    </Stack>
  );
}
