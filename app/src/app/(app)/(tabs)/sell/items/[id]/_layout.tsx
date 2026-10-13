import { Stack } from 'expo-router';

import { useTheme } from '@/state/theme';

export default function ItemLayout() {
  const { color } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.paper },
      }}
    >
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
