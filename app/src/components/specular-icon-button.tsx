import type { SFSymbol } from 'sf-symbols-typescript';

import { GlassIconButton } from '@/components/glass-close';
import type { IconName } from '@/components/icon';

/** The phone keeps the glass icon. The specular button is the web file. */
export function SpecularIconButton({
  systemName,
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
  return <GlassIconButton systemName={systemName} icon={icon} label={label} onPress={onPress} disabled={disabled} />;
}
