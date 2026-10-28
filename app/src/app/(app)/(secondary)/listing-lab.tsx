import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mediaUrl } from '@/api/client';
import { getSellCatalog, getSellItem, listSellItems } from '@/api/endpoints';
import type { SellItemView } from '@/api/types';
import { Button, Field, InlineError, LinkButton, PageHeader, Panel, Segmented, T } from '@/components/ui';
import { space } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import {
  cancelListingGeneration,
  generateListing,
  getListingAvailability,
  listingErrorCode,
  type ListingAvailability,
  type ListingResult,
} from '@/lib/listing-generation';
import { listingFacts, listingLabPhotos, listingLabSuggestion, prepareListingPhotos } from '@/lib/listing-lab';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';

type LabMode = 'text' | 'one' | 'three';
type LabLanguage = 'en' | 'nl';
type LabRun = (ListingResult & { language: LabLanguage }) | { error: string; language: LabLanguage };

export default function ListingLabScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      router.dismissTo('/');
    }
  }, [router]);

  if (!__DEV__) {
    return null;
  }

  return <ListingLab />;
}

function ListingLab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { color, scheme } = useTheme();
  const { user } = useAuth();
  const [itemId, setItemId] = useState('');
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [language, setLanguage] = useState<LabLanguage>('en');
  const [busy, setBusy] = useState<LabMode | null>(null);
  const [runs, setRuns] = useState<Partial<Record<LabMode, LabRun>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const availabilityQuery = useQuery({ queryKey: ['listing-lab', 'availability'], queryFn: getListingAvailability });
  const catalogQuery = useQuery({ queryKey: ['sell', 'catalog'], queryFn: getSellCatalog, enabled: user != null });
  const itemsQuery = useQuery({ queryKey: ['sell', 'items'], queryFn: listSellItems, enabled: user != null });
  const itemQuery = useQuery({
    queryKey: ['sell', 'item', loadedId],
    queryFn: () => getSellItem(loadedId as number),
    enabled: loadedId != null,
  });

  useEffect(() => {
    return () => {
      cancelListingGeneration();
    };
  }, []);

  const availability = availabilityQuery.data;
  const item = itemQuery.data?.data ?? null;
  const photos = item ? listingLabPhotos(item) : [];
  const facts = item ? listingFacts(item, catalogQuery.data?.data) : [];
  const ready = availability?.state === 'ready';
  const vision = ready && availability.vision;

  function close() {
    cancelListingGeneration();
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.dismissTo('/');
  }

  function load() {
    const id = Number(itemId.trim());
    if (!Number.isFinite(id) || id < 1) {
      setMessage('Enter a sell item id.');
      return;
    }

    setMessage(null);
    setRuns({});
    setLoadedId(id);
  }

  async function run(mode: LabMode) {
    if (!item || !ready) {
      return;
    }

    const count = mode === 'text' ? 0 : mode === 'one' ? 1 : 3;
    cancelListingGeneration();
    setBusy(mode);
    setMessage(null);

    try {
      const photoPaths = count === 0 ? [] : await prepareListingPhotos(photos, count);
      const result = await generateListing({ language, facts, photoPaths });
      setRuns((current) => ({ ...current, [mode]: { ...result, language } }));
    } catch (error) {
      if (listingErrorCode(error) === 'cancelled') {
        return;
      }

      setRuns((current) => ({
        ...current,
        [mode]: { error: errorMessage(error), language },
      }));
    } finally {
      setBusy((current) => (current === mode ? null : current));
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: Math.max(insets.bottom, 24) + 16,
          paddingHorizontal: 20,
          gap: space.lg,
          maxWidth: 880,
          width: '100%',
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          title="Listing lab"
          subtitle="On-device Apple Intelligence. Nothing is saved."
          action={<LinkButton label="Close" onPress={close} />}
        />

        <AvailabilityCard availability={availability ?? null} loading={availabilityQuery.isLoading} />

        {user == null ? <InlineError message="Sign in first, then open this lab from Profile." /> : null}

        <Panel padding="lg" style={{ gap: space.md }}>
          <Field label="Sell item id" value={itemId} onChangeText={setItemId} keyboardType="number-pad" placeholder="42" />
          <Button label="Load" onPress={load} disabled={user == null} />
          {itemsQuery.data?.data?.length ? (
            <View style={{ gap: space.sm }}>
              <T variant="small" color={color.ink3}>Recent items</T>
              {itemsQuery.data.data.slice(0, 8).map((entry) => (
                <LinkButton
                  key={entry.id}
                  label={`${entry.id} · ${entry.name?.trim() || entry.listing_title?.trim() || 'Untitled'}`}
                  onPress={() => {
                    setItemId(String(entry.id));
                    setMessage(null);
                    setRuns({});
                    setLoadedId(entry.id);
                  }}
                />
              ))}
            </View>
          ) : null}
        </Panel>

        {message ? <InlineError message={message} /> : null}
        {itemQuery.isError ? <InlineError message={errorMessage(itemQuery.error)} /> : null}

        {item ? (
          <ItemCard item={item} facts={facts} photos={photos} />
        ) : loadedId != null && itemQuery.isLoading ? (
          <T variant="body" color={color.ink2}>Loading item {loadedId}…</T>
        ) : null}

        <Panel padding="lg" style={{ gap: space.md }}>
          <Segmented
            label="Language"
            value={language}
            options={[
              { value: 'en', label: 'English' },
              { value: 'nl', label: 'Dutch' },
            ]}
            onChange={setLanguage}
          />
          {ready && availability.supportsEnglish === false ? <T variant="small" color={color.ink3}>English is not in this model's locale list.</T> : null}
          {ready && availability.supportsDutch === false ? <T variant="small" color={color.ink3}>Dutch is not in this model's locale list.</T> : null}
          <View style={{ gap: space.sm }}>
            <Button label="Text only" onPress={() => void run('text')} disabled={!item || !ready} busy={busy === 'text'} />
            <Button
              label="One photo"
              tone="secondary"
              onPress={() => void run('one')}
              disabled={!item || !ready || !vision || photos.length < 1}
              busy={busy === 'one'}
            />
            <Button
              label="Three photos"
              tone="secondary"
              onPress={() => void run('three')}
              disabled={!item || !ready || !vision || photos.length < 3}
              busy={busy === 'three'}
            />
            {busy ? <Button label="Cancel" tone="ghost" onPress={() => cancelListingGeneration()} /> : null}
          </View>
          {!ready ? <T variant="small" color={color.ink3}>Generation waits until the on-device model is ready.</T> : null}
          {ready && !vision ? <T variant="small" color={color.ink3}>This model has no vision. Photo runs stay off.</T> : null}
          {ready && vision && photos.length < 1 ? <T variant="small" color={color.ink3}>This item has no photos for a vision run.</T> : null}
          {ready && vision && photos.length > 0 && photos.length < 3 ? <T variant="small" color={color.ink3}>This item has {photos.length} lab photo{photos.length === 1 ? '' : 's'}. Three-photo stays off.</T> : null}
        </Panel>

        <ResultCard title="Text only" run={runs.text} />
        <ResultCard title="One photo" run={runs.one} />
        <ResultCard title="Three photos" run={runs.three} />
      </ScrollView>
    </View>
  );
}

function AvailabilityCard({ availability, loading }: { availability: ListingAvailability | null; loading: boolean }) {
  const { color } = useTheme();

  if (loading && availability == null) {
    return (
      <Panel padding="lg">
        <T variant="body" color={color.ink2}>Checking Apple Intelligence…</T>
      </Panel>
    );
  }

  if (availability == null || availability.state === 'unsupported') {
    return (
      <Panel padding="lg">
        <T variant="bodyStrong">Unsupported</T>
        <T variant="body" color={color.ink2}>This build cannot reach Foundation Models. iPhone, iOS 26+, and a development client are required.</T>
      </Panel>
    );
  }

  if (availability.state === 'unavailable') {
    const reason =
      availability.reason === 'appleIntelligenceNotEnabled'
        ? 'Apple Intelligence is off in Settings.'
        : availability.reason === 'modelNotReady'
          ? 'The on-device model is still preparing.'
          : 'This iPhone is not eligible for Apple Intelligence.';

    return (
      <Panel padding="lg" style={{ gap: space.sm }}>
        <T variant="bodyStrong">Unavailable · {availability.reason}</T>
        <T variant="body" color={color.ink2}>{reason}</T>
      </Panel>
    );
  }

  return (
    <Panel padding="lg" style={{ gap: space.sm }}>
      <T variant="bodyStrong">Ready</T>
      <T variant="body" color={color.ink2}>
        Vision {availability.vision ? 'yes' : 'no'} · context {availability.contextSize} · English {availability.supportsEnglish ? 'yes' : 'no'} · Dutch {availability.supportsDutch ? 'yes' : 'no'}
      </T>
    </Panel>
  );
}

function ItemCard({ item, facts, photos }: { item: SellItemView; facts: ReturnType<typeof listingFacts>; photos: ReturnType<typeof listingLabPhotos> }) {
  const { color } = useTheme();
  const suggestion = listingLabSuggestion(item);

  return (
    <View style={{ gap: space.md }}>
      <Panel padding="lg" style={{ gap: space.sm }}>
        <T variant="bodyStrong">{item.name?.trim() || 'Untitled item'}</T>
        <T variant="small" color={color.ink3}>Internal name stays separate from a marketplace title.</T>
        {facts.map((fact) => (
          <T key={`${fact.label}:${fact.value}`} variant="body">{fact.label}: {fact.value}</T>
        ))}
      </Panel>
      <Panel padding="lg" style={{ gap: space.sm }}>
        <T variant="bodyStrong">Lab photos · {photos.length}</T>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {photos.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: mediaUrl(photo.original_url) }}
              accessibilityLabel={photo.shot_key ?? 'photo'}
              style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: color.sunken }}
            />
          ))}
        </View>
      </Panel>
      <Panel padding="lg" style={{ gap: space.sm }}>
        <T variant="bodyStrong">Deterministic suggestion</T>
        <T variant="body">{suggestion}</T>
      </Panel>
    </View>
  );
}

function ResultCard({ title, run }: { title: string; run: LabRun | undefined }) {
  const { color } = useTheme();

  if (!run) {
    return null;
  }

  if ('error' in run) {
    return (
      <Panel padding="lg" style={{ gap: space.sm }}>
        <T variant="bodyStrong">{title} · {run.language === 'nl' ? 'Dutch' : 'English'}</T>
        <InlineError message={run.error} />
      </Panel>
    );
  }

  const tokens = [
    `${run.elapsedMs} ms`,
    run.inputTokens != null ? `in ${run.inputTokens}` : 'in —',
    run.outputTokens != null ? `out ${run.outputTokens}` : 'out —',
    `photos ${run.photosAttached}`,
  ].join(' · ');

  return (
    <Panel padding="lg" style={{ gap: space.sm }}>
      <T variant="bodyStrong">{title} · {run.language === 'nl' ? 'Dutch' : 'English'}</T>
      <T variant="small" color={color.ink3}>{tokens}</T>
      <T variant="body">{run.listingTitle}</T>
      <T variant="body" color={color.ink2}>{run.listingDescription}</T>
      {run.uncertainObservations.length > 0 ? (
        <View style={{ gap: 4 }}>
          <T variant="small" color={color.ink3}>Uncertain observations</T>
          {run.uncertainObservations.map((entry) => (
            <T key={entry} variant="small">{entry}</T>
          ))}
        </View>
      ) : (
        <T variant="small" color={color.ink3}>No uncertain observations.</T>
      )}
    </Panel>
  );
}
