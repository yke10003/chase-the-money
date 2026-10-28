import { Host, Button as SwiftButton, HStack, Image as SwiftImage, List, Menu, RNHostView, Spacer, SwipeActions, Text as SwiftText, VStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonBorderShape, buttonStyle, contentShape, controlSize, environment, font, foregroundStyle, frame, listRowBackground, listStyle, onTapGesture, scrollContentBackground, shapes } from '@expo/ui/swift-ui/modifiers';
import { Image, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import type { SellPhoto } from '@/api/types';
import { shotLabel } from '@/lib/product-detail';
import { useTheme } from '@/state/theme';

const THUMB = 56;

type ListProps = {
  rows: SellPhoto[];
  onOpen: (photo: SellPhoto) => void;
  onCover: (photo: SellPhoto) => void;
  onDelete: (photo: SellPhoto) => void;
};

type AddMenuProps = {
  onLibrary: () => void;
  onCamera: () => void;
  onCollage: () => void;
  labeled?: boolean;
};

function photoDescription(photo: SellPhoto): string {
  return `${shotLabel(photo.shot_key, photo.collage)}${photo.is_cover ? ', cover' : ''}`;
}

/**
 * One SwiftUI `List`. Reordering is SwiftUI's own (`editMode` plus `onMove`), and the
 * rows are native, so there is no React Native ScrollView or drag gesture in this sheet.
 * The header stays in the React Native tree above the Host.
 */
export function NativePhotoList({ rows, editing, onOpen, onCover, onDelete, onMove }: ListProps & { editing: boolean; onMove: (sourceIndices: number[], destination: number) => void }) {
  const { color, scheme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Host style={{ flex: 1 }} colorScheme={scheme}>
        <List modifiers={[listStyle('plain'), scrollContentBackground('hidden'), environment('editMode', editing ? 'active' : 'inactive')]}>
          <List.ForEach onMove={onMove}>
            {rows.map((photo) => (
              <NativePhotoRow key={photo.id} photo={photo} editing={editing} background={color.paper} onOpen={onOpen} onCover={onCover} onDelete={onDelete} />
            ))}
          </List.ForEach>
        </List>
      </Host>
    </View>
  );
}

function NativePhotoRow({ photo, editing, background, onOpen, onCover, onDelete }: Omit<ListProps, 'rows'> & { photo: SellPhoto; editing: boolean; background: string }) {
  const { color } = useTheme();
  const label = shotLabel(photo.shot_key, photo.collage);
  const modifiers = [listRowBackground(background), accessibilityLabel(photoDescription(photo))];

  if (!editing) {
    modifiers.push(contentShape(shapes.rectangle()), onTapGesture(() => onOpen(photo)));
  }

  return (
    <SwipeActions>
      <HStack spacing={12} modifiers={modifiers}>
        {/* A React Native Image: it loads and caches the remote file off the main thread. SwiftUI's own Image reads the file synchronously. */}
        <RNHostView matchContents>
          <Image source={{ uri: mediaUrl(photo.url) }} accessibilityIgnoresInvertColors style={{ width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: color.sunken }} />
        </RNHostView>
        <VStack alignment="leading" spacing={2}>
          <SwiftText modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(color.ink)]}>{label}</SwiftText>
          {photo.is_cover ? <SwiftText modifiers={[font({ size: 13 }), foregroundStyle(color.ink3)]}>Cover</SwiftText> : null}
        </VStack>
        <Spacer />
        {editing ? null : (
          <SwiftButton onPress={() => onCover(photo)} modifiers={[buttonStyle('borderless'), accessibilityLabel(photo.is_cover ? 'Cover photo' : 'Make cover photo')]}>
            <SwiftImage systemName={photo.is_cover ? 'star.fill' : 'star'} size={20} color={photo.is_cover ? color.due : color.ink3} />
          </SwiftButton>
        )}
        {editing ? null : <SwiftImage systemName="chevron.right" size={13} color={color.ink3} />}
      </HStack>
      <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
        <SwiftButton label="Delete" systemImage="trash" role="destructive" onPress={() => onDelete(photo)} />
      </SwipeActions.Actions>
    </SwipeActions>
  );
}

export function EditToggle({ editing, onPress }: { editing: boolean; onPress: () => void }) {
  return (
    <Host matchContents>
      <SwiftButton
        label={editing ? 'Done' : 'Edit'}
        onPress={onPress}
        modifiers={[buttonStyle(editing ? 'glassProminent' : 'glass'), controlSize('large')]}
      />
    </Host>
  );
}

export function AddMenu({ onLibrary, onCamera, onCollage, labeled = false }: AddMenuProps) {
  const { color } = useTheme();

  return (
    <Host matchContents>
      <Menu
        label={labeled ? (
          <SwiftButton label="Add photo" systemImage="plus" modifiers={[buttonStyle('glassProminent'), controlSize('large')]} />
        ) : (
          <SwiftButton modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large'), frame({ minWidth: 44, minHeight: 44 })]}>
            <SwiftImage systemName="plus" size={16} color={color.ink} />
          </SwiftButton>
        )}
      >
        <SwiftButton label="Add from library" systemImage="photo.on.rectangle" onPress={onLibrary} />
        <SwiftButton label="Take photo" systemImage="camera" onPress={onCamera} />
        <SwiftButton label="Add collage" systemImage="square.grid.2x2" onPress={onCollage} />
      </Menu>
    </Host>
  );
}
