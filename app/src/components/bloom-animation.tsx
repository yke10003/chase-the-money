import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, Platform, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import type { Scheme } from '@/design/palette';

/**
 * Sampled from the rendered frames (sRGB, no color profile).
 * Keep these in sync with the expo-splash-screen colors in app.json.
 * The brief's #0B1D3A / #F3EFE6 are a couple of steps off these pixels.
 */
export const BLOOM_BACKGROUND = {
  dark: '#0F1D38',
  light: '#F2EFE7',
} as const;

/**
 * Width of the native splash image, in dp.
 * Keep these in sync with expo-splash-screen imageWidth in app.json.
 *
 * iOS draws this square, centered, on the background color.
 * Android 12+ masks the splash icon to a 192dp circle inside a 288dp slot.
 * 240dp keeps the petals inside that circle. A larger Android image gets clipped.
 */
export const BLOOM_NATIVE_SIDE = {
  ios: 360,
  android: 240,
} as const;

const BLOOM_ASSETS = {
  dark: {
    poster: require('../../assets/branding/bloom-dark.png'),
    video: require('../../assets/branding/bloom-dark.mp4'),
  },
  light: {
    poster: require('../../assets/branding/bloom-light.png'),
    video: require('../../assets/branding/bloom-light.mp4'),
  },
} as const;

export type BloomPhase = 'poster' | 'video' | 'still' | 'error';

type Motion = 'unknown' | 'reduce' | 'allow';

type BloomAnimationProps = {
  scheme: Scheme;
  /** When false, the bundled video stays paused. Defaults to true. */
  playing?: boolean;
  /** When false, stay on the poster until `playing` is set. Defaults to true. */
  autoplay?: boolean;
  loop?: boolean;
  /** Paint the opening frame over the video. Useful for checking alignment. */
  holdPoster?: boolean;
  /** The poster is on screen. Safe to hide the native splash. */
  onReady?: () => void;
  onPhaseChange?: (phase: BloomPhase) => void;
  style?: StyleProp<ViewStyle>;
};

export function useBloomSide(): number {
  const { width } = useWindowDimensions();
  const native = Platform.OS === 'android' ? BLOOM_NATIVE_SIDE.android : BLOOM_NATIVE_SIDE.ios;

  if (width <= 0) {
    return native;
  }

  return Math.min(native, width);
}

function useMotionPreference(): Motion {
  const [motion, setMotion] = useState<Motion>('unknown');

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setMotion(enabled ? 'reduce' : 'allow');
        }
      })
      .catch((error) => {
        if (__DEV__) {
          console.warn('[bloom] could not read reduced motion', error);
        }
        if (active) {
          setMotion('allow');
        }
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setMotion(enabled ? 'reduce' : 'allow');
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return motion;
}

export function BloomAnimation({ style, scheme, loop = true, ...rest }: BloomAnimationProps) {
  const motion = useMotionPreference();

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.frame, { backgroundColor: BLOOM_BACKGROUND[scheme] }, style]}>
      <BloomStage key={`${scheme}:${loop}`} motion={motion} scheme={scheme} loop={loop} {...rest} />
    </View>
  );
}

function BloomStage({ scheme, playing, autoplay = true, loop = true, holdPoster = false, onReady, onPhaseChange, motion }: BloomAnimationProps & { motion: Motion }) {
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const assets = BLOOM_ASSETS[scheme];
  const playback = playing ?? autoplay;
  const source = motion === 'reduce' || failed ? null : assets.video;
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = loop;
    instance.muted = true;
    instance.volume = 0;
    instance.audioMixingMode = 'mixWithOthers';
    instance.showNowPlayingNotification = false;
  });
  const shouldPlay = motion !== 'reduce' && !failed && active && playback;
  const showPoster = holdPoster || failed || !revealed || motion !== 'allow';
  const phase: BloomPhase = failed ? 'error' : motion === 'reduce' ? 'still' : revealed && !holdPoster ? 'video' : 'poster';
  const signaled = useRef(false);

  useEffect(() => {
    onPhaseChange?.(phase);
  }, [onPhaseChange, phase]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      setActive(next === 'active');
    });

    return () => subscription.remove();
  }, []);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status !== 'error' || motion !== 'allow') {
      return;
    }

    if (__DEV__) {
      console.warn('[bloom] video failed', error);
    }
    setFailed(true);
  });

  useEffect(() => {
    if (!shouldPlay) {
      player.pause();
      return;
    }

    player.play();
  }, [player, shouldPlay]);

  function signalReady() {
    if (signaled.current) {
      return;
    }

    signaled.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        onReady?.();
      });
    });
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {source != null ? (
        <VideoView
          player={player}
          style={[StyleSheet.absoluteFill, styles.media]}
          contentFit="contain"
          nativeControls={false}
          playsInline
          allowsPictureInPicture={false}
          allowsVideoFrameAnalysis={false}
          fullscreenOptions={{ enable: false }}
          surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
          onFirstFrameRender={() => setRevealed(true)}
        />
      ) : null}
      {showPoster ? (
        <Image
          source={assets.poster}
          fadeDuration={0}
          resizeMode="contain"
          style={[StyleSheet.absoluteFill, styles.media]}
          accessible={false}
          onLoad={signalReady}
          onError={(event) => {
            if (__DEV__) {
              console.warn('[bloom] poster failed', event.nativeEvent.error);
            }
            signalReady();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
  },
  // Width and height keep the web video from using its 1024px intrinsic size.
  media: {
    width: '100%',
    height: '100%',
  },
});
