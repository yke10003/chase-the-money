import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import {
  addSellComparable,
  discardSellItem,
  finishSellItem,
  getSellCatalog,
  getSellItem,
  updateSellItem,
  uploadSellPhoto,
  uploadSellPhotoFile,
} from '@/api/endpoints';
import type { SellItemView, SellStep } from '@/api/types';
import { ChoiceBlock, DropSurface, JourneyContinue, SellJourney, sellIcon } from '@/components/sell-flow';
import { Icon } from '@/components/icon';
import { Button, Field, InlineError, MoneyField, T } from '@/components/ui';
import { font, space, weight } from '@/design/tokens';
import { confirmAction } from '@/lib/confirm';
import { errorMessage } from '@/lib/errors';
import { formatAmount, minorToMajorInput } from '@/lib/money';
import { navigation } from '@/lib/navigation';
import { comparableDraft } from '@/lib/product-detail';
import { copyText, listingDraft, openShot, parseEstimate, shotAfter } from '@/lib/sell';
import { forgetSellItem, rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

const ORDER: SellStep[] = ['identity', 'photos', 'details', 'research', 'estimate', 'description'];

export default function SellSetupScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const leave = () => navigation.closeExperience();
  const refresh = useRefreshProduct();
  const client = useQueryClient();
  const { color, typeColor } = useTheme();
  const sell = typeColor.sell;
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const catalog = useQuery({ queryKey: ['sell', 'catalog'], queryFn: getSellCatalog });
  const item = itemQuery.data?.data;
  const [step, setStep] = useState<SellStep | null>(null);
  const [placedId, setPlacedId] = useState<number | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const anchor = useRef<{ id: number; step: SellStep; shot: string | null } | null>(null);
  const [localShot, setLocalShot] = useState<{ key: string; uri: string } | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState<string | null>(null);
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [listingTitle, setListingTitle] = useState('');
  const [listingDescription, setListingDescription] = useState('');
  const [link, setLink] = useState('');
  const [price, setPrice] = useState('');
  const [saleState, setSaleState] = useState<'sold' | 'asking'>('sold');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Save & exit could not save. The next X asks before leaving without those changes.
  const [exitFailed, setExitFailed] = useState(false);
  const finishing = useRef(false);
  // The step the server last reported. Only a change to it moves the user forward.
  const serverStep = useRef<SellStep | null>(null);
  const uploadSerial = useRef(0);
  const activeShot = useRef<string | null>(null);
  activeShot.current = shot;

  const coverUrl = item?.cover_url ?? null;

  useEffect(() => {
    if (!coverUrl) {
      return;
    }

    Image.prefetch(mediaUrl(coverUrl)).catch(() => {});
  }, [coverUrl]);

  // Placed while rendering, not in an effect: Category replaces itself with this
  // screen, and an empty first commit would flash blank paper in the modal.
  if (item && item.id === id && !item.setup_done && placedId !== id) {
    const nextShot = openShot(item.photo_plan);
    anchor.current = { id, step: item.setup_step, shot: nextShot };
    serverStep.current = item.setup_step;
    setPlacedId(id);
    setStep(item.setup_step);
    setShot(nextShot);
    setLocalShot(null);
    setName(item.name ?? '');
    setBrand(item.brand ?? '');
    setDetails(item.details ?? {});
    setCondition(item.condition);
    setLow(minorToMajorInput(item.value_min_minor));
    setHigh(item.value_max_minor != null && item.value_max_minor !== item.value_min_minor ? minorToMajorInput(item.value_max_minor) : '');
    const draft = listingDraft(item);
    setListingTitle(draft.title);
    setListingDescription(draft.description);
  }

  useEffect(() => {
    if (!item || item.id !== id || !itemQuery.isFetchedAfterMount) {
      return;
    }

    if (item.setup_done) {
      if (!finishing.current) {
        navigation.closeExperience();
      }
      return;
    }

    // A refetch that repeats the server's step must not undo a local Back.
    const serverMoved = serverStep.current !== item.setup_step;
    serverStep.current = item.setup_step;

    if (!serverMoved) {
      return;
    }

    const held = anchor.current;

    if (!held || held.id !== id || step !== held.step) {
      return;
    }

    // A saved photo must not move the shot the user is looking at.
    if (item.setup_step === held.step) {
      return;
    }

    const nextShot = item.setup_step === 'photos' ? openShot(item.photo_plan) : null;
    anchor.current = { id, step: item.setup_step, shot: nextShot };
    setStep(item.setup_step);
    setShot(nextShot);
  }, [id, item, itemQuery.isFetchedAfterMount, step]);

  async function kept(work: () => Promise<{ data: SellItemView }>) {
    const token = startSellWrite(id);
    const next = await work();
    await rememberSellItem(client, next.data, token);

    return { item: next.data, token };
  }

  async function run(work: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError(null);
    setExitFailed(false);

    try {
      await work();
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const opened = item != null && item.id === id && placedId === id && step != null;
  const missing = itemQuery.isError && !item;

  if (!opened || !item || !step) {
    if (missing) {
      return (
        <SellJourney step="identity" title="This draft did not open" onExit={leave}>
          <InlineError message={errorMessage(itemQuery.error)} />
        </SellJourney>
      );
    }

    if (item?.setup_done && !finishing.current) {
      return <SellJourney step="description" title="This item is already set up" onExit={leave}>{null}</SellJourney>;
    }

    return null;
  }

  const record = item;
  const currentStep = step;

  const category = catalog.data?.data.categories.find((entry) => entry.key === item.category);
  const plan = item.photo_plan;
  const shotIndex = plan.findIndex((entry) => entry.key === shot);
  const currentShot = shotIndex >= 0 ? plan[shotIndex] : null;
  const shotPhoto = currentShot ? item.photos.find((photo) => photo.shot_key === currentShot.key) ?? null : null;
  const shotPreview = currentShot && localShot?.key === currentShot.key ? localShot.uri : (shotPhoto ? mediaUrl(shotPhoto.url) : null);

  async function saveIdentity(advance: boolean): Promise<boolean> {
    const trimmed = name.trim();

    if (advance && trimmed === '') {
      setError('Name the item first.');
      return false;
    }

    const detailPatch: Record<string, string> = {};

    for (const field of category?.identity ?? []) {
      if (field.detail) {
        detailPatch[field.key] = details[field.key] ?? '';
      }
    }

    return run(async () => {
      await kept(() => updateSellItem(id, {
        name: trimmed,
        brand: brand.trim() || null,
        details: detailPatch,
        advance,
      }));

      if (advance) {
        setStep('photos');
      }
    });
  }

  async function saveDetails(advance: boolean): Promise<boolean> {
    return run(async () => {
      await kept(() => updateSellItem(id, { condition, details, advance }));

      if (advance) {
        setStep('research');
      }
    });
  }

  async function saveResearch(advance: boolean) {
    if (!advance) {
      leave();
      return;
    }

    await run(async () => {
      await kept(() => updateSellItem(id, { advance: true }));
      setStep('estimate');
    });
  }

  async function saveEstimate(advance: boolean): Promise<boolean> {
    const parsed = parseEstimate(low, high, unknown);

    if ('error' in parsed) {
      setError(parsed.error);
      return false;
    }

    const value = parsed.unknown
      ? { value_min_minor: null, value_max_minor: null }
      : { value_min_minor: parsed.value_min_minor, value_max_minor: parsed.value_max_minor };

    let savedOk = false;

    await run(async () => {
      const saved = await kept(() => updateSellItem(id, { ...value, advance }));
      await refresh();
      await rememberSellItem(client, saved.item, saved.token);

      if (advance) {
        anchor.current = { id, step: 'description', shot: null };
        setStep('description');
        const draft = listingDraft(saved.item);
        setListingTitle(draft.title);
        setListingDescription(draft.description);
      }

      savedOk = true;
    });

    return savedOk;
  }

  async function saveDescription(finish: boolean) {
    const title = listingTitle.trim();
    const description = listingDescription.trim();
    let savedOk = false;

    await run(async () => {
      if (!finish) {
        await kept(() => updateSellItem(id, {
          listing_title: title || null,
          listing_description: description || null,
        }));
        savedOk = true;
        return;
      }

      finishing.current = true;
      const saved = await kept(() => finishSellItem(id, {
        listing_title: title || null,
        listing_description: description || null,
      }));
      savedOk = true;
      // The board already has the saved item. The rest of the product data refreshes behind the close.
      void refresh().then(() => rememberSellItem(client, saved.item, saved.token));
      navigation.finishCreation('Ready to list');
    });

    return savedOk;
  }

  async function advancePhotos() {
    await run(async () => {
      await kept(() => updateSellItem(id, { advance: true }));
      anchor.current = { id, step: 'details', shot: null };
      setStep('details');
      setShot(null);
    });
  }

  async function continuePhoto() {
    if (!currentShot) {
      await advancePhotos();
      return;
    }

    if (shotPhoto) {
      const next = shotAfter(plan, currentShot.key);
      if (!next) {
        await advancePhotos();
        return;
      }
      anchor.current = { id, step: 'photos', shot: next };
      setShot(next);
      return;
    }

    const keys = [...new Set([...plan.filter((entry) => entry.skipped).map((entry) => entry.key), currentShot.key])];

    await run(async () => {
      await kept(() => updateSellItem(id, { skipped_shots: keys }));
      const next = shotAfter(plan.map((entry) => ({ ...entry, skipped: entry.skipped || keys.includes(entry.key) })), currentShot.key);

      if (!next) {
        await kept(() => updateSellItem(id, { advance: true }));
        anchor.current = { id, step: 'details', shot: null };
        setStep('details');
        setShot(null);
        return;
      }

      anchor.current = { id, step: 'photos', shot: next };
      setShot(next);
    });
  }

  async function sendPhoto(file: File, shotKey: string | null) {
    const body = new FormData();
    body.append('photo', file);

    if (shotKey) {
      body.append('shot_key', shotKey);
    }

    await run(async () => {
      await kept(() => uploadSellPhoto(id, body));
    });
  }

  async function choosePhoto(source: 'library' | 'camera', shotKey: string | null) {
    if (Platform.OS === 'web') {
      const file = await pickFile();

      if (file) {
        await sendPhoto(file, shotKey);
      }

      return;
    }

    const ImagePicker = await import('expo-image-picker');
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError('Photo access is off.');
      return;
    }

    const preferred = ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible;
    // A full-screen camera presented by the creation modal dismisses that modal,
    // and the cockpit sheet under it, when the camera closes.
    const presentationStyle = ImagePicker.UIImagePickerPresentationStyle.OVER_FULL_SCREEN;
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
        preferredAssetRepresentationMode: preferred,
        presentationStyle,
      })
      : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        preferredAssetRepresentationMode: preferred,
        presentationStyle,
      });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const serial = ++uploadSerial.current;
    const picked = result.assets[0];

    if (shotKey) {
      setLocalShot({ key: shotKey, uri: picked.uri });
    }

    const prepared = await prepareNativePhoto(picked);

    if (serial !== uploadSerial.current) {
      return;
    }

    if (shotKey) {
      setLocalShot({ key: shotKey, uri: prepared.uri });
    }

    setBusy(true);
    setError(null);

    try {
      const token = startSellWrite(id);
      const saved = await uploadSellPhotoFile(id, prepared.uri, prepared.mimeType, shotKey);

      if (serial !== uploadSerial.current) {
        return;
      }

      await rememberSellItem(client, saved.data, token);
    } catch (caught) {
      if (serial !== uploadSerial.current || (shotKey != null && activeShot.current !== shotKey)) {
        return;
      }

      setError(errorMessage(caught));
    } finally {
      if (serial === uploadSerial.current) {
        setBusy(false);
      }
    }
  }

  function back() {
    if (step === 'photos' && shotIndex > 0) {
      const previous = plan[shotIndex - 1].key;
      anchor.current = { id, step: 'photos', shot: previous };
      setShot(previous);
      return;
    }

    const index = ORDER.indexOf(currentStep);

    if (index <= 0) {
      exit();
      return;
    }

    const previousStep = ORDER[index - 1];
    const previousShot = previousStep === 'photos' ? (plan[plan.length - 1]?.key ?? null) : null;
    anchor.current = { id, step: previousStep, shot: previousShot };
    setStep(previousStep);
    setShot(previousShot);
  }

  function leaveIfSaved(saved: boolean) {
    if (saved) {
      leave();
      return;
    }

    setExitFailed(true);
  }

  function exit() {
    if (exitFailed) {
      void confirmAction("Couldn't save this step", 'Your draft keeps what was saved before.', { cancel: 'Keep editing', confirm: 'Leave without these changes' }).then((sure) => {
        if (sure) {
          leave();
        }
      });
      return;
    }

    if (step === 'identity') {
      const untouched = (record.name == null || record.name.trim() === '') && record.photos.length === 0 && name.trim() === '';

      if (untouched) {
        void run(async () => {
          await discardSellItem(id);
          forgetSellItem(client, id);
        }).then(leaveIfSaved);
        return;
      }

      void saveIdentity(false).then(leaveIfSaved);
      return;
    }

    if (step === 'details') {
      void saveDetails(false).then(leaveIfSaved);
      return;
    }

    if (step === 'estimate') {
      void saveEstimate(false).then(leaveIfSaved);
      return;
    }

    if (step === 'description') {
      void saveDescription(false).then(leaveIfSaved);
      return;
    }

    leave();
  }

  const title = step === 'photos' && currentShot ? currentShot.title : step === 'photos' ? 'Photos' : step === 'identity' ? 'What are you selling?' : step === 'details' ? 'A few details' : step === 'research' ? 'What could this sell for?' : step === 'description' ? 'Write the listing' : 'What do you think yours is worth?';
  const lede = step === 'photos' && currentShot
    ? currentShot.guidance
    : step === 'photos'
      ? 'You can add more photos from the product later.'
      : step === 'identity'
        ? 'The name you would use. A listing title can wait.'
        : step === 'details'
          ? category?.condition_hint
          : step === 'research'
            ? 'Sold prices are more useful than asking prices. SideHustle does not look them up for you.'
            : step === 'description'
              ? 'Paste this into a marketplace when you list it.'
              : 'An exact figure or a range. Skip it if you genuinely cannot tell.';

  return (
    <SellJourney
      step={step}
      title={title}
      lede={lede}
      onBack={back}
      onExit={exit}
      footer={footer()}
    >
      {error ? <InlineError message={error} /> : null}
      {step === 'identity' ? identityFields() : null}
      {step === 'photos' && currentShot ? shotFrame() : null}
      {step === 'photos' && !currentShot ? <T variant="body" color={color.ink2}>The suggested photos are done.</T> : null}
      {step === 'details' ? detailFields() : null}
      {step === 'research' ? researchFields() : null}
      {step === 'estimate' ? estimateFields() : null}
      {step === 'description' ? descriptionFields() : null}
    </SellJourney>
  );

  function footer() {
    if (step === 'identity') {
      return <JourneyContinue label="Continue" busy={busy} onPress={() => void saveIdentity(true)} />;
    }

    if (step === 'photos') {
      return <JourneyContinue label={currentShot ? (shotPhoto ? 'Next photo' : 'Skip this one') : 'Continue'} busy={busy} onPress={() => void continuePhoto()} />;
    }

    if (step === 'details') {
      return <JourneyContinue label="Continue" busy={busy} onPress={() => void saveDetails(true)} />;
    }

    if (step === 'research') {
      return <JourneyContinue label="Continue" busy={busy} onPress={() => void saveResearch(true)} />;
    }

    if (step === 'estimate') {
      return <JourneyContinue label={unknown ? 'Keep the value unknown' : 'Continue'} busy={busy} onPress={() => void saveEstimate(true)} />;
    }

    return <JourneyContinue label="Finish" busy={busy} onPress={() => void saveDescription(true)} />;
  }

  function identityFields() {
    return (
      <View style={{ gap: space.md }}>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Versace Medusa bomber jacket" large autoFocus />
        {(category?.identity ?? []).map((field) => field.detail ? (
          <Field key={field.key} label={field.label} value={details[field.key] ?? ''} onChangeText={(value) => setDetails((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} />
        ) : (
          <Field key={field.key} label={field.label} value={brand} onChangeText={setBrand} placeholder={field.placeholder} />
        ))}
      </View>
    );
  }

  function shotFrame() {
    if (!currentShot) {
      return null;
    }

    return (
      <View style={{ gap: space.md }}>
        <DropSurface onFile={(file) => void sendPhoto(file, currentShot.key)}>
          <View style={{ width: '100%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: sell.soft, alignItems: 'center', justifyContent: 'center' }}>
            {shotPreview ? (
              <Image key={currentShot.key} source={{ uri: shotPreview }} accessibilityLabel={currentShot.title} resizeMode="cover" fadeDuration={0} style={StyleSheet.absoluteFill} />
            ) : (
              <Icon name={sellIcon(currentShot.icon)} size={84} color={sell.ink} weight="duotone" />
            )}
          </View>
        </DropSurface>
        <Text style={{ textAlign: 'center', color: color.ink3, fontSize: 13 }}>{currentShot.recommended ? 'Recommended' : 'Optional'}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {Platform.OS !== 'web' ? <View style={{ flex: 1 }}><Button label="Take photo" icon="camera" onPress={() => void choosePhoto('camera', currentShot.key)} /></View> : null}
          <View style={{ flex: 1 }}><Button label={shotPhoto ? 'Replace' : 'Add photo'} tone={Platform.OS === 'web' ? 'primary' : 'secondary'} onPress={() => void choosePhoto('library', currentShot.key)} /></View>
        </View>
        {Platform.OS === 'web' ? <T variant="small" color={color.ink3}>Or drop a photo on the frame.</T> : null}
      </View>
    );
  }

  function descriptionFields() {
    return (
      <View style={{ gap: space.md }}>
        <Field label="Listing title" value={listingTitle} onChangeText={setListingTitle} placeholder={record.name ?? 'Listing title'} />
        <Field label="Description" value={listingDescription} onChangeText={setListingDescription} lines={6} placeholder="Optional" />
      </View>
    );
  }

  function detailFields() {
    return (
      <View style={{ gap: space.md }}>
        <View style={{ gap: space.sm }}>
          {(catalog.data?.data.conditions ?? []).map((entry) => (
            <ChoiceBlock key={entry.key} label={entry.label} selected={condition === entry.key} onPress={() => setCondition(entry.key)} />
          ))}
        </View>
        {(category?.details ?? []).map((field) => field.choices ? (
          <View key={field.key} style={{ gap: space.sm }}>
            <T variant="bodyStrong">{field.label}</T>
            {field.choices.map((choice) => (
              <ChoiceBlock key={choice} label={choice} selected={details[field.key] === choice} onPress={() => setDetails((current) => ({ ...current, [field.key]: choice }))} />
            ))}
          </View>
        ) : (
          <Field key={field.key} label={field.label} value={details[field.key] ?? ''} onChangeText={(value) => setDetails((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} />
        ))}
      </View>
    );
  }

  function researchFields() {
    return (
      <View style={{ gap: space.md }}>
        <View style={{ padding: space.md, borderRadius: 16, backgroundColor: color.surface, gap: space.sm }}>
          <T variant="small" color={color.ink3}>Copy a research prompt</T>
          <Text selectable style={{ fontSize: 15, lineHeight: 22, color: color.ink }}>{record.research_prompt}</Text>
          <Button label={copied ? 'Copied' : 'Copy prompt'} tone="secondary" onPress={() => void copyText(record.research_prompt).then(setCopied)} />
        </View>
        {record.comparables.map((comparable) => (
          <View key={comparable.id} style={{ gap: 2 }}>
            <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: comparable.state === 'sold' ? sell.ink : color.ink2 }}>{comparable.state === 'sold' ? 'SOLD' : comparable.state === 'asking' ? 'ASKING' : 'UNKNOWN'} {formatAmount(comparable.amount_minor, record.currency)}</Text>
            <T variant="small" color={color.ink3}>{comparable.platform} · {comparable.url}</T>
          </View>
        ))}
        <Field label="Link to a similar sale" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="vinted.com/…" />
        <MoneyField label="Price" value={price} onChangeText={setPrice} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><ChoiceBlock label="Sold" selected={saleState === 'sold'} onPress={() => setSaleState('sold')} /></View>
          <View style={{ flex: 1 }}><ChoiceBlock label="Asking" selected={saleState === 'asking'} onPress={() => setSaleState('asking')} /></View>
        </View>
        <Button label="Add similar sale" tone="secondary" onPress={() => void addComparable()} />
      </View>
    );
  }

  async function addComparable() {
    const draft = comparableDraft({ url: link, amount: price, state: saleState });

    if ('error' in draft) {
      setError(draft.error);
      return;
    }

    await run(async () => {
      await kept(() => addSellComparable(id, draft));
      setLink('');
      setPrice('');
    });
  }

  function estimateFields() {
    return (
      <View style={{ gap: space.md }}>
        <View pointerEvents={unknown ? 'none' : 'auto'} style={{ gap: space.sm, opacity: unknown ? 0.4 : 1 }}>
          <MoneyField label="Worth about" value={low} editable={!unknown} onChangeText={setLow} large />
          <MoneyField label="Up to, if it is a range" value={high} editable={!unknown} onChangeText={setHigh} />
        </View>
        <ChoiceBlock label="I don't know yet" selected={unknown} onPress={() => setUnknown((value) => !value)} />
      </View>
    );
  }
}

const LISTING_LONG_EDGE = 2400;
const LISTING_MAX_BYTES = 2 * 1024 * 1024;

const JPEG_PASSES = [
  { edge: 2400, compress: 0.82 },
  { edge: 2400, compress: 0.68 },
  { edge: 1800, compress: 0.68 },
  { edge: 1400, compress: 0.6 },
];

type PickedPhoto = {
  uri: string;
  mimeType?: string | null;
  width: number;
  height: number;
  fileSize?: number;
};

async function prepareNativePhoto(asset: PickedPhoto): Promise<{ uri: string; mimeType: string }> {
  const mime = asset.mimeType === 'image/jpg' ? 'image/jpeg' : (asset.mimeType ?? '');
  const longEdge = Math.max(asset.width, asset.height);
  const accepted = mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp';
  const alreadyFits = accepted && longEdge > 0 && longEdge <= LISTING_LONG_EDGE && (asset.fileSize ?? 0) > 0 && (asset.fileSize ?? 0) <= LISTING_MAX_BYTES;

  if (alreadyFits) {
    return { uri: asset.uri, mimeType: mime };
  }

  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const { File } = await import('expo-file-system');
  let source = asset.uri;
  let width = asset.width;
  let height = asset.height;

  for (const pass of JPEG_PASSES) {
    const context = ImageManipulator.manipulate(source);
    const edge = Math.max(width, height);

    if (edge > pass.edge && width > 0 && height > 0) {
      if (width >= height) {
        context.resize({ width: pass.edge });
      } else {
        context.resize({ height: pass.edge });
      }
    }

    try {
      const image = await context.renderAsync();

      try {
        const saved = await image.saveAsync({ compress: pass.compress, format: SaveFormat.JPEG });
        const size = new File(saved.uri).info().size ?? 0;
        source = saved.uri;
        width = saved.width;
        height = saved.height;

        if (size > 0 && size <= LISTING_MAX_BYTES) {
          return { uri: saved.uri, mimeType: 'image/jpeg' };
        }
      } finally {
        image.release();
      }
    } finally {
      context.release();
    }
  }

  return { uri: source, mimeType: 'image/jpeg' };
}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}
