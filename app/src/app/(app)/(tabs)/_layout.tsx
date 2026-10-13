import { Slot } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { CockpitShell } from '@/components/cockpit-shell';
import { homePaint } from '@/components/score-hero';
import { useLayout } from '@/design/layout';
import type { Scheme } from '@/design/palette';
import { useTheme } from '@/state/theme';

/** The brighter wash stop reads on dark glass. The deeper stop reads on light glass. */
function tabColor(scheme: Scheme, paint: { from: string; mid: string }) {
  return scheme === 'dark' ? paint.mid : paint.from;
}

export default function TabsLayout() {
  const phone = useLayout().phone;
  const { color, accent, scheme } = useTheme();

  // iOS uses the system tab bar, which is the liquid-glass bar you can press,
  // hold, and drag. Android and desktop keep the shell around a plain slot.
  if (Platform.OS !== 'ios' || !phone) {
    return <Slot />;
  }

  const home = tabColor(scheme, homePaint);
  const sell = tabColor(scheme, accent.sell);
  const freelance = tabColor(scheme, accent.earn);
  const build = tabColor(scheme, accent.build);
  const recover = tabColor(scheme, accent.recover);

  return (
    <CockpitShell>
    <NativeTabs
      tintColor={color.ink}
      iconColor={color.ink}
      labelStyle={{ color: color.ink }}
      unstable_nativeProps={{ nativeContainerStyle: { backgroundColor: 'transparent' } }}
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets contentStyle={{ backgroundColor: 'transparent' }}>
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} selectedColor={home} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sell" disableAutomaticContentInsets contentStyle={{ backgroundColor: 'transparent' }}>
        <NativeTabs.Trigger.Label>Sell</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} selectedColor={sell} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="freelance" disableAutomaticContentInsets contentStyle={{ backgroundColor: 'transparent' }}>
        <NativeTabs.Trigger.Label>Freelance</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'briefcase', selected: 'briefcase.fill' }} selectedColor={freelance} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="build" disableAutomaticContentInsets contentStyle={{ backgroundColor: 'transparent' }}>
        <NativeTabs.Trigger.Label>Build</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'hammer', selected: 'hammer.fill' }} selectedColor={build} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="recover" disableAutomaticContentInsets contentStyle={{ backgroundColor: 'transparent' }}>
        <NativeTabs.Trigger.Label>Recover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="eurosign.arrow.trianglehead.counterclockwise.rotate.90" selectedColor={recover} />
      </NativeTabs.Trigger>
    </NativeTabs>
    </CockpitShell>
  );
}
