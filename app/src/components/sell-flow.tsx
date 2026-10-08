import { useRouter } from 'expo-router';
import { createElement, type DragEvent, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { JOURNEY, journeyIndex } from '@/lib/sell';
import { useTheme } from '@/state/theme';

const ICONS: Record<string, IconName> = {
  armchair: 'armchair',
  arrowsClockwise: 'arrowsClockwise',
  barcode: 'barcode',
  bicycle: 'bicycle',
  camera: 'camera',
  coins: 'coins',
  deviceMobile: 'deviceMobile',
  image: 'image',
  package: 'package',
  plug: 'plug',
  ruler: 'ruler',
  sneaker: 'sneaker',
  tag: 'tag',
  tshirt: 'tshirt',
  warning: 'warning',
  watch: 'watch',
  wrench: 'wrench',
};

export function sellIcon(name: string): IconName {
  return ICONS[name] ?? 'camera';
}

export function SellJourney({
  step,
  title,
  lede,
  onBack,
  onExit,
  children,
  footer,
}: {
  step: string;
  title: string;
  lede?: string;
  onBack?: () => void;
  onExit: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { color, type: typeScale } = useTheme();
  const phone = useLayout().phone;
  const insets = useSafeAreaInsets();
  const index = journeyIndex(step);
  const header = (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={onBack ? 'Back' : 'Close'} onPress={onBack ?? onExit} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={onBack ? 'arrowLeft' : 'x'} size={20} color={color.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onExit} hitSlop={8}>
          <Text style={{ fontFamily: font.medium, fontSize: 15, color: color.ink2 }}>Save & exit</Text>
        </Pressable>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel={`Step ${index + 1} of ${JOURNEY.length}`} style={{ flexDirection: 'row', gap: 4 }}>
        {JOURNEY.map((item, itemIndex) => (
          <View key={item} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: itemIndex <= index ? color.ink : color.line }} />
        ))}
      </View>
      <View style={{ gap: 6 }}>
        <Text style={[typeScale.title, { fontSize: phone ? 32 : 36, lineHeight: phone ? 36 : 40 }]}>{title}</Text>
        {lede ? <Text style={[typeScale.body, { color: color.ink2 }]}>{lede}</Text> : null}
      </View>
    </View>
  );

  if (phone) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: space.lg }} keyboardShouldPersistTaps="handled">
          {header}
          {children}
        </ScrollView>
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: color.line }}>{footer}</View> : null}
      </View>
    );
  }

  return (
    <View style={{ width: '100%', maxWidth: 760, alignSelf: 'center', gap: space.lg, paddingBottom: 48 }}>
      {header}
      {children}
      {footer}
    </View>
  );
}

export function ChoiceBlock({
  label,
  detail,
  icon,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  icon?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { color, typeColor } = useTheme();
  const sell = typeColor.sell;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(state) => [
        {
          minHeight: 72,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: selected ? sell.base : color.line,
          backgroundColor: selected ? sell.soft : color.surface,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        (state as { hovered?: boolean }).hovered && !selected ? { borderColor: color.ink3 } : null,
      ]}
    >
      {icon ? <Icon name={sellIcon(icon)} size={26} color={selected ? sell.ink : color.ink2} weight="duotone" /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, color: selected ? sell.ink : color.ink }}>{label}</Text>
        {detail ? <Text style={{ fontSize: 13, color: color.ink3 }}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

export function DropSurface({ onFile, children }: { onFile: (file: File) => void; children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }

  return createElement(
    'div',
    {
      onDragOver: (event: DragEvent) => event.preventDefault(),
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        const file = event.dataTransfer?.files?.[0];

        if (file) {
          onFile(file);
        }
      },
    },
    children,
  );
}

export function useLeaveSell() {
  const router = useRouter();

  return () => router.replace('/sell');
}
