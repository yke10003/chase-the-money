import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { SellPhoto } from '@/api/types';
import { SpecularIconButton } from '@/components/specular-icon-button';
import { font, radius, weight } from '@/design/tokens';
import { savePictures } from '@/lib/photo-download';
import { useTheme } from '@/state/theme';

const MENU_WIDTH = 200;

export function PhotoDownloadMenu({
  photos,
  index,
  itemName,
  itemId,
}: {
  photos: SellPhoto[];
  index: number;
  itemName: string;
  itemId: number;
}) {
  const { color } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const anchor = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  function open() {
    anchor.current?.measureInWindow((x, y, width, height) => {
      setOrigin({ x, y, width, height });
    });
  }

  function choose(all: boolean) {
    setOrigin(null);
    savePictures(photos, index, all, itemName, itemId);
  }

  const menuHeight = 96;
  const left = origin ? Math.min(Math.max(12, origin.x + origin.width - MENU_WIDTH), windowWidth - MENU_WIDTH - 12) : 12;
  const above = origin ? origin.y - menuHeight - 8 : 12;
  const top = origin && above < 12 ? origin.y + origin.height + 8 : above;
  const clampedTop = Math.min(top, windowHeight - menuHeight - 12);

  return (
    <View ref={anchor} collapsable={false}>
      <SpecularIconButton systemName="square.and.arrow.down" icon="download" label="Download pictures" onPress={open} />
      <Modal visible={origin != null} transparent animationType="none" onRequestClose={() => setOrigin(null)}>
        <Pressable accessibilityLabel="Dismiss menu" style={StyleSheet.absoluteFill} onPress={() => setOrigin(null)} />
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View style={{
            position: 'absolute',
            top: clampedTop,
            left,
            width: MENU_WIDTH,
            borderRadius: radius.md,
            overflow: 'hidden',
            backgroundColor: color.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: color.line,
            shadowColor: '#000',
            shadowOpacity: 0.16,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 8 },
            elevation: 8,
          }}>
            <MenuRow label="This picture" onPress={() => choose(false)} />
            <MenuRow label="All pictures" last onPress={() => choose(true)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuRow({ label, last = false, onPress }: { label: string; last?: boolean; onPress: () => void }) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed ? color.sunken : color.surface,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: color.line,
      })}
    >
      <Text style={{ color: color.ink, fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}
