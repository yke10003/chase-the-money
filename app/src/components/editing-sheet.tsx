import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassClose } from '@/components/glass-close';
import { useTheme } from '@/state/theme';

/** Glass close, large title, optional trailing controls. Sheets sit under the island, so the top pad stays small. */
export function EditingSheet({
  title,
  onClose,
  right,
  paddingTop = 16,
  children,
}: {
  title: string;
  onClose: () => void;
  right?: ReactNode;
  paddingTop?: number;
  children: ReactNode;
}) {
  const { color, type: typeScale } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: color.paper, paddingBottom: Math.max(insets.bottom, 16) }}>
      <View style={{ paddingTop, paddingHorizontal: 20, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <GlassClose onPress={onClose} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View>
        </View>
        <Text style={[typeScale.title, { fontSize: 32, lineHeight: 36 }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}
