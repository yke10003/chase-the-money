import { Host, Button as SwiftButton } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, disabled as swiftDisabled } from '@expo/ui/swift-ui/modifiers';

import { Button } from '@/components/ui';
import { useLayout } from '@/design/layout';

/** The blue pill in the full-screen creation sheet. Other iOS layouts keep the shared button. */
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
  const phone = useLayout().phone;
  const inactive = disabled || busy;

  if (!phone) {
    return <Button label={label} onPress={onPress} busy={busy} disabled={disabled} size="lg" iconRight="arrowRight" />;
  }

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
