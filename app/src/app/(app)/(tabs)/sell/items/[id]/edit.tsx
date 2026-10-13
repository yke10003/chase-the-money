import { Host, Button as SwiftButton, Image as SwiftImage, Menu } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonBorderShape, buttonStyle, controlSize, disabled as swiftDisabled, frame } from '@expo/ui/swift-ui/modifiers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import { getSellItem, recolorSellPhoto, resetSellPhotoEdit, uploadSellPhotoEdit } from '@/api/endpoints';
import type { SellItemView } from '@/api/types';
import { BackgroundSwatches } from '@/components/background-swatches';
import { CockpitPage, useCockpit } from '@/components/cockpit-context';
import { EditingSheet } from '@/components/editing-sheet';
import { GlassSaveButton } from '@/components/glass-close';
import { PhotoCrop } from '@/components/photo-crop';
import { Button, InlineError, LoadingState, T } from '@/components/ui';
import { font, space, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { canRedo, canReset, canUndo, currentStep, editIsDirty, pushStep, recolorStep, redoEdit, resetEdit, seedHistory, undoEdit, type EditHistory, type EditStep } from '@/lib/photo-edit';
import { rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useTheme } from '@/state/theme';

/** Background removal needs a file on disk. Remote photos stay remote until then. */
async function localFile(uri: string, name: string): Promise<string> {
  if (uri.startsWith('file:') || uri.startsWith('content:')) {
    return uri;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const root = FileSystem.cacheDirectory;

  if (!root) {
    throw new Error('Could not store the photo on this phone.');
  }

  const downloaded = await FileSystem.downloadAsync(uri, `${root}${name}`);

  return downloaded.uri;
}

const REMOVE_BACKGROUND = 'circle.rectangle.filled.pattern.diagonalline';

export default function EditPhotoScreen() {
  const params = useLocalSearchParams<{ id: string; photo: string }>();
  const id = Number(params.id);
  const photoId = Number(params.photo);
  const router = useRouter();
  const client = useQueryClient();
  const { color } = useTheme();
  const cockpit = useCockpit();
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const photo = itemQuery.data?.data.photos.find((entry) => entry.id === photoId) ?? null;
  const [history, setHistory] = useState<EditHistory>({ steps: [], future: [] });
  const [cropOpen, setCropOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(0);
  const seededId = useRef<number | null>(null);
  const savingRef = useRef(false);
  const applyingRef = useRef(false);

  useEffect(() => {
    if (!photo || seededId.current === photo.id) {
      return;
    }

    const source = photo;
    const background = (source.background ?? '#FFFFFF').toUpperCase();
    const raw: EditStep = { uri: mediaUrl(source.original_url), kind: 'raw', fresh: false, transparent: false, background };
    const steps: EditStep[] = source.cutout_url
      ? [raw, { uri: mediaUrl(source.cutout_url), kind: 'cut', fresh: false, transparent: true, background }]
      : source.has_edit
        ? [raw, { uri: mediaUrl(source.url), kind: 'cut', fresh: false, transparent: false, background }]
        : [raw];

    seededId.current = source.id;
    setHistory(seedHistory(steps));
    setReady(true);
  }, [photo]);

  useEffect(() => {
    if (notice === 0) {
      return;
    }

    const timer = setTimeout(() => setNotice(0), 4000);

    return () => clearTimeout(timer);
  }, [notice]);

  if (error && history.steps.length === 0) {
    return <InlineError message={error} />;
  }

  if (itemQuery.isLoading || !itemQuery.data || !ready) {
    return <LoadingState label="Loading the photo" />;
  }

  if (!photo || photo.collage) {
    return <InlineError message="That photo is not on this item." />;
  }

  const picture = photo;
  const current = currentStep(history);
  const savedBackground = (picture.background ?? '#FFFFFF').toUpperCase();
  const dirty = editIsDirty(current, { hasEdit: picture.has_edit, background: savedBackground });

  async function apply() {
    const source = [...history.steps].reverse().find((step) => !step.transparent) ?? history.steps[0];

    if (!source || applyingRef.current) {
      return;
    }

    applyingRef.current = true;
    setApplying(true);
    setError(null);
    setNotice(0);

    try {
      const { removeBackground } = await import('@rbayuokt/expo-background-removal');
      const uri = await localFile(source.uri, `nolume-edit-${picture.id}.img`);
      const cutout = await removeBackground(uri, { cropToSubject: false });
      setHistory((existing) => pushStep(existing, {
        uri: cutout.uri,
        kind: 'cut',
        fresh: true,
        transparent: true,
        background: currentStep(existing)?.background ?? savedBackground,
      }));
      setNotice((value) => value + 1);
    } catch (caught) {
      const code = caught && typeof caught === 'object' && 'code' in caught ? String(caught.code) : '';
      setError(code === 'NO_SUBJECT_FOUND' ? 'No clear subject in that photo.' : errorMessage(caught));
    } finally {
      applyingRef.current = false;
      setApplying(false);
    }
  }

  async function save() {
    if (!current || !dirty || savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);

    const token = startSellWrite(id);

    try {
      let next: SellItemView | null = null;

      if (current.kind === 'raw' && picture.has_edit) {
        next = (await resetSellPhotoEdit(id, picture.id)).data;
      } else if (current.fresh) {
        const mime = current.transparent ? 'image/png' : 'image/jpeg';
        next = (await uploadSellPhotoEdit(id, picture.id, current.uri, current.background, mime)).data;
      } else if (current.transparent && current.background.toUpperCase() !== savedBackground) {
        next = (await recolorSellPhoto(id, picture.id, current.background)).data;
      }

      if (next) {
        await rememberSellItem(client, next, token);
      }

      router.back();
    } catch (caught) {
      setError(errorMessage(caught));
      savingRef.current = false;
      setSaving(false);
    }
  }

  function undo() {
    setHistory((existing) => undoEdit(existing));
    setNotice(0);
  }

  function requestClose() {
    if (!dirty) {
      router.back();
      return;
    }

    Alert.alert('Discard edits?', 'Your changes to this photo will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  function confirmReset() {
    if (!canReset(history)) {
      return;
    }

    Alert.alert('Reset to the original?', 'This drops the edits in this session. The saved photo stays until you tap Save.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setHistory((existing) => resetEdit(existing));
          setNotice(0);
        },
      },
    ]);
  }

  const page = (
    <EditingSheet
      title="Edit photo"
      paddingTop={cockpit ? 8 : 16}
      onClose={requestClose}
      right={(
        <>
          <HistoryMenu
            canUndo={canUndo(history)}
            canRedo={canRedo(history)}
            canReset={canReset(history)}
            onUndo={undo}
            onRedo={() => {
              setHistory((existing) => redoEdit(existing));
              setNotice(0);
            }}
            onReset={confirmReset}
          />
          <GlassSaveButton disabled={!current || applying || !dirty} busy={saving} onPress={() => void save()} />
        </>
      )}
    >
      <View style={{ flex: 1 }}>
        <View style={{ marginHorizontal: 20, marginTop: 8, height: 460, borderRadius: 24, overflow: 'hidden', backgroundColor: current?.background ?? '#FFFFFF' }}>
          {current ? <Image source={{ uri: current.uri }} accessibilityLabel="Edited photo" resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : <LoadingState label="Preparing the photo" />}
          {applying ? (
            <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' }}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', marginTop: 8, fontFamily: font.medium, fontWeight: weight.medium }}>Removing background</Text>
            </View>
          ) : null}
          <View style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 8 }}>
            <ToolButton label="Crop" systemImage="crop" disabled={!current || applying} onPress={() => setCropOpen(true)} />
            {Platform.OS === 'web' ? null : (
              <ToolButton label="Remove background" systemImage={REMOVE_BACKGROUND} disabled={!current || applying} onPress={() => void apply()} />
            )}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ gap: space.md, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: notice > 0 ? 72 : space.md }} keyboardShouldPersistTaps="handled">
          {Platform.OS === 'web' ? <T variant="body" color={color.ink2}>Background removal runs on the iPhone.</T> : null}
          {current?.transparent ? (
            <View style={{ gap: space.sm }}>
              <T variant="eyebrow">Background</T>
              <BackgroundSwatches value={current.background} onChange={(hex) => {
                setHistory((existing) => recolorStep(existing, hex));
                setNotice(0);
              }} />
            </View>
          ) : null}
          {error ? <InlineError message={error} /> : null}
        </ScrollView>
        {notice > 0 ? (
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: color.ink }}>
            <Text style={{ color: color.onInk, fontFamily: font.medium, fontWeight: weight.medium }}>Background removed</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Undo background removal" onPress={undo} hitSlop={8}>
              <Text style={{ color: color.onInk, fontFamily: font.semi, fontWeight: weight.semibold }}>Undo</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </EditingSheet>
  );

  return (
    <CockpitPage>
      {page}
      <Modal visible={cropOpen} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={() => setCropOpen(false)}>
        {current ? (
          <PhotoCrop
            uri={current.uri}
            background={current.background}
            transparent={current.transparent}
            onClose={() => setCropOpen(false)}
            onDone={(uri) => {
              const transparent = current.transparent;
              const background = current.background;
              setHistory((existing) => pushStep(existing, { uri, kind: 'cut', fresh: true, transparent, background }));
              setNotice(0);
              setCropOpen(false);
            }}
          />
        ) : null}
      </Modal>
    </CockpitPage>
  );
}

function HistoryMenu({
  canUndo: undoable,
  canRedo: redoable,
  canReset: resettable,
  onUndo,
  onRedo,
  onReset,
}: {
  canUndo: boolean;
  canRedo: boolean;
  canReset: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}) {
  const { color } = useTheme();

  if (Platform.OS !== 'ios') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit history"
        onPress={() => {
          const actions: Array<{ text: string; onPress: () => void; style?: 'cancel' | 'destructive' }> = [];
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

function ToolButton({ label, systemImage, disabled, onPress }: { label: string; systemImage: 'crop' | typeof REMOVE_BACKGROUND; disabled?: boolean; onPress: () => void }) {
  const { color } = useTheme();

  if (Platform.OS !== 'ios') {
    return <Button label={label} tone="secondary" disabled={disabled} onPress={onPress} />;
  }

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
