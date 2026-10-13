import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { CreateFrame } from '@/components/create-flow';
import { Button, T } from '@/components/ui';
import { space } from '@/design/tokens';
import { useTheme } from '@/state/theme';

export default function BuildNewScreen() {
  const { accent, color } = useTheme();
  const router = useRouter();

  return (
    <CreateFrame title="Add a product" lede="Products aren’t tracked yet." backHref="/build" backLabel="Build" accent={accent.build.from}>
      <View style={{ gap: space.md }}>
        <T variant="body" color={color.ink2}>
          There is no product record to create. A name, a stage, and revenue will live here when that exists. Nothing is saved from this screen.
        </T>
        <Button label="Back to Build" tone="secondary" onPress={() => router.push('/build')} />
        <Button label="Find paid work instead" iconRight="arrowRight" onPress={() => router.push('/freelance')} />
      </View>
    </CreateFrame>
  );
}
