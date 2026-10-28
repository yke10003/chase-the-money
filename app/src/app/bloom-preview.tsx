import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BLOOM_BACKGROUND, BloomAnimation, useBloomSide, type BloomPhase } from '@/components/bloom-animation';
import { useLaunchScheme } from '@/components/bloom-splash';
import type { Scheme } from '@/design/palette';

const PHASE_LABEL: Record<BloomPhase, string> = {
  poster: 'Poster',
  video: 'Video',
  still: 'Reduced motion',
  error: 'Video failed',
};

export default function BloomPreviewScreen() {
  const router = useRouter();

  useEffect(() => {
    if (!__DEV__) {
      router.replace('/');
    }
  }, [router]);

  if (!__DEV__) {
    return null;
  }

  return <BloomPreview />;
}

export function BloomPreview() {
  const router = useRouter();
  const launch = useLaunchScheme();
  const [override, setOverride] = useState<Scheme | null>(null);
  const scheme = override ?? launch;
  const [replay, setReplay] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [holdPoster, setHoldPoster] = useState(false);
  const [phase, setPhase] = useState<BloomPhase>('poster');
  const side = useBloomSide();
  const insets = useSafeAreaInsets();

  if (!scheme) {
    return <View style={[styles.fill, { backgroundColor: BLOOM_BACKGROUND.dark }]} />;
  }

  const background = BLOOM_BACKGROUND[scheme];
  const ink = scheme === 'light' ? '#1C1B19' : '#F4F1EA';
  const chip = scheme === 'light' ? 'rgba(28,27,25,0.08)' : 'rgba(244,241,234,0.16)';
  const chipOn = scheme === 'light' ? 'rgba(28,27,25,0.16)' : 'rgba(244,241,234,0.28)';

  function hideNativeSplash() {
    SplashScreen.hideAsync().catch(() => {});
  }

  function close() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/');
  }

  return (
    <View style={[styles.fill, { backgroundColor: background }]}>
      <StatusBar style={scheme === 'light' ? 'dark' : 'light'} />
      <View style={styles.stage}>
        <BloomAnimation
          key={`${scheme}-${replay}`}
          scheme={scheme}
          playing={playing}
          holdPoster={holdPoster}
          onReady={hideNativeSplash}
          onPhaseChange={setPhase}
          style={{ width: side, height: side }}
        />
      </View>
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={[styles.status, { color: ink }]}>
          {PHASE_LABEL[phase]}
          {holdPoster && phase !== 'still' ? ' · poster held' : ''} · {Math.round(side)}pt
        </Text>
        <View style={styles.row}>
          <Chip label="Dark" selected={scheme === 'dark'} ink={ink} chip={chip} chipOn={chipOn} onPress={() => setOverride('dark')} />
          <Chip label="Light" selected={scheme === 'light'} ink={ink} chip={chip} chipOn={chipOn} onPress={() => setOverride('light')} />
          <Chip label={playing ? 'Pause' : 'Play'} ink={ink} chip={chip} chipOn={chipOn} onPress={() => setPlaying((value) => !value)} />
          <Chip
            label="Replay"
            ink={ink}
            chip={chip}
            chipOn={chipOn}
            onPress={() => {
              setPlaying(true);
              setHoldPoster(false);
              setPhase('poster');
              setReplay((value) => value + 1);
            }}
          />
          <Chip label="Poster" selected={holdPoster} ink={ink} chip={chip} chipOn={chipOn} onPress={() => setHoldPoster((value) => !value)} />
          <Chip label="Close" ink={ink} chip={chip} chipOn={chipOn} onPress={close} />
        </View>
      </View>
    </View>
  );
}

function Chip({ label, selected, ink, chip, chipOn, onPress }: { label: string; selected?: boolean; ink: string; chip: string; chipOn: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={[styles.chip, { backgroundColor: selected ? chipOn : chip }]}>
      <Text style={[styles.chipLabel, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    gap: 10,
  },
  status: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
