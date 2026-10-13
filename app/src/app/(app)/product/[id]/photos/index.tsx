import { Host, Button as SwiftButton, Image as SwiftImage, Menu } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, frame } from '@expo/ui/swift-ui/modifiers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { mediaUrl } from '@/api/client';
import { coverSellPhoto, deleteSellPhoto, getSellItem, reorderSellPhotos, uploadSellPhotoFile } from '@/api/endpoints';
import type { SellItemView, SellPhoto } from '@/api/types';
import { EditingSheet } from '@/components/editing-sheet';
import { GlassIconButton } from '@/components/glass-close';
import { InlineError, LoadingState, T } from '@/components/ui';
import { font, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { itemLeaf, movePhoto, samePhotoOrder, shotLabel } from '@/lib/product-detail';
import { rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useTheme } from '@/state/theme';

const ROW = 104;

export default function PhotosScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const client = useQueryClient();
  const { color } = useTheme();
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const item = itemQuery.data?.data;
  const [rows, setRows] = useState<SellPhoto[]>(item?.photos ?? []);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dragging && item) {
      setRows(item.photos);
    }
  }, [dragging, item]);

  async function keep(next: SellItemView) {
    await rememberSellItem(client, next, startSellWrite(id));
  }

  async function commit(next: SellPhoto[]) {
    if (!item || samePhotoOrder(next, item.photos)) {
      return;
    }

    const previous = item.photos;
    setError(null);

    try {
      const saved = await reorderSellPhotos(id, next.map((photo) => photo.id));
      await keep(saved.data);
    } catch (caught) {
      setRows(previous);
      setError(errorMessage(caught));
    }
  }

  async function add(source: 'library' | 'camera') {
    const ImagePicker = await import('expo-image-picker');
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Photo access is off.');
      return;
    }

    const preferred = ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible;
    const presentationStyle = ImagePicker.UIImagePickerPresentationStyle.OVER_FULL_SCREEN;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, preferredAssetRepresentationMode: preferred, presentationStyle })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, preferredAssetRepresentationMode: preferred, presentationStyle });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const mime = asset.mimeType === 'image/jpg' ? 'image/jpeg' : (asset.mimeType ?? 'image/jpeg');
    const saved = await uploadSellPhotoFile(id, asset.uri, mime, null);
    await keep(saved.data);
  }

  function confirmDelete(photo: SellPhoto) {
    Alert.alert('Delete this photo?', 'It will leave the product and the Sell card if it was the cover.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteSellPhoto(id, photo.id).then(async (saved) => {
            await keep(saved.data);
          }).catch((caught) => setError(errorMessage(caught)));
        },
      },
    ]);
  }

  if (!item) {
    return <LoadingState label="Loading photos" />;
  }

  return (
    <EditingSheet
      title="Photos"
      onClose={() => router.back()}
      right={(
        <AddMenu onLibrary={() => void add('library').catch((caught) => setError(errorMessage(caught)))} onCamera={() => void add('camera').catch((caught) => setError(errorMessage(caught)))} onCollage={() => router.push(itemLeaf(`/product/${id}/photos`, id, 'collage'))} />
      )}
    >
      {error ? <View style={{ paddingHorizontal: 20, paddingTop: 8 }}><InlineError message={error} /></View> : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 8 }} scrollEnabled={!dragging}>
        {rows.length === 0 ? <T variant="body" color={color.ink2}>No photos yet. Add one with the plus button.</T> : null}
        {rows.map((photo, index) => (
          <PhotoRow
            key={photo.id}
            photo={photo}
            index={index}
            count={rows.length}
            onOpen={() => router.push(photo.collage ? `${itemLeaf(`/product/${id}/photos`, id, 'collage')}?photo=${photo.id}` : `${itemLeaf(`/product/${id}/photos`, id, 'edit')}?photo=${photo.id}`)}
            onCover={() => void coverSellPhoto(id, photo.id).then((saved) => keep(saved.data)).catch((caught) => setError(errorMessage(caught)))}
            onDelete={() => confirmDelete(photo)}
            onShift={(from, to) => {
              setDragging(true);
              setRows((current) => movePhoto(current, from, to));
            }}
            onLift={() => setDragging(true)}
            onDrop={() => {
              void commit(rowsRef.current).finally(() => setDragging(false));
            }}
            onMove={(from, to) => {
              const next = movePhoto(rows, from, to);
              setRows(next);
              void commit(next);
            }}
          />
        ))}
      </ScrollView>
    </EditingSheet>
  );
}

function AddMenu({ onLibrary, onCamera, onCollage }: { onLibrary: () => void; onCamera: () => void; onCollage: () => void }) {
  const { color } = useTheme();

  if (Platform.OS !== 'ios') {
    return (
      <View style={{ gap: 8 }}>
        <Pressable accessibilityRole="button" onPress={onLibrary}><Text style={{ color: color.ink }}>Add from library</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onCamera}><Text style={{ color: color.ink }}>Take photo</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onCollage}><Text style={{ color: color.ink }}>Add collage</Text></Pressable>
      </View>
    );
  }

  return (
    <Host matchContents>
      <Menu
        label={(
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

function PhotoRow({
  photo,
  index,
  count,
  onOpen,
  onCover,
  onDelete,
  onShift,
  onLift,
  onDrop,
  onMove,
}: {
  photo: SellPhoto;
  index: number;
  count: number;
  onOpen: () => void;
  onCover: () => void;
  onDelete: () => void;
  onShift: (from: number, to: number) => void;
  onLift: () => void;
  onDrop: () => void;
  onMove: (from: number, to: number) => void;
}) {
  const { color, typeColor } = useTheme();
  const sell = typeColor.sell;
  const offset = useSharedValue(0);
  const active = useSharedValue(false);
  const startIndex = useSharedValue(index);
  const currentIndex = useSharedValue(index);
  const countValue = useSharedValue(count);
  const shiftRef = useRef(onShift);
  const liftRef = useRef(onLift);
  const dropRef = useRef(onDrop);
  currentIndex.value = index;
  countValue.value = count;
  shiftRef.current = onShift;
  liftRef.current = onLift;
  dropRef.current = onDrop;

  const pan = useMemo(() => Gesture.Pan()
    .onStart(() => {
      startIndex.value = currentIndex.value;
      active.value = true;
      runOnJS(liftRef.current)();
      runOnJS(nudge)('start');
    })
    .onUpdate((event) => {
      const next = Math.min(countValue.value - 1, Math.max(0, Math.round(startIndex.value + event.translationY / ROW)));
      offset.value = event.translationY - (currentIndex.value - startIndex.value) * ROW;

      if (next !== currentIndex.value) {
        const from = currentIndex.value;
        currentIndex.value = next;
        runOnJS(shiftRef.current)(from, next);
        runOnJS(nudge)('move');
      }
    })
    .onEnd(() => {
      offset.value = withTiming(0);
      active.value = false;
      runOnJS(dropRef.current)();
    }), [active, countValue, currentIndex, offset, startIndex]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }, { scale: active.value ? 1.02 : 1 }],
    zIndex: active.value ? 2 : 0,
  }));

  return (
    <Animated.View
      style={[{ height: ROW - 8, marginBottom: 8, borderRadius: 16, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 }, style]}
    >
      <Image source={{ uri: mediaUrl(photo.url) }} style={{ width: 76, height: 76, borderRadius: 12 }} />
      <View
        style={{ flex: 1, gap: 4 }}
        accessible
        accessibilityLabel={`${shotLabel(photo.shot_key, photo.collage)}${photo.is_cover ? ', cover' : ''}`}
        accessibilityActions={[
          { name: 'decrement', label: 'Move earlier' },
          { name: 'increment', label: 'Move later' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'decrement' && index > 0) {
            onMove(index, index - 1);
          }
          if (event.nativeEvent.actionName === 'increment' && index < count - 1) {
            onMove(index, index + 1);
          }
        }}
      >
        <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, color: color.ink }}>{shotLabel(photo.shot_key, photo.collage)}</Text>
        {photo.is_cover ? <Text style={{ alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: sell.soft, color: sell.ink, fontSize: 12, fontFamily: font.semi }}>Cover</Text> : null}
      </View>
      <GlassIconButton systemName="pencil" label="Edit photo" onPress={onOpen} size={36} />
      <RowMenu photo={photo} onCover={onCover} onDelete={onDelete} onEarlier={index > 0 ? () => onMove(index, index - 1) : undefined} onLater={index < count - 1 ? () => onMove(index, index + 1) : undefined} />
      <GestureDetector gesture={pan}>
        <View accessibilityLabel="Drag to reorder" style={{ width: 36, height: 76, alignItems: 'center', justifyContent: 'center' }}>
          {Platform.OS === 'ios' ? (
          <Host matchContents>
            <SwiftImage systemName="line.3.horizontal" size={18} color={color.ink3} />
          </Host>
        ) : (
          <Text style={{ color: color.ink3, fontSize: 18 }}>≡</Text>
        )}
        </View>
      </GestureDetector>
    </Animated.View>
  );
}

function RowMenu({
  photo,
  onCover,
  onDelete,
  onEarlier,
  onLater,
}: {
  photo: SellPhoto;
  onCover: () => void;
  onDelete: () => void;
  onEarlier?: () => void;
  onLater?: () => void;
}) {
  const { color } = useTheme();

  if (Platform.OS !== 'ios') {
    return (
      <View style={{ gap: 4 }}>
        {photo.is_cover ? null : <Pressable accessibilityRole="button" onPress={onCover}><Text style={{ color: color.ink2 }}>Cover</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={onDelete}><Text style={{ color: color.danger }}>Delete</Text></Pressable>
      </View>
    );
  }

  return (
    <Host matchContents>
      <Menu
        label={(
          <SwiftButton modifiers={[buttonStyle('glass'), buttonBorderShape('circle'), controlSize('large'), frame({ minWidth: 36, minHeight: 36 })]}>
            <SwiftImage systemName="ellipsis" size={14} color={color.ink} />
          </SwiftButton>
        )}
      >
        {photo.is_cover ? null : <SwiftButton label="Set as cover" systemImage="star" onPress={onCover} />}
        {onEarlier ? <SwiftButton label="Move earlier" systemImage="arrow.up" onPress={onEarlier} /> : null}
        {onLater ? <SwiftButton label="Move later" systemImage="arrow.down" onPress={onLater} /> : null}
        <SwiftButton label="Delete photo" systemImage="trash" role="destructive" onPress={onDelete} />
      </Menu>
    </Host>
  );
}

function nudge(kind: 'start' | 'move') {
  void import('expo-haptics').then((Haptics) => {
    const style = kind === 'start' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;

    return Haptics.impactAsync(style);
  }).catch(() => {});
}
