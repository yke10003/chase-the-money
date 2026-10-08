import { useEffect, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { Accent, MissionType } from '@/design/palette';
import { useReduceMotion } from '@/lib/motion';

type WashKey = MissionType | 'build' | 'home';

const MOTION: Record<WashKey, { swirl: number; drift: number; speed: number; count: number; seed: number }> = {
  home: { swirl: 0.35, drift: 0.7, speed: 1.4, count: 4, seed: 3 },
  sell: { swirl: 0.45, drift: 0.85, speed: 1.8, count: 4, seed: 2 },
  earn: { swirl: 0.7, drift: 1, speed: 2.2, count: 4, seed: 7 },
  build: { swirl: 0.85, drift: 0.95, speed: 2, count: 4, seed: 11 },
  recover: { swirl: 0.3, drift: 0.75, speed: 1.5, count: 4, seed: 4 },
  save: { swirl: 0.55, drift: 0.85, speed: 1.7, count: 4, seed: 9 },
};

type ShaderModule = typeof import('shaders/react');

export function HeroWash({ paint, wash = 'earn' }: { paint: Accent; wash?: WashKey }) {
  const reduce = useReduceMotion();
  const raw = useId();
  const id = `wash-${raw.replace(/:/g, '')}`;
  const [mod, setMod] = useState<ShaderModule | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const motion = MOTION[wash];

  useEffect(() => {
    if (reduce) {
      return;
    }

    let cancelled = false;

    import('shaders/react')
      .then((loaded) => {
        if (!cancelled) {
          setMod(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnavailable(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reduce]);

  const showShader = mod != null && !unavailable && !reduce;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {showShader ? null : (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={paint.mid} />
              <Stop offset="0.42" stopColor={paint.from} />
              <Stop offset="1" stopColor={paint.to} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${id})`} />
        </Svg>
      )}
      {showShader && mod ? (
        <mod.Shader
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onUnavailable={() => setUnavailable(true)}
        >
          <mod.MeshGradient
            stops={[
              { color: paint.to, position: 0 },
              { color: paint.from, position: 0.48 },
              { color: paint.mid, position: 1 },
            ]}
            count={motion.count}
            smoothness={1.35}
            variation={0.4}
            swirl={motion.swirl}
            drift={motion.drift}
            wrapping={0}
            speed={motion.speed}
            seed={motion.seed}
            colorSpace="oklab"
          />
          <mod.FilmGrain strength={0.18} bias={0.4} animated={false} opacity={0.22} />
        </mod.Shader>
      ) : null}
    </View>
  );
}
