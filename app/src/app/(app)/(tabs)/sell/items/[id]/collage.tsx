import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';

import { mediaUrl } from '@/api/client';
import { getSellItem, saveSellCollage } from '@/api/endpoints';
import type { SellPhoto } from '@/api/types';
import { BackgroundSwatches } from '@/components/background-swatches';
import { CockpitPage } from '@/components/cockpit-context';
import { Icon } from '@/components/icon';
import { Button, InlineError, LoadingState, T } from '@/components/ui';
import { font, space, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useTheme } from '@/state/theme';

type SlotName = 'left' | 'top' | 'bottom';

type SlotState = { id: number | null; zoom: number };

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;

function readCollage(collage: SellPhoto['collage']): { background: string; slots: SlotState[] } {
  if (Array.isArray(collage)) {
    return { background: '#FFFFFF', slots: collage.map((entry) => readSlot(entry)) };
  }

  if (collage && typeof collage === 'object') {
    return {
      background: collage.background ?? '#FFFFFF',
      slots: (collage.slots ?? []).map((entry) => readSlot(entry)),
    };
  }

  return { background: '#FFFFFF', slots: [] };
}

function readSlot(entry: number | { id: number; zoom?: number } | undefined): SlotState {
  if (typeof entry === 'number') {
    return { id: entry, zoom: 1 };
  }

  if (entry && typeof entry === 'object') {
    return { id: entry.id, zoom: clampZoom(entry.zoom ?? 1) };
  }

  return { id: null, zoom: 1 };
}

function clampZoom(zoom: number): number {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) * 10) / 10;
}

export default function CollageScreen() {
  const params = useLocalSearchParams<{ id: string; photo?: string }>();
  const id = Number(params.id);
  const collageId = params.photo ? Number(params.photo) : null;
  const router = useRouter();
  const client = useQueryClient();
  const { color, typeColor } = useTheme();
  const sell = typeColor.sell;
  const itemQuery = useQuery({ queryKey: ['sell', 'item', id], queryFn: () => getSellItem(id), enabled: Number.isFinite(id) });
  const item = itemQuery.data?.data;
  const existing = item?.photos.find((photo) => photo.id === collageId && photo.collage) ?? null;
  const sources = item?.photos.filter((photo) => !photo.collage) ?? [];
  const [slots, setSlots] = useState<Record<SlotName, SlotState>>({
    left: { id: null, zoom: 1 },
    top: { id: null, zoom: 1 },
    bottom: { id: null, zoom: 1 },
  });
  const [background, setBackground] = useState('#FFFFFF');
  const [seeded, setSeeded] = useState(false);
  const [active, setActive] = useState<SlotName | null>(null);
  const [picking, setPicking] = useState<SlotName | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kept = useRef(0);

  useEffect(() => {
    if (!existing?.collage || seeded) {
      return;
    }

    const layout = readCollage(existing.collage);
    setBackground(layout.background);
    setSlots({
      left: layout.slots[0] ?? { id: null, zoom: 1 },
      top: layout.slots[1] ?? { id: null, zoom: 1 },
      bottom: layout.slots[2] ?? { id: null, zoom: 1 },
    });
    setSeeded(true);
  }, [existing, seeded]);

  if (itemQuery.isLoading || !item) {
    return <LoadingState label="Loading photos" />;
  }

  const chosen = {
    left: sources.find((photo) => photo.id === slots.left.id) ?? null,
    top: sources.find((photo) => photo.id === slots.top.id) ?? null,
    bottom: sources.find((photo) => photo.id === slots.bottom.id) ?? null,
  };
  const ready = Boolean(chosen.left && chosen.top && chosen.bottom);
  const activeSlot = active ? slots[active] : null;
  const activePhoto = active ? chosen[active] : null;

  function keepSelection() {
    kept.current = Date.now();
  }

  function clearSelection() {
    if (Date.now() - kept.current < 300) {
      return;
    }

    setActive(null);
    setPicking(null);
  }

  function pressSlot(name: SlotName) {
    if (active === name) {
      setActive(null);
      setPicking(null);
      return;
    }

    setActive(name);
    setPicking(slots[name].id ? null : name);
  }

  function fill(photo: SellPhoto) {
    if (!picking) {
      return;
    }

    setSlots((current) => ({ ...current, [picking]: { id: photo.id, zoom: 1 } }));
    setActive(picking);
    setPicking(null);
  }

  function zoomBy(delta: number) {
    if (!active) {
      return;
    }

    setSlots((current) => ({
      ...current,
      [active]: { ...current[active], zoom: clampZoom(current[active].zoom + delta) },
    }));
  }

  async function save() {
    if (!chosen.left || !chosen.top || !chosen.bottom) {
      return;
    }

    setSaving(true);
    setError(null);

    const token = startSellWrite(id);

    try {
      const saved = await saveSellCollage(id, {
        left_id: chosen.left.id,
        top_id: chosen.top.id,
        bottom_id: chosen.bottom.id,
        left_zoom: slots.left.zoom,
        top_zoom: slots.top.zoom,
        bottom_zoom: slots.bottom.zoom,
        background,
        ...(existing ? { collage_id: existing.id } : {}),
      });
      await rememberSellItem(client, saved.data, token);
      router.back();
    } catch (caught) {
      setError(errorMessage(caught));
      setSaving(false);
    }
  }

  return (
    <CockpitPage>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: space.md, paddingBottom: 48 }}>
    <Pressable accessible={false} onPress={clearSelection} style={{ flexGrow: 1, gap: space.lg }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Icon name="arrowLeft" size={16} color={sell.ink} />
        <Text style={{ color: sell.ink }}>Pictures</Text>
      </Pressable>
      <T variant="heading">{existing ? 'Edit collage' : 'Add collage'}</T>
      <T variant="body" color={color.ink2}>Tap a photo, then zoom it so it sits in the frame. Tap it again to see the collage.</T>
      <View onTouchStart={keepSelection} style={{ width: '100%', aspectRatio: 4 / 5, flexDirection: 'row', borderRadius: 20, overflow: 'hidden' }}>
        <View style={{ flex: 2 }}>
          <CollageSlot photo={chosen.left} zoom={slots.left.zoom} background={background} active={active === 'left'} onPress={() => pressSlot('left')} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <CollageSlot photo={chosen.top} zoom={slots.top.zoom} background={background} active={active === 'top'} onPress={() => pressSlot('top')} />
          </View>
          <View style={{ flex: 1 }}>
            <CollageSlot photo={chosen.bottom} zoom={slots.bottom.zoom} background={background} active={active === 'bottom'} onPress={() => pressSlot('bottom')} />
          </View>
        </View>
      </View>
      <View style={{ gap: space.sm }}>
        <T variant="eyebrow">Background</T>
        <BackgroundSwatches value={background} onChange={(hex) => { setBackground(hex); setActive(null); setPicking(null); }} />
      </View>
      {activePhoto && activeSlot ? (
        <View onTouchStart={keepSelection} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" disabled={activeSlot.zoom <= MIN_ZOOM} onPress={() => zoomBy(-0.1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sell.soft, alignItems: 'center', justifyContent: 'center', opacity: activeSlot.zoom <= MIN_ZOOM ? 0.4 : 1 }}>
            <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 22, color: sell.ink }}>−</Text>
          </Pressable>
          <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: color.ink }}>{Math.round(activeSlot.zoom * 100)}%</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" disabled={activeSlot.zoom >= MAX_ZOOM} onPress={() => zoomBy(0.1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: sell.soft, alignItems: 'center', justifyContent: 'center', opacity: activeSlot.zoom >= MAX_ZOOM ? 0.4 : 1 }}>
            <Icon name="plus" size={18} color={sell.ink} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setPicking(active)} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
            <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: sell.ink }}>Change photo</Text>
          </Pressable>
        </View>
      ) : null}
      {picking ? (
        <View onTouchStart={keepSelection} style={{ gap: space.sm }}>
          <T variant="eyebrow">Choose a photo</T>
          {sources.length === 0 ? <T variant="body" color={color.ink2}>Take a few photos first.</T> : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sources.map((photo) => (
                <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel="Use this photo" onPress={() => fill(photo)}>
                  <Image source={{ uri: mediaUrl(photo.url) }} style={{ width: 72, height: 72, borderRadius: 10 }} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
      {error ? <InlineError message={error} /> : null}
      <Button label="Save collage" size="lg" busy={saving} disabled={!ready} onPress={() => void save()} />
    </Pressable>
    </ScrollView>
    </CockpitPage>
  );
}

function inkOn(hex: string): string {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;

  return brightness > 150 ? '#1A1A1A' : '#FFFFFF';
}

function CollageSlot({ photo, zoom, background, active, onPress }: { photo: SellPhoto | null; zoom: number; background: string; active: boolean; onPress: () => void }) {
  const { typeColor } = useTheme();
  const sell = typeColor.sell;
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!photo) {
      return;
    }

    let cancelled = false;
    Image.getSize(mediaUrl(photo.url), (width, height) => {
      if (!cancelled && width > 0 && height > 0) {
        setNatural({ width, height });
      }
    }, () => undefined);

    return () => {
      cancelled = true;
    };
  }, [photo?.url]);

  const cover = natural.width > 0 && box.width > 0
    ? Math.max(box.width / natural.width, box.height / natural.height)
    : 0;
  const drawWidth = natural.width * cover * zoom;
  const drawHeight = natural.height * cover * zoom;
  const framed = drawWidth > 0 && drawHeight > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={photo ? (active ? 'Show the collage' : 'Frame this photo') : 'Add a photo'}
      onPress={onPress}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;

        if (width !== box.width || height !== box.height) {
          setBox({ width, height });
        }
      }}
      style={{ flex: 1, backgroundColor: background, borderWidth: active ? 2 : 0, borderColor: sell.ink }}
    >
      <View pointerEvents="none" style={{ flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      {photo ? (
        <Image
          source={{ uri: mediaUrl(photo.url) }}
          onLoad={(event) => {
            const width = event.nativeEvent.source.width;
            const height = event.nativeEvent.source.height;

            if (width > 0 && height > 0) {
              setNatural({ width, height });
            }
          }}
          resizeMode="cover"
          style={framed
            ? { position: 'absolute', width: drawWidth, height: drawHeight, left: (box.width - drawWidth) / 2, top: (box.height - drawHeight) / 2 }
            : { width: '100%', height: '100%' }}
        />
      ) : (
        <Icon name="plus" size={28} color={inkOn(background)} />
      )}
      </View>
    </Pressable>
  );
}
