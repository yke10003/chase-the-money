import { Children, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import type { Goal } from '@/api/types';
import { HeroWash } from '@/components/hero-wash';
import { MobileStage } from '@/components/score-hero';
import { Icon, type IconName } from '@/components/icon';
import { GoalMeter, T, XpTag } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Accent, Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { goalDaysLeft, goalPeriodName } from '@/lib/goal';
import { useReduceMotion } from '@/lib/motion';
import { formatAmount } from '@/lib/money';
import { cardShadow, useTheme } from '@/state/theme';

type Interaction = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

export function ProgressRing({
  percent,
  size = 112,
  stroke,
  track,
}: {
  percent: number;
  size?: number;
  stroke?: string;
  track?: string;
}) {
  const { color } = useTheme();
  const reduce = useReduceMotion();
  const ring = stroke ?? color.money;
  const groove = track ?? color.sunken;
  const target = Math.max(0, Math.min(100, percent));
  const [shown, setShown] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setShown(target);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - t) ** 3;
      setShown(target * eased);

      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
  }, [reduce, target]);

  const width = Math.max(8, Math.round(size * 0.09));
  const r = (size - width) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (shown / 100) * circumference;

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(target) }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={groove} strokeWidth={width} fill="none" />
        {shown > 0.8 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={ring}
            strokeWidth={width}
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>
    </View>
  );
}

export function GoalScore({ goal, prominent = false }: { goal: Goal; prominent?: boolean }) {
  const { color, type: typeScale } = useTheme();
  const layout = useLayout();
  const days = goalDaysLeft(goal);
  const figure = prominent ? (layout.phone ? 56 : 72) : 36;

  return (
    <View style={{ gap: prominent ? space.md : space.sm }}>
      <T variant="eyebrow">
        {goalPeriodName(goal)} · {days} {days === 1 ? 'day' : 'days'} left
      </T>
      <View style={{ flexDirection: 'row', alignItems: prominent ? 'center' : 'flex-end', gap: space.md }}>
        {prominent ? <ProgressRing percent={goal.progress_percent} size={layout.phone ? 84 : 108} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[typeScale.hero, { fontSize: figure, lineHeight: figure, letterSpacing: figure > 48 ? -1.2 : -0.6 }]}>
            {formatAmount(goal.realized_amount_minor, goal.currency)}
          </Text>
          <Text style={[typeScale.small, { color: color.ink2 }]}>
            of {formatAmount(goal.amount_minor, goal.currency)} · realized
          </Text>
        </View>
      </View>
      <GoalMeter percent={goal.progress_percent} height={prominent ? 12 : 8} />
    </View>
  );
}

export function MoneyReadout({
  amount,
  label,
  certainty,
}: {
  amount: string;
  label: string;
  certainty: 'banked' | 'expected' | 'possible';
}) {
  const { color, type: typeScale } = useTheme();
  const figureColor = certainty === 'banked' ? color.money : certainty === 'possible' ? color.ink3 : color.ink;

  return (
    <View style={{ gap: 2, minWidth: 120 }}>
      <Text style={[typeScale.figure, { fontSize: 22, lineHeight: 26, color: figureColor, opacity: certainty === 'possible' ? 0.9 : 1 }]}>{amount}</Text>
      <Text style={[typeScale.eyebrow, { color: certainty === 'banked' ? color.moneyInk : color.ink3 }]}>{label}</Text>
    </View>
  );
}

export function AsideCard({ children }: { children: ReactNode }) {
  return <View style={{ gap: space.md }}>{children}</View>;
}

/** A secondary move. Icon, title, and reward as type — not a smaller hero. */
export function ActionRow({
  title,
  detail,
  icon,
  iconColor,
  onPress,
  minutes,
  xp,
  unavailable = false,
}: {
  title: string;
  detail: string;
  icon: IconName;
  iconColor: string;
  onPress: () => void;
  minutes?: string | null;
  xp?: number | null;
  unavailable?: boolean;
}) {
  const { color } = useTheme();
  const meta = [detail, minutes, unavailable ? 'Later' : null].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, detail, xp ? `plus ${xp} XP` : null, unavailable ? 'Not available yet' : null].filter(Boolean).join(', ')}
      onPress={onPress}
      style={(state) => {
        const interaction = state as Interaction;

        return {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          minHeight: 56,
          paddingVertical: 10,
          opacity: unavailable ? 0.7 : 1,
          backgroundColor: interaction.hovered ? color.sunken : 'transparent',
          ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
        };
      }}
    >
      <Icon name={icon} size={18} color={iconColor} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, color: color.ink }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontFamily: font.body, fontSize: 13, lineHeight: 18, color: color.ink2 }}>{meta}</Text>
      </View>
      {xp ? <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 13, color: color.xp }}>+{xp} XP</Text> : null}
    </Pressable>
  );
}

export function ActionQueue({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  const items = Children.toArray(children);

  return (
    <View>
      {items.map((child, index) => (
        <View key={index} style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line }}>
          {child}
        </View>
      ))}
    </View>
  );
}

type TileTone = 'hero' | 'solid' | 'quiet';

export function ActionTile({
  title,
  detail,
  icon,
  paint,
  wash = 'earn',
  onPress,
  minutes,
  xp,
  money,
  moneyLabel,
  badge,
  tone = 'solid',
  span = 'half',
  unavailable = false,
  busy = false,
}: {
  title: string;
  detail: string;
  icon: IconName;
  paint: Accent;
  wash?: 'earn' | 'sell' | 'recover' | 'save' | 'build';
  onPress: () => void;
  minutes?: string | null;
  xp?: number | null;
  money?: string | null;
  moneyLabel?: string | null;
  badge?: string | null;
  tone?: TileTone;
  span?: 'full' | 'half';
  unavailable?: boolean;
  busy?: boolean;
}) {
  const { color, scheme } = useTheme();
  const styles = useMoveStyles();
  const layout = useLayout();
  const filled = tone === 'hero';
  const bar = span === 'full' && !filled && layout.desktop;
  const ink = filled ? paint.on : color.ink;
  const muted = filled ? paint.on : color.ink2;
  const label = [title, detail, minutes, xp ? `plus ${xp} XP` : null, unavailable ? 'Not available yet' : null].filter(Boolean).join(', ');
  const plate = (
    <View style={[styles.iconPlate, bar && styles.iconPlateSm, { backgroundColor: filled ? 'rgba(9,10,12,0.18)' : paint.from }]}>
            <Icon name={icon} size={bar ? 22 : tone === 'hero' ? 26 : 22} color={filled ? paint.on : color.heroInk} weight="regular" />
    </View>
  );
  const copy = (
    <View style={{ gap: 4, flex: bar ? 1 : undefined, minWidth: bar ? 0 : undefined }}>
      {badge ? <Text style={[styles.kicker, { color: muted }]}>{badge}</Text> : null}
      <Text style={[styles.tileTitle, tone === 'hero' && styles.tileTitleHero, bar && styles.tileTitleBar, { color: ink }]}>{title}</Text>
      <Text style={[styles.tileDetail, { color: muted }]}>{detail}</Text>
      {money ? (
        <Text style={[styles.tileMoney, { color: ink }]}>
          {money}
          {moneyLabel ? <Text style={styles.tileMoneyLabel}> {moneyLabel}</Text> : null}
        </Text>
      ) : null}
    </View>
  );
  const meta = (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {minutes ? <Text style={[styles.tileMeta, { color: muted }]}>{minutes}</Text> : null}
      {xp ? <XpTag amount={xp} /> : null}
      {unavailable ? <Text style={[styles.tileMeta, { color: muted, opacity: 0.8 }]}>Later</Text> : null}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      onPress={onPress}
      style={(state) => {
        const interaction = state as Interaction;

        return [
          styles.tile,
          span === 'full' ? styles.tileFull : styles.tileHalf,
          tone === 'hero' && styles.tileHero,
          !filled && styles.tileQuiet,
          !filled && scheme === 'light' && cardShadow(scheme),
          bar && styles.tileBar,
          interaction.pressed && { transform: [{ scale: 0.985 }] },
          interaction.hovered && filled && { opacity: 0.94 },
          interaction.hovered && !filled && { borderColor: color.lineStrong },
          interaction.focused && styles.tileFocus,
          unavailable && { opacity: 0.78 },
        ];
      }}
    >
      {filled ? <HeroWash paint={paint} wash={wash} /> : null}
      {bar ? (
        <View style={styles.barBody}>
          {plate}
          {copy}
          {meta}
          <Icon name="arrowRight" size={18} color={ink} weight="bold" />
        </View>
      ) : (
        <View style={styles.tileBody}>
          {plate}
          {copy}
          <View style={styles.tileFoot}>
            {meta}
            <Icon name="arrowRight" size={18} color={ink} weight="bold" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function MoveGrid({ children }: { children: ReactNode }) {
  const styles = useMoveStyles();

  return <View style={styles.grid}>{children}</View>;
}

export function CockpitFrame({
  kicker,
  title,
  lede,
  moves,
  aside,
  below,
}: {
  kicker?: string;
  title: string;
  lede?: string;
  moves: ReactNode;
  aside?: ReactNode;
  below?: ReactNode;
}) {
  const { color, type: typeScale } = useTheme();
  const layout = useLayout();
  const split = layout.width >= 1180;

  if (layout.phone) {
    return (
      <MobileStage title={title} hero={moves}>
        {below}
        {aside}
      </MobileStage>
    );
  }

  const head = (
    <View style={{ gap: 4 }}>
      {kicker ? <Text style={[typeScale.eyebrow, { color: color.ink3 }]}>{kicker}</Text> : null}
      <Text style={[typeScale.title, { fontSize: layout.phone ? 28 : 32, lineHeight: layout.phone ? 34 : 38 }]}>{title}</Text>
      {lede ? <T variant="body" color={color.ink2}>{lede}</T> : null}
    </View>
  );

  return (
    <View style={{ gap: space.xxl }}>
      {split ? (
        <View style={{ flexDirection: 'row', gap: space.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: space.lg, minWidth: 0 }}>
            {head}
            {moves}
          </View>
          {aside ? <View style={{ width: 300 }}>{aside}</View> : null}
        </View>
      ) : (
        <View style={{ gap: space.lg }}>
          {head}
          {moves}
        </View>
      )}
      {below}
      {!split && aside ? aside : null}
    </View>
  );
}

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { color, type: typeScale } = useTheme();
  const styles = useMoveStyles();
  const layout = useLayout();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.sheetHost, layout.desktop && styles.sheetHostDesktop]}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, layout.desktop && styles.sheetDesktop, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <View style={styles.sheetGrab} />
          <View style={styles.sheetHead}>
            <Text style={[typeScale.heading, { flex: 1 }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.sheetClose}>
              <Icon name="x" size={18} color={color.ink} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

function useMoveStyles() {
  const { color, scheme } = useTheme();

  return useMemo(() => {
    const focus = scheme === 'dark' ? 'rgba(244,241,234,0.28)' : 'rgba(28,27,25,0.18)';

    return StyleSheet.create({
  aside: { gap: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: color.surface, borderWidth: 1, borderColor: color.line },
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    borderRadius: radius.hero,
    overflow: 'hidden',
    minHeight: 156,
    ...webPointer,
  },
  tileHalf: { width: '48%', maxWidth: '48%', flexGrow: 1, flexBasis: 'auto' },
  tileFull: { width: '100%', flexGrow: 0, flexBasis: 'auto' },
  tileHero: { minHeight: 188 },
  tileQuiet: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.line, minHeight: 172, borderRadius: radius.lg },
  tileBar: { minHeight: 0 },
  tileBody: { flex: 1, padding: 18, gap: 16 },
  barBody: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 14 },
  iconPlate: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconPlateSm: { width: 40, height: 40, borderRadius: 12 },
  kicker: { fontFamily: font.bold, fontWeight: weight.semibold, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  tileTitle: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 20, lineHeight: 25, letterSpacing: -0.3 },
  tileTitleHero: { fontSize: 26, lineHeight: 31, letterSpacing: -0.45 },
  tileTitleBar: { fontSize: 17, lineHeight: 22 },
  tileFocus: Platform.OS === 'web' ? ({ boxShadow: `0 0 0 3px ${focus}` } as object) : {},
  tileDetail: { fontFamily: font.medium, fontWeight: weight.regular, fontSize: 14, lineHeight: 20 },
  tileMoney: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 20, lineHeight: 24, letterSpacing: -0.35, marginTop: 4 },
  tileMoneyLabel: { fontFamily: font.semi, fontWeight: weight.medium, fontSize: 12, letterSpacing: 0.2 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' },
  tileMeta: { fontFamily: font.semi, fontWeight: weight.medium, fontSize: 13 },
  sheetHost: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  sheetHostDesktop: { justifyContent: 'center', alignItems: 'center', padding: space.lg },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: color.line,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxHeight: '88%',
    gap: space.md,
  },
  sheetDesktop: { width: '100%', maxWidth: 520, borderRadius: 28, maxHeight: '80%' },
  sheetGrab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.lineStrong, marginBottom: 4 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.sunken },
    });
  }, [color, scheme]);
}
