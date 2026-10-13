import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Image, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, InlineError, T } from '@/components/ui';
import { space } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { useTheme } from '@/state/theme';

type Box = { x: number; y: number; width: number; height: number };
type Corner = 'tl' | 'tr' | 'bl' | 'br';
type Drag = 'move' | Corner;

const EMPTY: Box = { x: 0, y: 0, width: 0, height: 0 };

function smallest(frame: Box): number {
  return Math.max(24, Math.min(72, frame.width, frame.height));
}

function moved(start: Box, dx: number, dy: number, frame: Box): Box {
  const x = Math.min(Math.max(start.x + dx, frame.x), frame.x + frame.width - start.width);
  const y = Math.min(Math.max(start.y + dy, frame.y), frame.y + frame.height - start.height);

  return { ...start, x, y };
}

function resized(start: Box, dx: number, dy: number, corner: Corner, frame: Box): Box {
  const min = smallest(frame);
  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;

  if (corner === 'tl' || corner === 'bl') {
    const nextX = Math.min(Math.max(frame.x, start.x + dx), start.x + start.width - min);
    width = start.width - (nextX - start.x);
    x = nextX;
  } else {
    width = Math.min(Math.max(min, start.width + dx), frame.x + frame.width - start.x);
  }

  if (corner === 'tl' || corner === 'tr') {
    const nextY = Math.min(Math.max(frame.y, start.y + dy), start.y + start.height - min);
    height = start.height - (nextY - start.y);
    y = nextY;
  } else {
    height = Math.min(Math.max(min, start.height + dy), frame.y + frame.height - start.y);
  }

  return { x, y, width, height };
}

function useDrag(kind: Drag, cropRef: RefObject<Box | null>, frameRef: RefObject<Box>, setCrop: (next: Box) => void) {
  const start = useRef<Box | null>(null);

  return useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onStart(() => {
          start.current = cropRef.current;
        })
        .onUpdate((event) => {
          const origin = start.current;
          const bounds = frameRef.current;

          if (!origin || bounds.width === 0) {
            return;
          }

          const next = kind === 'move'
            ? moved(origin, event.translationX, event.translationY, bounds)
            : resized(origin, event.translationX, event.translationY, kind, bounds);
          setCrop(next);
        }),
    [kind, cropRef, frameRef, setCrop],
  );
}

export function PhotoCrop({
  uri,
  background,
  transparent,
  onClose,
  onDone,
}: {
  uri: string;
  background: string;
  transparent: boolean;
  onClose: () => void;
  onDone: (uri: string) => void;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [frame, setFrame] = useState(EMPTY);
  const [crop, setCrop] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cropRef = useRef<Box | null>(null);
  const frameRef = useRef(EMPTY);
  const move = useDrag('move', cropRef, frameRef, setCrop);
  const topLeft = useDrag('tl', cropRef, frameRef, setCrop);
  const topRight = useDrag('tr', cropRef, frameRef, setCrop);
  const bottomLeft = useDrag('bl', cropRef, frameRef, setCrop);
  const bottomRight = useDrag('br', cropRef, frameRef, setCrop);
  cropRef.current = crop;
  frameRef.current = frame;

  useEffect(() => {
    let cancelled = false;

    Image.getSize(uri, (width, height) => {
      if (!cancelled && width > 0 && height > 0) {
        setNatural({ width, height });
      }
    }, () => {
      if (!cancelled) {
        setError('Could not read that photo.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  useEffect(() => {
    if (stage.width === 0 || natural.width === 0) {
      return;
    }

    const scale = Math.min(stage.width / natural.width, stage.height / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    setFrame({
      x: (stage.width - width) / 2,
      y: (stage.height - height) / 2,
      width,
      height,
    });
  }, [stage, natural]);

  useEffect(() => {
    if (crop || frame.width === 0) {
      return;
    }

    const insetX = frame.width * 0.12;
    const insetY = frame.height * 0.12;
    setCrop({
      x: frame.x + insetX,
      y: frame.y + insetY,
      width: frame.width - insetX * 2,
      height: frame.height - insetY * 2,
    });
  }, [crop, frame]);

  async function apply() {
    if (!crop || frame.width === 0 || natural.width === 0 || busy) {
      return;
    }

    const scale = natural.width / frame.width;
    const originX = Math.max(0, Math.min(natural.width - 1, Math.round((crop.x - frame.x) * scale)));
    const originY = Math.max(0, Math.min(natural.height - 1, Math.round((crop.y - frame.y) * scale)));
    const width = Math.max(1, Math.min(natural.width - originX, Math.round(crop.width * scale)));
    const height = Math.max(1, Math.min(natural.height - originY, Math.round(crop.height * scale)));

    setBusy(true);
    setError(null);

    try {
      const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
      const context = ImageManipulator.manipulate(uri);
      context.crop({ originX, originY, width, height });

      try {
        const image = await context.renderAsync();

        try {
          const saved = await image.saveAsync({
            compress: transparent ? 1 : 0.9,
            format: transparent ? SaveFormat.PNG : SaveFormat.JPEG,
          });
          onDone(saved.uri);
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  const shades = crop
    ? [
        { left: 0, top: 0, width: stage.width, height: crop.y },
        { left: 0, top: crop.y + crop.height, width: stage.width, height: Math.max(0, stage.height - crop.y - crop.height) },
        { left: 0, top: crop.y, width: crop.x, height: crop.height },
        { left: crop.x + crop.width, top: crop.y, width: Math.max(0, stage.width - crop.x - crop.width), height: crop.height },
      ]
    : [];

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.paper }}>
      <View style={{ flex: 1, padding: space.lg, gap: space.md, paddingBottom: Math.max(insets.bottom, space.lg) }}>
        <T variant="heading">Crop</T>
        <T variant="body" color={color.ink2}>Drag the frame. Drag a corner to resize.</T>
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;

            if (width !== stage.width || height !== stage.height) {
              setStage({ width, height });
            }
          }}
          style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: transparent ? background : '#1A1A1A' }}
        >
          {frame.width > 0 ? (
            <Image source={{ uri }} style={{ position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height }} />
          ) : null}
          {shades.map((shade, index) => (
            <View key={index} pointerEvents="none" style={{ position: 'absolute', ...shade, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          ))}
          {crop ? (
            <>
              <GestureDetector gesture={move}>
                <View style={{ position: 'absolute', left: crop.x, top: crop.y, width: crop.width, height: crop.height, borderWidth: 1.5, borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.01)' }} />
              </GestureDetector>
              <CropHandle gesture={topLeft} left={crop.x - 22} top={crop.y - 22} />
              <CropHandle gesture={topRight} left={crop.x + crop.width - 22} top={crop.y - 22} />
              <CropHandle gesture={bottomLeft} left={crop.x - 22} top={crop.y + crop.height - 22} />
              <CropHandle gesture={bottomRight} left={crop.x + crop.width - 22} top={crop.y + crop.height - 22} />
            </>
          ) : null}
        </View>
        {error ? <InlineError message={error} /> : null}
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Cancel" tone="secondary" disabled={busy} onPress={onClose} />
          <View style={{ flex: 1 }}>
            <Button label="Crop" size="lg" full busy={busy} disabled={!crop} onPress={() => void apply()} />
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

function CropHandle({ gesture, left, top }: { gesture: ReturnType<typeof Gesture.Pan>; left: number; top: number }) {
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: 'absolute', left, top, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' }} />
      </View>
    </GestureDetector>
  );
}
