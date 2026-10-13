import { Image, Text, View } from 'react-native';

import { BloomAnimation } from '@/components/bloom-animation';
import type { Scheme } from '@/design/palette';
import { serifFont } from '@/design/tokens';

const bloom = require('../../assets/bloom-logo.png');

export function BrandMark({ color, compact = false, stacked = false, bloomScheme }: { color: string; compact?: boolean; stacked?: boolean; bloomScheme?: Scheme }) {
  const size = stacked ? 160 : compact ? 32 : 28;

  return (
    <View style={{ flexDirection: stacked ? 'column' : 'row', alignItems: 'center', gap: stacked ? 0 : 8 }}>
      {stacked && bloomScheme ? (
        <BloomAnimation scheme={bloomScheme} style={{ width: size, height: size }} />
      ) : (
        <Image source={bloom} accessibilityLabel={compact ? 'Nolume' : ''} style={{ width: size, height: size }} />
      )}
      {compact ? null : (
        <Text style={{ fontFamily: serifFont, fontSize: stacked ? 36 : 22, letterSpacing: stacked ? -0.4 : -0.2, marginTop: stacked ? -Math.round(size * 0.19) : 0, color }}>Nolume</Text>
      )}
    </View>
  );
}
