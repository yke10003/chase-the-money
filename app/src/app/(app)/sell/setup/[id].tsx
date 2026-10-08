import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';

import {
  addSellComparable,
  deleteSellPhoto,
  finishSellItem,
  getSellCatalog,
  getSellItem,
  reorderSellPhotos,
  coverSellPhoto,
  updateSellItem,
  uploadSellPhoto,
} from '@/api/endpoints';
import type { SellItemView, SellStep } from '@/api/types';
import { ChoiceBlock, DropSurface, SellJourney, sellIcon, useLeaveSell } from '@/components/sell-flow';
import { Icon } from '@/components/icon';
import { Button, Field, InlineError, LoadingState, MoneyField, T } from '@/components/ui';
import { font, space, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange, majorToMinor, minorToMajorInput } from '@/lib/money';
import { copyText, parseEstimate } from '@/lib/sell';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

const ORDER: SellStep[] = ['identity', 'photos', 'details', 'research', 'estimate'];

export default function SellSetupScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const leave = useLeaveSell();
  const refresh = useRefreshProduct();
  const client = useQueryClient();
  const { color, typeColor, accent } = useTheme();
  const sell = typeColor.sell;
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const catalog = useQuery({ queryKey: ['sell', 'catalog'], queryFn: getSellCatalog });
  const item = itemQuery.data?.data;
  const [step, setStep] = useState<SellStep | null>(null);
  const [shot, setShot] = useState<string | 'review'>('review');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [details, setDetails] = useState<Record<string, string>>({});
  const [condition, setCondition] = useState<string | null>(null);
  const [low, setLow] = useState('');
  const [high, setHigh] = useState('');
  const [unknown, setUnknown] = useState(false);
  const [confidence, setConfidence] = useState<'sure' | 'rough' | null>(null);
  const [link, setLink] = useState('');
  const [price, setPrice] = useState('');
  const [saleState, setSaleState] = useState<'sold' | 'asking'>('sold');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SellItemView | null>(null);

  useEffect(() => {
    if (!item || step !== null) {
      return;
    }

    if (item.setup_done) {
      router.replace(`/sell/items/${item.id}`);
      return;
    }

    setStep(item.setup_step);
    setName(item.name ?? '');
    setBrand(item.brand ?? '');
    setDetails(item.details ?? {});
    setCondition(item.condition);
    setLow(minorToMajorInput(item.value_min_minor));
    setHigh(item.value_max_minor != null && item.value_max_minor !== item.value_min_minor ? minorToMajorInput(item.value_max_minor) : '');
    const first = item.photo_plan.find((entry) => entry.recommended && !entry.taken) ?? item.photo_plan[0];
    setShot(first?.key ?? 'review');
  }, [item, router, step]);

  function remember(next: SellItemView) {
    client.setQueryData(['sell', 'item', id], { data: next });
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);

    try {
      await work();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!item || !step || catalog.isLoading) {
    return <LoadingState label="Loading the item" />;
  }

  const record = item;
  const currentStep = step;

  if (itemQuery.isError) {
    return <InlineError message={errorMessage(itemQuery.error)} />;
  }

  const category = catalog.data?.data.categories.find((entry) => entry.key === item.category);
  const plan = item.photo_plan;
  const shotIndex = plan.findIndex((entry) => entry.key === shot);
  const currentShot = shotIndex >= 0 ? plan[shotIndex] : null;
  const shotPhoto = currentShot ? item.photos.find((photo) => photo.shot_key === currentShot.key) ?? null : null;
  const backdrop = item.cover_url && !shotPhoto ? item.cover_url : null;

  async function saveIdentity(advance: boolean) {
    const trimmed = name.trim();

    if (advance && trimmed === '') {
      setError('Name the item first.');
      return;
    }

    const detailPatch: Record<string, string> = {};

    for (const field of category?.identity ?? []) {
      if (field.detail) {
        detailPatch[field.key] = details[field.key] ?? '';
      }
    }

    await run(async () => {
      const next = await updateSellItem(id, {
        name: trimmed,
        brand: brand.trim() || null,
        details: detailPatch,
        advance,
      });
      remember(next.data);

      if (advance) {
        setStep('photos');
      }
    });
  }

  async function saveDetails(advance: boolean) {
    await run(async () => {
      const next = await updateSellItem(id, { condition, details, advance });
      remember(next.data);

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
      const next = await updateSellItem(id, { advance: true });
      remember(next.data);
      setStep('estimate');
    });
  }

  async function saveEstimate() {
    const parsed = parseEstimate(low, high, unknown);

    if ('error' in parsed) {
      setError(parsed.error);
      return;
    }

    await run(async () => {
      const next = await finishSellItem(id, parsed.unknown
        ? { unknown: true }
        : { value_min_minor: parsed.value_min_minor, value_max_minor: parsed.value_max_minor, value_confidence: confidence });
      await refresh();
      setDone(next.data);
    });
  }

  async function sendPhoto(file: File | { uri: string; name: string; type: string }, shotKey: string | null) {
    const body = new FormData();
    body.append('photo', file as unknown as Blob);

    if (shotKey) {
      body.append('shot_key', shotKey);
    }

    await run(async () => {
      const next = await uploadSellPhoto(id, body);
      remember(next.data);
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

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    await sendPhoto({ uri: asset.uri, name: 'photo.jpg', type: asset.mimeType ?? 'image/jpeg' }, shotKey);
  }

  function nextShot() {
    if (shot === 'review') {
      void run(async () => {
        const next = await updateSellItem(id, { advance: true });
        remember(next.data);
        setStep('details');
      });
      return;
    }

    const following = plan[shotIndex + 1];
    setShot(following?.key ?? 'review');
  }

  function back() {
    if (step === 'photos' && shot === 'review') {
      setShot(plan[plan.length - 1]?.key ?? 'review');
      return;
    }

    if (step === 'photos' && shotIndex > 0) {
      setShot(plan[shotIndex - 1].key);
      return;
    }

    const index = ORDER.indexOf(currentStep);

    if (index <= 0) {
      leave();
      return;
    }

    setStep(ORDER[index - 1]);

    if (ORDER[index - 1] === 'photos') {
      setShot('review');
    }
  }

  function exit() {
    if (step === 'identity') {
      void saveIdentity(false).then(() => leave());
      return;
    }

    if (step === 'details') {
      void saveDetails(false).then(() => leave());
      return;
    }

    leave();
  }

  if (done) {
    const range = formatAmountRange(done.value_min_minor, done.value_max_minor, done.currency);

    return (
      <SellJourney step="estimate" title="Ready for the next step" onExit={() => router.replace(`/sell/items/${done.id}`)} footer={<Button label="Prepare the listing" iconRight="arrowRight" size="lg" onPress={() => router.replace(`/sell/items/${done.id}`)} />}>
        {done.cover_url ? <Image source={{ uri: done.cover_url }} style={{ width: '100%', aspectRatio: 1, borderRadius: 20 }} /> : null}
        <T variant="heading">{done.name}</T>
        <T variant="body" color={color.ink2}>{range ? `${range} possible` : 'Value still unknown'}</T>
        <T variant="body" color={color.ink2}>{done.photos.length} photos · {done.comparables.length} similar sales</T>
        {done.xp_earned > 0 ? <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: accent.sell.from }}>+{done.xp_earned} XP</Text> : null}
      </SellJourney>
    );
  }

  const title = step === 'photos' && currentShot ? currentShot.title : step === 'photos' ? 'Your photos' : step === 'identity' ? 'What are you selling?' : step === 'details' ? 'A few details' : step === 'research' ? 'What could this sell for?' : 'What do you think yours is worth?';
  const lede = step === 'photos' && currentShot
    ? currentShot.guidance
    : step === 'photos'
      ? 'The first photo is the cover. Move them if you want a different order.'
      : step === 'identity'
        ? 'The name you would use. A listing title can wait.'
        : step === 'details'
          ? category?.condition_hint
          : step === 'research'
            ? 'Sold prices are more useful than asking prices. SideHustle does not look them up for you.'
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
      {step === 'photos' && shot === 'review' ? photoBoard() : null}
      {step === 'details' ? detailFields() : null}
      {step === 'research' ? researchFields() : null}
      {step === 'estimate' ? estimateFields() : null}
    </SellJourney>
  );

  function footer() {
    if (step === 'identity') {
      return <Button label="Continue" size="lg" busy={busy} onPress={() => void saveIdentity(true)} />;
    }

    if (step === 'photos' && currentShot) {
      return (
        <View style={{ gap: space.sm }}>
          <Button label={shotPhoto ? 'Next photo' : 'Skip this one'} size="lg" busy={busy} onPress={nextShot} />
          <Text style={{ textAlign: 'center', color: color.ink3, fontSize: 13 }}>{currentShot.recommended ? 'Recommended' : 'Optional'}</Text>
        </View>
      );
    }

    if (step === 'photos') {
      return <Button label="Continue" size="lg" busy={busy} onPress={nextShot} />;
    }

    if (step === 'details') {
      return <Button label="Continue" size="lg" busy={busy} onPress={() => void saveDetails(true)} />;
    }

    if (step === 'research') {
      return <Button label="Continue" size="lg" busy={busy} onPress={() => void saveResearch(true)} />;
    }

    return <Button label={unknown ? 'Keep the value unknown' : 'Save the estimate'} size="lg" busy={busy} onPress={() => void saveEstimate()} />;
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
            {backdrop ? <Image source={{ uri: backdrop }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.35 }} /> : null}
            {shotPhoto ? <Image source={{ uri: shotPhoto.url }} accessibilityLabel={currentShot.title} style={{ width: '100%', height: '100%' }} /> : <Icon name={sellIcon(currentShot.icon)} size={84} color={sell.ink} weight="duotone" />}
          </View>
        </DropSurface>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {Platform.OS !== 'web' ? <View style={{ flex: 1 }}><Button label="Take photo" icon="camera" onPress={() => void choosePhoto('camera', currentShot.key)} /></View> : null}
          <View style={{ flex: 1 }}><Button label={shotPhoto ? 'Replace' : 'Add photo'} tone={Platform.OS === 'web' ? 'primary' : 'secondary'} onPress={() => void choosePhoto('library', currentShot.key)} /></View>
        </View>
        {Platform.OS === 'web' ? <T variant="small" color={color.ink3}>Or drop a photo on the frame.</T> : null}
      </View>
    );
  }

  function photoBoard() {
    return (
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {record.photos.map((photo, index) => (
            <View key={photo.id} style={{ width: '48%', gap: 6 }}>
              <Image source={{ uri: photo.url }} style={{ width: '100%', aspectRatio: 1, borderRadius: 14 }} />
              <Text style={{ fontSize: 12, color: color.ink3 }}>{photo.is_cover ? 'Cover' : photo.shot_key ?? 'Extra'}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Move earlier" disabled={index === 0} onPress={() => void move(index, -1)}><Text style={{ color: color.ink2 }}>Up</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Move later" disabled={index === record.photos.length - 1} onPress={() => void move(index, 1)}><Text style={{ color: color.ink2 }}>Down</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Make cover" onPress={() => void run(async () => remember((await coverSellPhoto(id, photo.id)).data))}><Text style={{ color: sell.ink }}>Cover</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Delete photo" onPress={() => void run(async () => remember((await deleteSellPhoto(id, photo.id)).data))}><Text style={{ color: color.danger }}>Delete</Text></Pressable>
              </View>
            </View>
          ))}
        </View>
        {record.photos.length === 0 ? <T variant="body" color={color.ink2}>No photos yet. You can add some, or continue and come back.</T> : null}
        <Button label="Add another photo" tone="secondary" onPress={() => void choosePhoto('library', null)} />
      </View>
    );
  }

  async function move(index: number, direction: -1 | 1) {
    const ids = record.photos.map((photo) => photo.id);
    const target = index + direction;
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved);
    await run(async () => remember((await reorderSellPhotos(id, ids)).data));
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
        <Field label="Link to a similar sale" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://" />
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
    const amount = majorToMinor(price);

    if (amount == null) {
      setError('Enter the price you saw.');
      return;
    }

    await run(async () => {
      const next = await addSellComparable(id, { url: link.trim(), amount_minor: amount, state: saleState });
      remember(next.data);
      setLink('');
      setPrice('');
    });
  }

  function estimateFields() {
    return (
      <View style={{ gap: space.md }}>
        {unknown ? null : (
          <View style={{ gap: space.sm }}>
            <MoneyField label="Worth about" value={low} onChangeText={setLow} large />
            <MoneyField label="Up to, if it is a range" value={high} onChangeText={setHigh} />
          </View>
        )}
        <ChoiceBlock label="I don't know yet" selected={unknown} onPress={() => setUnknown((value) => !value)} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}><ChoiceBlock label="Pretty sure" selected={confidence === 'sure'} onPress={() => setConfidence('sure')} /></View>
          <View style={{ flex: 1 }}><ChoiceBlock label="Rough estimate" selected={confidence === 'rough'} onPress={() => setConfidence('rough')} /></View>
        </View>
      </View>
    );
  }
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
