import { Host, Image as SwiftImage, Button as SwiftButton } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled as swiftDisabled, frame } from '@expo/ui/swift-ui/modifiers';
import { usePathname, useRouter } from 'expo-router';
import { createElement, useEffect, type DragEvent, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setCreationExit, useCockpit, useCockpitBody, useCreationBody } from '@/components/cockpit-context';
import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { isSellCreationPath } from '@/lib/cockpit-scene';
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
  const pathname = usePathname();
  const cockpit = useCockpit();
  const insets = useSafeAreaInsets();
  const index = journeyIndex(step);
  const creation = Boolean(cockpit) && phone && Platform.OS === 'ios' && isSellCreationPath(pathname);
  const header = (
    <View style={{ gap: space.md }}>
      {creation ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Host matchContents>
            <SwiftButton onPress={onExit} modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 })]}>
              <SwiftImage systemName="xmark" size={15} color={color.ink} />
            </SwiftButton>
          </Host>
          {onBack ? (
            <Host matchContents>
              <SwiftButton onPress={onBack} modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 })]}>
                <SwiftImage systemName="chevron.backward" size={15} color={color.ink} />
              </SwiftButton>
            </Host>
          ) : null}
          <View style={{ flex: 1 }} />
          {footer}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable accessibilityRole="button" accessibilityLabel={onBack ? 'Back' : 'Close'} onPress={onBack ?? onExit} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={onBack ? 'arrowLeft' : 'x'} size={20} color={color.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onExit} hitSlop={8}>
            <Text style={{ fontFamily: font.medium, fontSize: 15, color: color.ink2 }}>Save & exit</Text>
          </Pressable>
        </View>
      )}
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

  const phoneBody = creation ? (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.paper }}
      contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 48, gap: space.lg }}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? insets.top + 8 : 8, paddingBottom: 24, gap: space.lg }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        {header}
        {children}
      </ScrollView>
      {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + (Platform.OS === 'ios' ? 64 : 0), borderTopWidth: 1, borderTopColor: color.line }}>{footer}</View> : null}
    </View>
  );
  useCockpitBody(phoneBody, !creation && Boolean(cockpit) && phone);
  useCreationBody(creation ? phoneBody : null);
  useEffect(() => {
    if (!creation) {
      return;
    }

    setCreationExit(onExit);
    return () => setCreationExit(null);
  }, [creation, onExit]);

  if (creation) {
    return null;
  }

  if (phone) {
    return phoneBody;
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

/** The step's main button. In the full-screen creation sheet this is the blue pill. */
export function JourneyContinue({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const cockpit = useCockpit();
  const phone = useLayout().phone;
  const pathname = usePathname();
  const creation = Boolean(cockpit) && phone && Platform.OS === 'ios' && isSellCreationPath(pathname);
  const inactive = disabled || busy;

  if (creation) {
    return (
      <Host matchContents>
        <SwiftButton
          label={label}
          onPress={onPress}
          modifiers={[buttonStyle('borderedProminent'), buttonBorderShape('capsule'), swiftDisabled(inactive)]}
        />
      </Host>
    );
  }

  return <Button label={label} onPress={onPress} busy={busy} disabled={disabled} size="lg" iconRight="arrowRight" />;
}

export function useLeaveSell() {
  const router = useRouter();

  return () => leaveSell(router);
}

/**
 * Pop back to the Sell overview that is already on the stack.
 * replace('/sell') builds a new overview and react-native-screens plays that
 * as a push, which runs after the creation sheet has finished dismissing.
 */
export function leaveSell(router: { dismissTo: (href: '/sell') => void }) {
  router.dismissTo('/sell');
}

let pendingResume: number | null = null;

/** Product Detail asks Sell to open setup after the product modal has gone. */
export function queueSellResume(id: number) {
  pendingResume = id;
}

export function takeSellResume(): number | null {
  const id = pendingResume;
  pendingResume = null;

  return id;
}
