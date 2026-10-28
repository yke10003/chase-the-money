import { Pressable, Text, View } from 'react-native';

import type { SellPhoto } from '@/api/types';
import { useLayout } from '@/design/layout';
import { useTheme } from '@/state/theme';

type AddMenuProps = {
  onLibrary: () => void;
  onCamera: () => void;
  onCollage: () => void;
  labeled?: boolean;
};

type NativePhotoListProps = {
  rows: SellPhoto[];
  editing: boolean;
  onOpen: (photo: SellPhoto) => void;
  onCover: (photo: SellPhoto) => void;
  onDelete: (photo: SellPhoto) => void;
  onMove: (sourceIndices: number[], destination: number) => void;
};

/** The SwiftUI list lives in the iOS file. This screen uses the plain list instead. */
export function NativePhotoList(_props: NativePhotoListProps) {
  return null;
}

/** Edit mode is the SwiftUI list's own control. The plain list reorders with up and down. */
export function EditToggle(_props: { editing: boolean; onPress: () => void }) {
  return null;
}

export function AddMenu({ onLibrary, onCamera, onCollage }: AddMenuProps) {
  const { color } = useTheme();
  const desktop = useLayout().desktop;

  return (
    <View style={{ gap: 8 }}>
      <Pressable accessibilityRole="button" onPress={onLibrary}><Text style={{ color: color.ink }}>Add from library</Text></Pressable>
      {desktop ? null : <Pressable accessibilityRole="button" onPress={onCamera}><Text style={{ color: color.ink }}>Take photo</Text></Pressable>}
      <Pressable accessibilityRole="button" onPress={onCollage}><Text style={{ color: color.ink }}>Add collage</Text></Pressable>
    </View>
  );
}
