import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

import { HeroWash } from '@/components/hero-wash';
import { Icon, type IconName } from '@/components/icon';
import { useLayout } from '@/design/layout';
import type { Accent } from '@/design/palette';
import { font, space, weight } from '@/design/tokens';
import { useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/state/theme';

export const homePaint: Accent = {
  from: '#0F6B45',
  to: '#063526',
  mid: '#3DDC97',
  on: '#F4FFF8',
};

type Point = { period: string; amount_minor: number };

export function cumulativeThroughToday(series: Point[] | null | undefined): number[] {
  if (!series || series.length === 0) {
    return [0, 0];
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let sum = 0;
  const points: number[] = [];

  for (const row of series) {
    if (row.period > todayKey) {
      break;
    }

    sum += row.amount_minor;
    points.push(sum);
  }

  if (points.length === 0) {
    return [0, 0];
  }

  if (points.length === 1) {
    return [points[0], points[0]];
  }

  return points;
}

export function ScoreHero({
  wash,
  paint,
  kicker,
  amount,
  caption,
  metrics = [],
  series,
  actions = [],
  note,
}: {
  wash: 'home' | 'sell' | 'earn' | 'build' | 'recover' | 'save';
  paint: Accent;
  kicker: string;
  amount: string;
  caption: string;
  metrics?: Array<{ label: string; value: string }>;
  series?: Point[] | null;
  actions?: Array<{ label: string; onPress: () => void; icon?: IconName }>;
  note?: string | null;
}) {
  const phone = useLayout().phone;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.hero, phone && { borderRadius: 0, minHeight: 340 + insets.top }]}>
      <HeroWash paint={paint} wash={wash} />
      <Momentum series={series} lift={phone} />
      <View style={[styles.copy, phone && { paddingTop: insets.top + 56, paddingHorizontal: 20, paddingBottom: actions.length > 0 ? 112 : 78 }]}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.amount}>{amount}</Text>
        <Text style={styles.caption}>{caption}</Text>
        {metrics.length > 0 ? (
          <View style={styles.metrics}>
            {metrics.map((metric) => (
              <View key={metric.label} style={{ gap: 2 }}>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricLabel}>{metric.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((action) => (
              <GlassButton key={action.label} label={action.label} icon={action.icon} onPress={action.onPress} grow={phone} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function GlassButton({ label, onPress, icon, grow = false }: { label: string; onPress: () => void; icon?: IconName; grow?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        styles.glass,
        grow && styles.glassGrow,
        (state as { hovered?: boolean }).hovered && { backgroundColor: 'rgba(255,255,255,0.26)' },
        Platform.OS === 'web' ? ({ cursor: 'pointer', backdropFilter: 'blur(16px)' } as object) : null,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color="#F7F4EE" /> : null}
      <Text numberOfLines={1} style={styles.glassText}>{label}</Text>
    </Pressable>
  );
}

function Momentum({ series, lift = false }: { series?: Point[] | null; lift?: boolean }) {
  const reduce = useReduceMotion();
  const points = useMemo(() => cumulativeThroughToday(series), [series]);
  const [drawn, setDrawn] = useState(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      setDrawn(1);

      return;
    }

    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setDrawn(1 - (1 - t) ** 3);

      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [reduce, points]);

  const max = Math.max(...points, 0);

  if (max === 0) {
    return null;
  }

  const width = 100;
  const height = 36;
  const coords = points.map((value, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = max === 0 ? height - 4 : height - 4 - (value / max) * (height - 8);

    return `${x},${y}`;
  });
  const visible = Math.max(2, Math.round(coords.length * drawn));
  const line = coords.slice(0, visible).join(' ');

  return (
    <View style={[styles.graph, lift && { bottom: 46, height: 36, left: 20, right: 20 }, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Polyline points={line} fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, overflow: 'hidden', minHeight: 248, justifyContent: 'flex-end' },
  copy: { padding: space.lg, gap: 6, paddingBottom: 78 },
  kicker: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.78)' },
  amount: { fontFamily: font.display, fontWeight: weight.bold, fontSize: 56, lineHeight: 60, letterSpacing: -1.1, color: '#F7F4EE' },
  caption: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 15, color: 'rgba(255,255,255,0.82)' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.sm },
  metricValue: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 18, color: '#F7F4EE' },
  metricLabel: { fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.72)' },
  note: { fontFamily: font.medium, fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.sm },
  glass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  glassGrow: { flexGrow: 1, justifyContent: 'center' },
  glassText: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 14, color: '#F7F4EE' },
  graph: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 72 },
});

/** Phone cockpit pages: the score runs to the screen edge, and the page comes up over it. */
export function MobileStage({ hero, children }: { hero: ReactNode; children: ReactNode }) {
  const phone = useLayout().phone;
  const { color, scheme } = useTheme();

  if (!phone) {
    return (
      <View style={{ gap: space.xxl }}>
        {hero}
        {children}
      </View>
    );
  }

  return (
    <View>
      {hero}
      <View
        style={{
          marginTop: -36,
          backgroundColor: color.paper,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: space.md,
          paddingTop: space.lg,
          gap: space.xl,
          boxShadow: scheme === 'dark' ? '0 -16px 36px rgba(0,0,0,0.28)' : '0 -12px 28px rgba(16,16,16,0.06)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function ObjectFallback({ label, paint, children }: { label: string; paint: Accent; children?: ReactNode }) {
  const letter = label.trim().charAt(0).toUpperCase() || '•';

  return (
    <View style={{ height: 112, backgroundColor: paint.from, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.display, fontWeight: weight.bold, fontSize: 36, color: paint.on }}>{letter}</Text>
      {children}
    </View>
  );
}
