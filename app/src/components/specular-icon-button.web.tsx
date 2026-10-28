import type { SFSymbol } from 'sf-symbols-typescript';

import { Icon, type IconName } from '@/components/icon';
import SpecularButton from '@/components/specular-button.web';

/** Circle specular button for the photo actions. Web only. */
export function SpecularIconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  systemName: SFSymbol;
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <SpecularButton
      aria-label={label}
      className="specular-button--icon"
      disabled={disabled}
      radius={22}
      size="sm"
      tint="#1c1c1e"
      tintOpacity={0.72}
      blur={12}
      textColor="#f5f5f7"
      lineColor="#ffffff"
      baseColor="#d4d4d8"
      onClick={onPress}
    >
      <Icon name={icon} size={18} color="#f5f5f7" weight="bold" />
    </SpecularButton>
  );
}
