import { Host, Button as SwiftButton, Image as SwiftImage } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, disabled as swiftDisabled, frame, tint } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import { type IconName } from '@/components/icon';
import { useTheme } from '@/state/theme';

/** The same glass circle used to close the creation sheet. */
export function GlassClose({ onPress, label = 'Close' }: { onPress: () => void; label?: string }) {
  return <GlassIconButton systemName="xmark" icon="x" label={label} onPress={onPress} />;
}

export function GlassIconButton({
  systemName,
  label,
  onPress,
  disabled = false,
  size = 44,
}: {
  systemName: SFSymbol;
  icon?: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}) {
  const { color } = useTheme();
  const control = size >= 44 ? controlSize('large') : controlSize('small');

  return (
    <Host matchContents>
      <SwiftButton
        onPress={onPress}
        modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), control, frame({ minWidth: size, minHeight: size }), accessibilityLabel(label), swiftDisabled(disabled)]}
      >
        <SwiftImage systemName={systemName} size={size >= 44 ? 15 : 14} color={color.ink} />
      </SwiftButton>
    </Host>
  );
}

/** Blue glass Save. Prominent glass is the native tinted style on iOS 26. */
export function GlassSaveButton({ onPress, disabled = false, busy = false, label = 'Save' }: { onPress: () => void; disabled?: boolean; busy?: boolean; label?: string }) {
  const { scheme } = useTheme();
  const inactive = disabled || busy;
  const blue = scheme === 'dark' ? '#0A84FF' : '#007AFF';

  return (
    <Host matchContents>
      <SwiftButton
        label={busy ? 'Saving' : label}
        onPress={onPress}
        modifiers={[buttonStyle('glassProminent'), tint(blue), controlSize('large'), accessibilityLabel(label), swiftDisabled(inactive)]}
      />
    </Host>
  );
}
