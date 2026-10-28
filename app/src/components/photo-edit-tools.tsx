import { Alert, Pressable, Text } from 'react-native';

import { Button } from '@/components/ui';
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Edit history"
      onPress={() => {
        const actions: { text: string; onPress: () => void; style?: 'cancel' | 'destructive' }[] = [];
        if (undoable) {
          actions.push({ text: 'Undo', onPress: onUndo });
        }
        if (redoable) {
          actions.push({ text: 'Redo', onPress: onRedo });
        }
        if (resettable) {
          actions.push({ text: 'Reset to original', onPress: onReset });
        }
        actions.push({ text: 'Cancel', style: 'cancel', onPress: () => undefined });
        Alert.alert(actions.length === 1 ? 'Nothing to undo' : 'Edit photo', undefined, actions);
      }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ color: color.ink, fontSize: 20 }}>•••</Text>
    </Pressable>
  );
}

export function ToolButton({ label, disabled, onPress }: ToolButtonProps) {
  return <Button label={label} tone="secondary" disabled={disabled} onPress={onPress} />;
}
