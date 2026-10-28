import { Button } from '@/components/ui';

export function ProminentButton({
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
  return <Button label={label} onPress={onPress} busy={busy} disabled={disabled} size="lg" iconRight="arrowRight" />;
}
