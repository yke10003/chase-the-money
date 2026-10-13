import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { ActivityIndicator, PlatformColor, Pressable, Text, View } from 'react-native';

import { BackgroundSwatches } from '@/components/background-swatches';
import { InlineError } from '@/components/ui';

import { useBackgroundSheet } from '@/lib/sell-background-sheet';

export default function BackgroundSheet() {
  const sheet = useBackgroundSheet();

  if (!sheet) {
    return null;
  }

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Section label="Subject" />
        <SegmentedControl
          values={['Keep the frame', 'Crop to the subject']}
          selectedIndex={sheet.cropToSubject ? 1 : 0}
          enabled={!sheet.applying}
          onChange={(event) => sheet.setCropToSubject(event.nativeEvent.selectedSegmentIndex === 1)}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Section label="Detail" />
        <SegmentedControl
          values={['Full', 'Lighter']}
          selectedIndex={sheet.detail === 'lighter' ? 1 : 0}
          enabled={!sheet.applying}
          onChange={(event) => sheet.setDetail(event.nativeEvent.selectedSegmentIndex === 1 ? 'lighter' : 'full')}
        />
      </View>
      <View style={{ gap: 8 }}>
        <Section label="Background" />
        <BackgroundSwatches value={sheet.background} onChange={sheet.setBackground} />
      </View>
      {sheet.error ? <InlineError message={sheet.error} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: sheet.applying, busy: sheet.applying }}
        disabled={sheet.applying}
        onPress={() => sheet.apply()}
        style={{ minHeight: 50, borderRadius: 14, borderCurve: 'continuous', backgroundColor: PlatformColor('label'), alignItems: 'center', justifyContent: 'center' }}
      >
        {sheet.applying ? <ActivityIndicator color={PlatformColor('systemBackground')} /> : <Text style={{ color: PlatformColor('systemBackground'), fontSize: 17, fontWeight: '600' }}>Remove background</Text>}
      </Pressable>
    </View>
  );
}

function Section({ label }: { label: string }) {
  return <Text style={{ color: PlatformColor('secondaryLabel'), fontSize: 13, fontWeight: '600' }}>{label}</Text>;
}
