import { Host, Button as SwiftButton, Image as SwiftImage, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, disabled as swiftDisabled, frame } from '@expo/ui/swift-ui/modifiers';

import { useTheme } from '@/state/theme';

type HistoryMenuProps = {
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
};

type ToolButtonProps = {
  label: string;
  systemImage: 'crop' | 'circle.rectangle.filled.pattern.diagonalline';
  disabled?: boolean;
  onPress: () => void;
};

export function HistoryMenu({
  canUndo: undoable,
  canRedo: redoable,
  canReset: resettable,
  onUndo,
  onRedo,
  onReset,
}: HistoryMenuProps) {
  const { color } = useTheme();

  return (
    <Host matchContents>
      <Menu
        label={(
          <SwiftButton modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel('Edit history')]}>
            <SwiftImage systemName="ellipsis" size={15} color={color.ink} />
          </SwiftButton>
        )}
      >
        <SwiftButton label="Undo" systemImage="arrow.uturn.backward" onPress={onUndo} modifiers={[swiftDisabled(!undoable)]} />
        <SwiftButton label="Redo" systemImage="arrow.uturn.forward" onPress={onRedo} modifiers={[swiftDisabled(!redoable)]} />
        <SwiftButton label="Reset to original" systemImage="arrow.counterclockwise" onPress={onReset} modifiers={[swiftDisabled(!resettable)]} />
      </Menu>
    </Host>
  );
}

export function ToolButton({ label, systemImage, disabled, onPress }: ToolButtonProps) {
  const { color } = useTheme();

  return (
    <Host matchContents>
      <SwiftButton
        onPress={onPress}
        modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 }), accessibilityLabel(label), swiftDisabled(Boolean(disabled))]}
      >
        <SwiftImage systemName={systemImage} size={16} color={color.ink} />
      </SwiftButton>
    </Host>
  );
}
