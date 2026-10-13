import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mediaUrl } from '@/api/client';
import { completeAction, getSellItem } from '@/api/endpoints';
import { CockpitPage } from '@/components/cockpit-context';
import { GlassSurface } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import { ListingPhoto } from '@/components/listing-photo';
import { leaveSell } from '@/components/sell-flow';
import { navigation } from '@/lib/navigation';
import { Button, Field, InlineError, LoadingState, MoneyField, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange, majorToMinor } from '@/lib/money';
import { listingSuggestion } from '@/lib/sell';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

export default function SellItemScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const refresh = useRefreshProduct();
  const { color, scheme, typeColor } = useTheme();
  const phone = useLayout().phone;
  const insets = useSafeAreaInsets();
  const sell = typeColor.sell;
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const [values, setValues] = useState<Record<string, string>>({});
  const [photoId, setPhotoId] = useState<number | null>(null);
  const [viewer, setViewer] = useState(false);
  const [viewerToken, setViewerToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = itemQuery.data?.data;

  useEffect(() => {
    setPhotoId(null);
    setViewer(false);
    setValues({});
  }, [id]);

  useEffect(() => {
    const saved = item?.listing_description;

    if (!saved) {
      return;
    }

    setValues((current) => {
      if (current.listing_description !== undefined) {
        return current;
      }

      return { ...current, listing_description: saved };
    });
  }, [item?.listing_description]);

  if (itemQuery.isLoading || !item) {
    return <LoadingState label="Loading the item" />;
  }

  if (itemQuery.isError) {
    return <InlineError message={errorMessage(itemQuery.error)} />;
  }

  const record = item;
  const shown = item.photos.find((photo) => photo.id === photoId) ?? item.photos.find((photo) => photo.is_cover) ?? item.photos[0] ?? null;
  const shownUrl = shown?.url ?? item.cover_url;
  const shownUri = shownUrl ? mediaUrl(shownUrl) : null;
  const suggestion = listingSuggestion(item);
  const range = formatAmountRange(record.value_min_minor, record.value_max_minor, record.currency);
  const asking = item.asking_price_minor != null ? formatAmount(item.asking_price_minor, item.currency) : null;
  const next = item.next;

  async function finishAction() {
    if (!next) {
      return;
    }

    const input: Record<string, unknown> = {};

    for (const field of next.fields ?? []) {
      const raw = values[field.key] ?? '';

      if (field.type === 'money') {
        if (raw.trim() === '' && !field.required) {
          continue;
        }

        const amount = majorToMinor(raw);

        if (amount == null) {
          setError(`Enter ${field.label.toLowerCase()}.`);
          return;
        }

        input[field.key] = amount;
      } else if (raw.trim() !== '') {
        input[field.key] = raw.trim();
      } else if (field.required) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setBusy(true);
    setError(null);

    try {
      await completeAction(record.opportunity_id, next.id, input);
      await refresh();
      await itemQuery.refetch();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const page = (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to Sell" onPress={() => leaveSell(router)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={16} color={sell.ink} />
        <Text style={{ color: sell.ink }}>Sell</Text>
      </Pressable>
      <View style={{ flexDirection: phone ? 'column' : 'row', gap: space.xl, alignItems: 'flex-start' }}>
      <View style={{ width: phone ? '100%' : 360, gap: space.sm }}>
      {shownUri ? (
        <View style={{ width: '100%', borderRadius: 20, overflow: 'hidden' }}>
          <ListingPhoto uri={shownUri} label={item.name ?? 'Item photo'} aspectRatio={phone ? 4 / 5 : 1} />
          {shown ? (
            <View style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 8 }}>
              <PhotoGlass name="pencil" label="Edit this picture" scheme={scheme} ink={color.ink} onPress={() => router.push(shown.collage ? `/sell/items/${id}/collage?photo=${shown.id}` : `/sell/items/${id}/edit?photo=${shown.id}`)} />
              <PhotoGlass name="eye" label="View full screen" scheme={scheme} ink={color.ink} onPress={() => { setViewerToken((token) => token + 1); setViewer(true); }} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ width: '100%', height: phone ? 220 : 360, borderRadius: 20, backgroundColor: sell.soft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: font.display, fontWeight: weight.bold, fontSize: 48, color: sell.ink }}>{(item.name ?? 'Item').trim().charAt(0).toUpperCase()}</Text>
        </View>
      )}
      {item.photos.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {item.photos.map((photo) => {
            const selected = shown?.id === photo.id;

            return (
              <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel="Show this photo" accessibilityState={{ selected }} onPress={() => setPhotoId(photo.id)} style={{ borderRadius: 12, borderWidth: 2, borderColor: selected ? sell.ink : 'transparent' }}>
                <Image source={{ uri: mediaUrl(photo.url) }} style={{ width: 64, height: 64, borderRadius: 10 }} />
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" accessibilityLabel="Add collage" onPress={() => router.push(`/sell/items/${id}/collage`)} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: sell.soft, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Icon name="plus" size={18} color={sell.ink} />
            <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 9, color: sell.ink }}>Collage</Text>
          </Pressable>
        </View>
      ) : null}
      </View>
      <View style={{ flex: phone ? undefined : 1, gap: space.lg, minWidth: 0, width: phone ? '100%' : undefined, maxWidth: phone ? '100%' : 520 }}>
      <View style={{ gap: 4 }}>
        <T variant="eyebrow">{item.subcategory_label ?? item.category_label}</T>
        <T variant="title">{item.name ?? 'Untitled item'}</T>
        {range ? <T variant="body">{range} possible</T> : null}
        {asking ? <T variant="body" color={color.ink2}>{asking} asking{item.listed_on ? ` on ${item.listed_on}` : ''}</T> : null}
        {!item.setup_done ? <T variant="body" color={color.ink2}>Setup incomplete. Next: {item.next_step_label}</T> : <T variant="small" color={color.ink3}>{item.stage_label}</T>}
      </View>
      {!item.setup_done ? <Button label="Continue setup" iconRight="arrowRight" size="lg" onPress={() => navigation.resumeCreation('sell', item.id)} /> : null}
      {item.listing_description && next?.playbook_key !== 'prepare_item' ? (
        <View style={{ gap: 6 }}>
          <T variant="eyebrow">Listing description</T>
          <T variant="body">{item.listing_description}</T>
        </View>
      ) : null}
      {item.setup_done && next ? (
        <View style={{ gap: space.md }}>
          <T variant="heading">{next.title}</T>
          {next.description ? <T variant="body" color={color.ink2}>{next.description}</T> : null}
          {next.playbook_key === 'prepare_item' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Use the suggested description" onPress={() => setValues((current) => ({ ...current, listing_description: suggestion }))} style={{ gap: 6, padding: space.md, borderRadius: 14, backgroundColor: sell.soft }}>
              <T variant="eyebrow">A starting point</T>
              <T variant="body">{suggestion}</T>
              <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: sell.ink }}>Use this</Text>
            </Pressable>
          ) : null}
          {(next.fields ?? []).map((field) => field.type === 'money' ? (
            <MoneyField key={field.key} label={field.label} value={values[field.key] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
          ) : (
            <Field key={field.key} label={field.label} lines={field.key === 'listing_description' ? 5 : 1} value={values[field.key] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} autoCapitalize={field.key.includes('url') ? 'none' : 'sentences'} />
          ))}
          {error ? <InlineError message={error} /> : null}
          <Button label={next.completion === 'form' ? 'Save' : 'Done'} size="lg" busy={busy} onPress={() => void finishAction()} />
        </View>
      ) : null}
      {item.comparables.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <T variant="eyebrow">Similar sales</T>
          {item.comparables.map((comparable) => (
            <Text key={comparable.id} style={{ color: color.ink2 }}>{comparable.state === 'sold' ? 'Sold' : 'Asking'} {formatAmount(comparable.amount_minor, item.currency)} · {comparable.platform}</Text>
          ))}
        </View>
      ) : null}
      </View>
      </View>
    </>
  );

  const screen = phone ? (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space.lg, paddingHorizontal: space.md, paddingTop: Platform.OS === 'ios' ? insets.top : 0, paddingBottom: Platform.OS === 'ios' ? 120 : 48 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {page}
    </ScrollView>
  ) : (
    <View style={{ gap: space.lg, paddingBottom: 40 }}>{page}</View>
  );

  return (
    <>
      <CockpitPage>{screen}</CockpitPage>
      <Modal visible={viewer && shownUri != null} transparent animationType="fade" onRequestClose={() => setViewer(false)}>
        {shownUri ? <PhotoViewer key={viewerToken} uri={shownUri} label={item.name ?? 'Item photo'} onClose={() => setViewer(false)} /> : null}
      </Modal>
    </>
  );
}

function PhotoViewer({ uri, label, onClose }: { uri: string; label: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const close = useRef(onClose);
  close.current = onClose;
  const dismiss = useCallback(() => {
    close.current();
  }, []);
  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-8, 8])
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const distance = Math.abs(event.translationY);
      const flung = Math.abs(event.velocityY) > 900;

      if (distance > 120 || flung) {
        const direction = event.translationY < 0 ? -1 : 1;
        translateY.value = withTiming(direction * 700, { duration: 180 }, (finished) => {
          if (finished) {
            runOnJS(dismiss)();
          }
        });
        return;
      }

      translateY.value = withSpring(0, { damping: 22, stiffness: 240 });
    }), [dismiss, translateY]);
  const photoStyle = useAnimatedStyle(() => {
    const distance = Math.abs(translateY.value);

    return {
      transform: [
        { translateY: translateY.value },
        { scale: interpolate(distance, [0, 280], [1, 0.86], Extrapolation.CLAMP) },
      ],
    };
  });
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translateY.value), [0, 240], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#000000' }, fadeStyle]} />
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, photoStyle]}>
          <Image source={{ uri }} accessibilityLabel={label} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      </GestureDetector>
      <Animated.View style={[{ position: 'absolute', top: insets.top + 8, right: 12 }, fadeStyle]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={22} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

function PhotoGlass({ name, label, scheme, ink, onPress }: { name: IconName; label: string; scheme: 'light' | 'dark'; ink: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ width: 44, height: 44 }}>
      <GlassSurface scheme={scheme} interactive style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
        <View pointerEvents="none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={name} size={20} color={ink} weight="bold" />
        </View>
      </GlassSurface>
    </Pressable>
  );
}
