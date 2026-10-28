import type { SFSymbol } from 'sf-symbols-typescript';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Button } from '@/components/ui';
import { useTheme } from '@/state/theme';

/** The same glass circle used to close the creation sheet. */
export function GlassClose({ onPress, label = 'Close' }: { onPress: () => void; label?: string }) {
  return <GlassIconButton systemName="xmark" icon="x" label={label} onPress={onPress} />;
}

export function GlassIconButton({
  icon = 'pencil',
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

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <View>
        <Icon name={icon} size={18} color={color.ink} weight="bold" />
      </View>
    </Pressable>
  );
}

/** Blue glass Save. Prominent glass is the native tinted style on iOS 26. */
export function GlassSaveButton({ onPress, disabled = false, busy = false, label = 'Save' }: { onPress: () => void; disabled?: boolean; busy?: boolean; label?: string }) {
  const inactive = disabled || busy;

  return <Button label={busy ? 'Saving' : label} disabled={inactive} busy={busy} onPress={onPress} />;
}
