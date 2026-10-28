import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import { coverSellPhoto, deleteSellPhoto, getSellItem, reorderSellPhotos, uploadSellPhotoFile } from '@/api/endpoints';
import type { SellItemView, SellPhoto } from '@/api/types';
import { EditingSheet } from '@/components/editing-sheet';
import { AddMenu, EditToggle, NativePhotoList } from '@/components/native-photo-list';
import { InlineError, LoadingState, T } from '@/components/ui';
import { font as fontFamily, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { navLog } from '@/lib/nav-log';
import { itemLeaf, movePhoto, samePhotoOrder, shotLabel } from '@/lib/product-detail';
import { applyNativeMove, coverTarget, nextEditing, rowHref, usesNativePhotoList } from '@/lib/photos-list';
import { rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useTheme } from '@/state/theme';

const THUMB = 56;

export default function PhotosScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const client = useQueryClient();
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const item = itemQuery.data?.data;
  const [rows, setRows] = useState<SellPhoto[]>(item?.photos ?? []);
  const [editRequested, setEditRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const native = usesNativePhotoList(Platform.OS);
  // Reordering needs two photos. Deleting down to one ends edit mode without another state change.
  const editing = native && editRequested && rows.length > 1;

  useEffect(() => {
    if (item) {
      setRows(item.photos);
    }
  }, [item]);

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

  function chooseCover(photo: SellPhoto) {
    const target = coverTarget(photo);
    navLog('photos.cover', { photo: photo.id, request: target != null });

    if (target == null) {
      return;
    }

    void coverSellPhoto(id, target).then((saved) => keep(saved.data)).catch((caught) => setError(errorMessage(caught)));
  }

  function openPhoto(photo: SellPhoto) {
    const href = rowHref(editing, id, photo);
    navLog('photos.row', { photo: photo.id, editing, opens: href });

    if (href) {
      router.push(href);
    }
  }

  function moveNative(sourceIndices: number[], destination: number) {
    const next = applyNativeMove(rows, sourceIndices, destination);
    navLog('photos.reorder', { from: sourceIndices.join(','), to: destination, changed: next !== rows });

    if (next === rows) {
      return;
    }

    setRows(next);
    void commit(next);
  }

  function moveStep(from: number, to: number) {
    const next = movePhoto(rows, from, to);
    setRows(next);
    void commit(next);
  }

  function toggleEditing() {
    const next = nextEditing(editRequested, rows.length);
    navLog('photos.edit', { editing: next });
    setEditRequested(next);
  }

  if (!item) {
    return <LoadingState label="Loading photos" />;
  }

  const addActions = {
    onLibrary: () => void add('library').catch((caught) => setError(errorMessage(caught))),
    onCamera: () => void add('camera').catch((caught) => setError(errorMessage(caught))),
    onCollage: () => router.push(itemLeaf(id, 'collage')),
  };

  return (
    <EditingSheet
      title="Photos"
      onClose={() => router.back()}
      right={(
        <>
          {native && rows.length > 1 ? <EditToggle editing={editing} onPress={toggleEditing} /> : null}
          <AddMenu {...addActions} />
        </>
      )}
    >
      {error ? <View style={{ paddingHorizontal: 20, paddingTop: 8 }}><InlineError message={error} /></View> : null}
      {rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 }}>
          <T variant="body">No photos yet.</T>
          <AddMenu {...addActions} labeled />
        </View>
      ) : native ? (
        <NativePhotoList rows={rows} editing={editing} onOpen={openPhoto} onCover={chooseCover} onDelete={confirmDelete} onMove={moveNative} />
      ) : (
        <PlainPhotoList rows={rows} onOpen={openPhoto} onCover={chooseCover} onDelete={confirmDelete} onStep={moveStep} />
      )}
    </EditingSheet>
  );
}

function photoDescription(photo: SellPhoto): string {
  return `${shotLabel(photo.shot_key, photo.collage)}${photo.is_cover ? ', cover' : ''}`;
}

type ListProps = {
  rows: SellPhoto[];
  onOpen: (photo: SellPhoto) => void;
  onCover: (photo: SellPhoto) => void;
  onDelete: (photo: SellPhoto) => void;
};

/** Android and web: a plain list. Reordering is Move up and Move down, with no drag gesture. */
function PlainPhotoList({ rows, onOpen, onCover, onDelete, onStep }: ListProps & { onStep: (from: number, to: number) => void }) {
  const { color } = useTheme();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 8 }}>
      {rows.map((photo, index) => (
        <View key={photo.id} style={{ borderRadius: 16, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${photoDescription(photo)}`} onPress={() => onOpen(photo)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={{ uri: mediaUrl(photo.url) }} style={{ width: THUMB, height: THUMB, borderRadius: 10, backgroundColor: color.sunken }} />
            <Text style={{ flex: 1, fontFamily: fontFamily.semi, fontWeight: weight.semibold, fontSize: 16, color: color.ink }}>{shotLabel(photo.shot_key, photo.collage)}{photo.is_cover ? ' (cover)' : ''}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={photo.is_cover ? 'Cover photo' : 'Make cover photo'} onPress={() => onCover(photo)} hitSlop={8}>
            <Text style={{ fontSize: 20, color: photo.is_cover ? color.due : color.ink3 }}>{photo.is_cover ? '★' : '☆'}</Text>
          </Pressable>
          {index > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Move earlier" onPress={() => onStep(index, index - 1)} hitSlop={8}><Text style={{ color: color.ink2 }}>↑</Text></Pressable> : null}
          {index < rows.length - 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Move later" onPress={() => onStep(index, index + 1)} hitSlop={8}><Text style={{ color: color.ink2 }}>↓</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Delete photo" onPress={() => onDelete(photo)} hitSlop={8}><Text style={{ color: color.danger }}>Delete</Text></Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
