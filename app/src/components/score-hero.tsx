import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';

import { useCockpit, useCockpitBody, useCockpitPublish } from '@/components/cockpit-context';
import { GlassSurface, liquidGlass } from '@/components/glass';
import { HeroWash } from '@/components/hero-wash';
import { useHeroWashHost } from '@/components/hero-wash-host';
import { Icon, type IconName } from '@/components/icon';
import { MenuSheet } from '@/components/menu-sheet';
import { useLayout } from '@/design/layout';
import type { Accent, Scheme } from '@/design/palette';
import { font, space, weight } from '@/design/tokens';
import { outsideActionsVisible, sheetCover } from '@/lib/cockpit-scene';
import { useReduceMotion } from '@/lib/motion';
import { navigation } from '@/lib/navigation';
import { useTheme } from '@/state/theme';

export const homePaint: Accent = {
  from: '#0F6B45',
  to: '#063526',
  mid: '#3DDC97',
  on: '#F4FFF8',
};

type Point = { period: string; amount_minor: number };

/** Reserved band at the bottom of a wide hero, where the labeled action buttons sit. */
const ACTION_SLOT = 120;
const CIRCLE = 54;
/** How far the page sheet climbs over the phone hero. Kept inside the action slot's bottom padding. */
const SHEET_OVERLAP = 16;

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

export type ScoreAction = { label: string; onPress: () => void; icon?: IconName };

type ScoreProps = {
  wash: 'home' | 'sell' | 'earn' | 'build' | 'recover' | 'save';
  paint: Accent;
  kicker: string;
  amount: string;
  caption: string;
  metrics?: Array<{ label: string; value: string }>;
  series?: Point[] | null;
  actions?: ScoreAction[];
  note?: string | null;
  /** Drawn behind the one cockpit sheet. Page copies of ScoreHero only publish. */
  backdrop?: boolean;
  detent?: number;
};

function ScoreReadout({
  kicker,
  amount,
  caption,
  metrics,
  note,
  centered = false,
}: {
  kicker: string;
  amount: string;
  caption: string;
  metrics: Array<{ label: string; value: string }>;
  note?: string | null;
  centered?: boolean;
}) {
  const align = centered ? styles.centerText : null;
  const lines = (
    <>
      {kicker ? <Text numberOfLines={1} style={[styles.kicker, centered && styles.aboveAmount]}>{kicker}</Text> : null}
      {amount ? <Text numberOfLines={1} style={[styles.amount, align]}>{amount}</Text> : null}
      {centered ? (
        <View style={styles.belowAmount}>
          {caption ? <Text style={[styles.caption, align]}>{caption}</Text> : null}
          {metrics.length > 0 ? <MetricRow metrics={metrics} centered /> : null}
          {note ? <Text style={[styles.note, align]}>{note}</Text> : null}
        </View>
      ) : (
        <>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          {metrics.length > 0 ? <MetricRow metrics={metrics} /> : null}
          {note ? <Text style={styles.note}>{note}</Text> : null}
        </>
      )}
    </>
  );

  if (!centered) {
    return <View style={{ gap: 6 }}>{lines}</View>;
  }

  return <View style={styles.amountAnchor}>{lines}</View>;
}

function MetricRow({ metrics, centered = false }: { metrics: Array<{ label: string; value: string }>; centered?: boolean }) {
  const align = centered ? styles.centerText : null;

  return (
    <View style={styles.metrics}>
      {metrics.map((metric) => (
        <View key={metric.label} style={centered ? styles.metricCentered : { gap: 2 }}>
          <Text style={[styles.metricValue, align]}>{metric.value}</Text>
          <Text style={[styles.metricLabel, align]}>{metric.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function ScoreHero(props: ScoreProps) {
  const cockpit = useCockpit();
  useCockpitPublish(props);

  if (cockpit) {
    return null;
  }

  return <ScoreHeroView {...props} />;
}

export function ScoreHeroView({
  wash,
  paint,
  kicker,
  amount,
  caption,
  metrics = [],
  series,
  actions = [],
  note,
  backdrop = false,
  detent = 0,
}: ScoreProps) {
  const phone = useLayout().phone;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const host = useHeroWashHost();
  const nativeSheet = phone && Platform.OS === 'ios';
  const heroRef = useRef<View>(null);
  const showOutside = !backdrop || outsideActionsVisible(detent);
  // The amount stays on the resting sheet, so dragging the sheet does not move it.
  const restingTop = height - sheetCover(height, insets.top, 0);
  const bandTop = insets.top;
  const bandHeight = Math.max(0, restingTop - bandTop);

  useEffect(() => {
    host?.reportPaint(paint, wash);
  }, [host, paint, wash]);

  function placeWash() {
    const relative = host?.contentRef.current;
    const node = heroRef.current;

    if (!host || !relative || !node) {
      return;
    }

    node.measureLayout(
      relative,
      (x, y, width, height) => host.reportBox({ x, y, width, height }),
      () => {},
    );
  }

  return (
    <View ref={heroRef} onLayout={placeWash} pointerEvents="box-none" style={[styles.hero, host && { zIndex: 1 }, phone && { borderRadius: 0, minHeight: 400 + insets.top }, (nativeSheet || backdrop) && { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, minHeight: undefined }]}>
      {host ? null : <HeroWash paint={paint} wash={wash} />}
      {phone && showOutside ? (
        <View style={{ position: 'absolute', top: insets.top + 8, right: 12, zIndex: 5, flexDirection: 'row', gap: 8 }}>
          <Pressable accessibilityRole="link" accessibilityLabel="Progress" onPress={() => navigation.openSecondary('/progress')} style={styles.heroIcon}>
            <Icon name="chart" size={18} color="#F7F4EE" />
          </Pressable>
          <Pressable accessibilityRole="link" accessibilityLabel="Profile" onPress={() => navigation.openSecondary('/settings')} style={styles.heroIcon}>
            <Icon name="user" size={18} color="#F7F4EE" />
          </Pressable>
        </View>
      ) : null}
      <Momentum series={series} />
      {backdrop ? (
        <View pointerEvents="none" style={[styles.scoreBand, { top: bandTop, height: bandHeight }]}>
          <ScoreReadout centered kicker={kicker} amount={amount} caption={caption} metrics={metrics} note={note} />
        </View>
      ) : (
        <View style={[styles.copy, phone && { paddingTop: insets.top + 56, paddingHorizontal: 20 }]}>
          <ScoreReadout kicker={kicker} amount={amount} caption={caption} metrics={metrics} note={note} />
        </View>
      )}
      {phone ? null : (
        <View style={styles.actionSlot} pointerEvents={actions.length > 0 ? 'box-none' : 'none'}>
          <View style={styles.actionGrid}>
            {actions.slice(0, 4).map((action) => (
              <GlassButton key={action.label} label={action.label} icon={action.icon} onPress={action.onPress} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export function GlassButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => [
        styles.cell,
        (state as { hovered?: boolean }).hovered && !liquidGlass && { opacity: 0.82 },
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null,
      ]}
    >
      <GlassSurface tone="hero" style={styles.circle}>
        {icon ? <Icon name={icon} size={22} color="#F7F4EE" /> : null}
      </GlassSurface>
      <Text numberOfLines={2} style={styles.circleLabel}>{label}</Text>
    </Pressable>
  );
}

function Momentum({ series }: { series?: Point[] | null }) {
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
    <View style={[styles.graph, { pointerEvents: 'none' }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <Polyline points={line} fill="none" stroke="rgba(255,255,255,0.78)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, overflow: 'hidden', minHeight: 280 },
  heroIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  copy: { padding: space.lg, paddingBottom: ACTION_SLOT, gap: 6 },
  scoreBand: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  amountAnchor: { width: '100%', alignItems: 'center' },
  aboveAmount: { position: 'absolute', left: 0, right: 0, bottom: '100%', marginBottom: 6, textAlign: 'center' },
  belowAmount: { position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 6, alignItems: 'center', gap: 6 },
  centerText: { textAlign: 'center' },
  metricCentered: { gap: 2, alignItems: 'center' },
  kicker: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.78)' },
  amount: { fontFamily: font.display, fontWeight: weight.bold, fontSize: 56, lineHeight: 60, letterSpacing: -1.1, color: '#F7F4EE' },
  caption: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 15, lineHeight: 20, color: 'rgba(255,255,255,0.82)' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.sm },
  metricValue: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 18, lineHeight: 22, color: '#F7F4EE' },
  metricLabel: { fontFamily: font.medium, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.72)' },
  note: { fontFamily: font.medium, fontSize: 13, lineHeight: 18, color: 'rgba(255,255,255,0.72)', marginTop: 4 },
  actionSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ACTION_SLOT,
    paddingHorizontal: 8,
    paddingBottom: 14,
    justifyContent: 'flex-end',
  },
  actionGrid: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { width: '25%', alignItems: 'center', gap: 6 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  circleLabel: { width: '100%', fontFamily: font.medium, fontWeight: weight.medium, fontSize: 11, lineHeight: 13, color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  sheetIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  graph: { position: 'absolute', left: 20, right: 20, bottom: 52, height: 32 },
});

/** Large page title. Phone page actions sit on the trailing edge, primary last. */
function SheetHeading({ title, actions = [] }: { title: string; actions?: ScoreAction[] }) {
  const { color, scheme } = useTheme();
  const sheetActions = actions.filter((action): action is ScoreAction & { icon: IconName } => action.icon != null).slice(0, 4).reverse();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
      <Text
        numberOfLines={1}
        accessibilityRole="header"
        style={{
          flex: 1,
          fontSize: 34,
          lineHeight: 41,
          fontWeight: weight.bold,
          letterSpacing: 0.37,
          color: color.ink,
          fontFamily: Platform.OS === 'ios' ? undefined : font.body,
        }}
      >
        {title}
      </Text>
      {sheetActions.map((action) => (
        <SheetIconButton key={action.label} label={action.label} icon={action.icon} ink={color.ink} scheme={scheme} onPress={action.onPress} />
      ))}
    </View>
  );
}

function SheetIconButton({
  label,
  icon,
  ink,
  scheme,
  onPress,
}: {
  label: string;
  icon: IconName;
  ink: string;
  scheme: Scheme;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}>
      <GlassSurface tone="bar" scheme={scheme} interactive style={styles.sheetIcon}>
        <Icon name={icon} size={20} color={ink} />
      </GlassSurface>
    </Pressable>
  );
}

/** Phone cockpit pages: the score runs to the screen edge, and the page comes up over it. */
export function MobileStage({ title, hero, actions = [], children }: { title: string; hero: ReactNode; actions?: ScoreAction[]; children: ReactNode }) {
  const phone = useLayout().phone;
  const cockpit = useCockpit();
  const { color, scheme } = useTheme();
  const heading = <SheetHeading title={title} actions={actions} />;
  const sheetBody = (
    <ScrollView
      style={{ flex: 1 }}
      alwaysBounceVertical
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 96, gap: space.xl }}
    >
      {heading}
      {children}
    </ScrollView>
  );
  useCockpitBody(cockpit ? sheetBody : null);

  const sheet = (
    <View
      style={{
        marginTop: -SHEET_OVERLAP,
        backgroundColor: color.paper,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 20,
        paddingTop: 20,
        gap: space.xl,
        boxShadow: scheme === 'dark' ? '0 -16px 36px rgba(0,0,0,0.28)' : '0 -12px 28px rgba(16,16,16,0.06)',
      }}
    >
      {heading}
      {children}
    </View>
  );

  if (!phone) {
    return (
      <View style={{ gap: space.xxl }}>
        {hero}
        {children}
      </View>
    );
  }

  // iOS phone: the list is drawn in the one shared sheet. The hero stays behind it.
  if (Platform.OS === 'ios' && cockpit) {
    return hero;
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={{ flex: 1 }}>
        {hero}
        <MenuSheet onDetent={() => {}}>
          <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: space.xl }}>
            {heading}
            {children}
          </View>
        </MenuSheet>
      </View>
    );
  }

  return (
    <View>
      {hero}
      {sheet}
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
