import { View } from 'react-native';

import { CreateFrame, useCreationExit } from '@/components/create-flow';
import { Button, T } from '@/components/ui';
import { space } from '@/design/tokens';
import { navigation } from '@/lib/navigation';
import { useTheme } from '@/state/theme';

// A placeholder: there is no product record yet, so there is nothing to save and nothing to guard.
export default function BuildNewScreen() {
  const { accent, color } = useTheme();
  const exit = useCreationExit(false);

  return (
    <CreateFrame title="Add a product" lede="Products aren’t tracked yet." backLabel="Build" onClose={exit.close} accent={accent.build.from}>
      <View style={{ gap: space.md }}>
        <T variant="body" color={color.ink2}>
          There is no product record to create. A name, a stage, and revenue will live here when that exists. Nothing is saved from this screen.
        </T>
        <Button label="Back to Build" tone="secondary" onPress={exit.close} />
        <Button label="Find paid work instead" iconRight="arrowRight" onPress={() => navigation.openTab('freelance')} />
      </View>
    </CreateFrame>
  );
}
