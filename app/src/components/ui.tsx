import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Defs, Line, Pattern, Rect } from 'react-native-svg';

import type { OpportunityType } from '@/api/types';
import { Icon, type IconName } from '@/components/icon';
import type { Palette, Scheme } from '@/design/palette';
import { font, radius, space, type as bareType, weight } from '@/design/tokens';
import { CERTAINTY_LABEL, TYPE_META, type Attention, type Certainty } from '@/lib/mission';
import { cardShadow, useTheme } from '@/state/theme';

type Interaction = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

function useUi() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme.color, theme.scheme), [theme.color, theme.scheme]);
  const tones = useMemo(() => buttonTones(theme.color, theme.scheme), [theme.color, theme.scheme]);

  return { ...theme, styles, tones, typeScale: theme.type };
}

/* ---------- Text ---------- */

export function T({
  variant = 'body',
  color: tint,
  style,
  numberOfLines,
  children,
}: {
  variant?: keyof typeof bareType;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children: ReactNode;
}) {
  const { typeScale } = useUi();

  return (
    <Text numberOfLines={numberOfLines} style={[typeScale[variant], tint ? { color: tint } : null, style]}>
      {children}
    </Text>
  );
}

/* ---------- Buttons ---------- */

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'money';

export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  tone = 'primary',
  size = 'md',
  icon,
  iconRight,
  full = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: ButtonTone;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
}) {
  const { styles, tones } = useUi();
  const palette = tones[tone];
  const inactive = disabled || busy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={(state) => {
        const { pressed, hovered } = state as Interaction;

        return [
          styles.button,
          size === 'sm' && styles.buttonSm,
          size === 'lg' && styles.buttonLg,
          { backgroundColor: hovered && !inactive ? palette.hover : palette.bg, borderColor: palette.border },
          full && { alignSelf: 'stretch' },
          pressed && !inactive && { transform: [{ scale: 0.98 }] },
          inactive && { opacity: 0.45 },
        ];
      }}
    >
      {busy ? <ActivityIndicator size="small" color={palette.fg} /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} color={palette.fg} weight="bold" /> : null}
      <Text style={[styles.buttonText, size === 'sm' && styles.buttonTextSm, size === 'lg' && styles.buttonTextLg, { color: palette.fg }]}>{label}</Text>
      {iconRight && !busy ? <Icon name={iconRight} size={size === 'sm' ? 15 : 18} color={palette.fg} weight="bold" /> : null}
    </Pressable>
  );
}

function buttonTones(color: Palette, scheme: Scheme): Record<ButtonTone, { bg: string; hover: string; fg: string; border: string }> {
  return {
    primary: { bg: color.ink, hover: scheme === 'dark' ? '#FFFFFF' : '#2A2824', fg: color.onInk, border: color.ink },
    secondary: { bg: color.surface, hover: color.sunken, fg: color.ink, border: color.lineStrong },
    ghost: { bg: 'transparent', hover: color.sunken, fg: color.ink, border: 'transparent' },
    danger: { bg: 'transparent', hover: color.dangerSoft, fg: color.danger, border: color.danger },
    money: { bg: color.money, hover: color.money, fg: scheme === 'dark' ? '#10210F' : '#F4FBF6', border: color.money },
  };
}

export function LinkButton({ label, onPress, icon, tint }: { label: string; onPress: () => void; icon?: IconName; tint?: string }) {
  const { color, styles, typeScale } = useUi();
  const ink = tint ?? color.ink2;

  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={(state) => [styles.linkButton, (state as Interaction).hovered && { opacity: 0.7 }]}>
      {icon ? <Icon name={icon} size={16} color={ink} /> : null}
      <Text style={[typeScale.small, { color: ink, fontFamily: font.semi, fontWeight: weight.semibold }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Surfaces ---------- */

export function Panel({
  children,
  tone = 'surface',
  padding = 'lg',
  style,
}: {
  children: ReactNode;
  tone?: 'surface' | 'sunken' | 'ink' | 'outline';
  padding?: 'none' | 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
}) {
  const { styles, scheme } = useUi();

  return (
    <View
      style={[
        styles.panel,
        scheme === 'light' && tone === 'surface' ? cardShadow('light') : null,
        tone === 'sunken' && styles.panelSunken,
        tone === 'ink' && styles.panelInk,
        tone === 'outline' && styles.panelOutline,
        { padding: padding === 'none' ? 0 : space[padding] },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
}) {
  const { styles } = useUi();

  return (
    <View style={styles.sectionTitle}>
      <View style={{ gap: 2, flexShrink: 1 }}>
        {eyebrow ? <T variant="eyebrow">{eyebrow}</T> : null}
        {title ? <T variant="heading">{title}</T> : null}
      </View>
      {action}
    </View>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const { color, styles } = useUi();

  return (
    <View style={styles.pageHeader}>
      <View style={{ gap: 6, flexShrink: 1 }}>
        <T variant="title">{title}</T>
        {subtitle ? <T variant="body" color={color.ink2}>{subtitle}</T> : null}
      </View>
      {action}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { color } = useUi();

  return <View style={[{ height: 1, backgroundColor: color.line }, style]} />;
}

/* ---------- Mission type ---------- */

export function TypeGlyph({ type, size = 40 }: { type: OpportunityType; size?: number }) {
  const { styles, typeColor } = useUi();
  const tint = typeColor[type];

  return (
    <View style={[styles.glyph, { width: size, height: size, backgroundColor: tint.soft, borderRadius: size * 0.28 }]}>
      <Icon name={TYPE_META[type].icon} size={size * 0.5} color={tint.ink} weight="duotone" />
    </View>
  );
}

export function TypeTag({ type, label }: { type: OpportunityType; label?: string }) {
  const { styles, typeScale, typeColor } = useUi();
  const tint = typeColor[type];

  return (
    <View style={styles.typeTag}>
      <View style={[styles.typeDot, { backgroundColor: tint.base }]} />
      <Text style={[typeScale.small, { color: tint.ink, fontFamily: font.semi, fontWeight: weight.semibold }]}>{label ?? TYPE_META[type].label}</Text>
    </View>
  );
}

/* ---------- Money certainty ---------- */

export function CertaintySwatch({ certainty, size = 12 }: { certainty: Certainty; size?: number }) {
  const { color } = useUi();
  const id = `stripe-${size}`;

  if (certainty === 'neutral') {
    return <View style={{ width: size, height: size, borderRadius: 3, backgroundColor: color.sunken, borderWidth: 1, borderColor: color.lineStrong }} />;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      {certainty === 'banked' ? <Rect x={0} y={0} width={12} height={12} rx={3} fill={color.money} /> : null}
      {certainty === 'expected' ? (
        <>
          <Defs>
            <Pattern id={id} patternUnits="userSpaceOnUse" width={4} height={4} patternTransform="rotate(45)">
              <Line x1={0} y1={0} x2={0} y2={4} stroke={color.money} strokeWidth={2.2} />
            </Pattern>
          </Defs>
          <Rect x={0.75} y={0.75} width={10.5} height={10.5} rx={2.5} fill={`url(#${id})`} stroke={color.money} strokeWidth={1.5} />
        </>
      ) : null}
      {certainty === 'possible' ? (
        <>
          <Rect x={0.75} y={0.75} width={10.5} height={10.5} rx={2.5} fill="none" stroke={color.ink3} strokeWidth={1.5} strokeDasharray="2 2" />
          <Circle cx={6} cy={6} r={1.4} fill={color.ink3} />
        </>
      ) : null}
    </Svg>
  );
}

export function Amount({
  value,
  certainty,
  size = 'md',
  caption,
}: {
  value: string;
  certainty: Certainty;
  size?: 'sm' | 'md' | 'lg';
  caption?: string;
}) {
  const { color, styles, typeScale } = useUi();
  const figureColor = certainty === 'banked' ? color.money : certainty === 'possible' ? color.ink2 : color.ink;
  const figureStyle = size === 'lg' ? typeScale.display : size === 'sm' ? { ...typeScale.figure, fontSize: 15 } : typeScale.figure;

  return (
    <View style={{ gap: 4 }}>
      <Text style={[figureStyle, { color: figureColor }]}>{value}</Text>
      {certainty !== 'neutral' || caption ? (
        <View style={styles.amountCaption}>
          <CertaintySwatch certainty={certainty} size={10} />
          <Text style={[typeScale.small, { fontSize: 12 }]}>{caption ?? (certainty === 'neutral' ? '' : CERTAINTY_LABEL[certainty])}</Text>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- Status ---------- */

function attentionStyle(color: Palette): Record<Exclude<Attention, null>, { label: string; bg: string; fg: string; icon: IconName }> {
  return {
    overdue: { label: 'Overdue', bg: color.overdueSoft, fg: color.overdue, icon: 'warning' },
    today: { label: 'Due today', bg: color.dueSoft, fg: color.due, icon: 'clock' },
    soon: { label: 'Due soon', bg: color.sunken, fg: color.ink2, icon: 'calendar' },
    later: { label: 'Waiting', bg: color.sunken, fg: color.ink2, icon: 'hourglass' },
  };
}

export function AttentionTag({ attention, label }: { attention: Exclude<Attention, null>; label?: string }) {
  const { color, styles } = useUi();
  const tone = attentionStyle(color)[attention];

  return (
    <View style={[styles.tag, { backgroundColor: tone.bg }]}>
      <Icon name={tone.icon} size={13} color={tone.fg} weight="bold" />
      <Text style={[styles.tagText, { color: tone.fg }]}>{label ?? tone.label}</Text>
    </View>
  );
}

export function Tag({ label, icon, tint, bg }: { label: string; icon?: IconName; tint?: string; bg?: string }) {
  const { color, styles } = useUi();
  const ink = tint ?? color.ink2;
  const fill = bg ?? color.sunken;

  return (
    <View style={[styles.tag, { backgroundColor: fill }]}>
      {icon ? <Icon name={icon} size={13} color={ink} weight="bold" /> : null}
      <Text style={[styles.tagText, { color: ink }]}>{label}</Text>
    </View>
  );
}

export function XpTag({ amount, large = false }: { amount: number; large?: boolean }) {
  const { color, styles } = useUi();

  return (
    <View style={[styles.xpChip, large && styles.xpChipLarge]} accessibilityLabel={`Plus ${amount} XP`}>
      <Icon name="lightning" size={large ? 15 : 12} color={color.xpOn} weight="fill" />
      <Text style={[styles.xpChipText, { color: color.xpOn }, large && { fontSize: 14, lineHeight: 18 }]}>+{amount} XP</Text>
    </View>
  );
}

/* ---------- Goal meter ---------- */

export function GoalMeter({ percent, height = 14 }: { percent: number; height?: number }) {
  const { styles } = useUi();
  const clamped = Math.max(0, Math.min(100, percent));
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: clamped,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clamped, progress]);

  const width = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: clamped }} style={[styles.meterTrack, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.meterFill, { width, borderRadius: height / 2 }]} />
      {[25, 50, 75].map((mark) => (
        <View key={mark} style={[styles.meterTick, { left: `${mark}%`, opacity: clamped >= mark ? 0.35 : 1 }]} />
      ))}
    </View>
  );
}

/* ---------- Inputs ---------- */

export function Field({
  label,
  hint,
  error,
  prefix,
  large = false,
  ...input
}: { label?: string; hint?: string; error?: string | null; prefix?: string; large?: boolean } & TextInputProps) {
  const { color, styles } = useUi();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputBox, large && styles.inputBoxLarge, focused && styles.inputFocused, error ? styles.inputError : null]}>
        {prefix ? <Text style={[styles.prefix, large && styles.prefixLarge]}>{prefix}</Text> : null}
        <TextInput
          accessibilityLabel={input.accessibilityLabel ?? label}
          placeholderTextColor={color.ink3}
          {...input}
          onFocus={(event) => {
            setFocused(true);
            input.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            input.onBlur?.(event);
          }}
          style={[styles.input, large && styles.inputLarge, webNoOutline]}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function MoneyField(props: { label?: string; hint?: string; error?: string | null; value: string; onChangeText: (value: string) => void; placeholder?: string; large?: boolean; autoFocus?: boolean; accessibilityLabel?: string }) {
  return <Field {...props} prefix="€" keyboardType="decimal-pad" inputMode="decimal" />;
}

export function DateField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const { color, styles } = useUi();

  if (Platform.OS === 'web') {
    return (
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>{label}</Text>
        <input
          type="date"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{
            border: `1px solid ${color.lineStrong}`,
            borderRadius: radius.sm,
            padding: '10px 12px',
            fontFamily: font.medium,
            fontSize: 15,
            color: color.ink,
            background: color.surface,
            maxWidth: 260,
          }}
        />
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    );
  }

  return <Field label={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" autoCapitalize="none" hint={hint} />;
}

/** Single choice, compact. For two to five short options. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T | null;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label?: string;
}) {
  const { color, styles } = useUi();

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View accessibilityRole="radiogroup" style={styles.segmented}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              style={(state) => [styles.segment, selected && styles.segmentSelected, !selected && (state as Interaction).hovered && { backgroundColor: color.paper }]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Toggle chips. Works as multi select, or single select with `single`. */
export function Chips({
  values,
  options,
  onChange,
  single = false,
  label,
}: {
  values: string[];
  options: Array<{ value: string; label: string; icon?: IconName }>;
  onChange: (values: string[]) => void;
  single?: boolean;
  label?: string;
}) {
  const { color, styles } = useUi();

  function toggle(value: string) {
    if (single) {
      onChange([value]);
      return;
    }

    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const selected = values.includes(option.value);

          return (
            <Pressable
              key={option.value}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityState={single ? { selected } : { checked: selected }}
              onPress={() => toggle(option.value)}
              style={(state) => [styles.chip, selected && styles.chipSelected, !selected && (state as Interaction).hovered && { borderColor: color.ink3 }]}
            >
              {selected ? <Icon name="check" size={14} color={color.onInk} weight="bold" /> : option.icon ? <Icon name={option.icon} size={15} color={color.ink2} /> : null}
              <Text style={[styles.chipText, selected && { color: color.onInk }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A tappable card for a choice that needs a sentence of context. */
export function OptionCard({
  title,
  detail,
  selected,
  onPress,
  icon,
  accent,
}: {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  icon?: ReactNode;
  accent?: string;
}) {
  const { color, styles, typeScale } = useUi();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(state) => [
        styles.option,
        selected && { borderColor: accent ?? color.ink, backgroundColor: color.surface },
        selected && styles.optionSelected,
        !selected && (state as Interaction).hovered && { borderColor: color.ink3 },
      ]}
    >
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={typeScale.bodyStrong}>{title}</Text>
        {detail ? <Text style={typeScale.small}>{detail}</Text> : null}
      </View>
      <View style={[styles.radio, selected && { borderColor: accent ?? color.ink }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: accent ?? color.ink }]} /> : null}
      </View>
    </Pressable>
  );
}

/** A row that navigates or expands. */
export function PressableRow({
  onPress,
  children,
  style,
  accessibilityLabel,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { color, styles } = useUi();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={(state) => [styles.row, (state as Interaction).hovered && { backgroundColor: color.sunken }, style]}
    >
      {children}
    </Pressable>
  );
}

export function Disclosure({ label, children, initiallyOpen = false }: { label: string; children: ReactNode; initiallyOpen?: boolean }) {
  const { color, styles, typeScale } = useUi();
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <View style={{ gap: space.sm }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={styles.disclosure}>
        <Icon name={open ? 'caretDown' : 'caretRight'} size={14} color={color.ink2} weight="bold" />
        <Text style={[typeScale.small, { fontFamily: font.semi }]}>{label}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

/* ---------- States ---------- */

export function LoadingState({ label }: { label?: string }) {
  const { color, styles } = useUi();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: false }),
      ]),
    );
    loop.start();

    return () => loop.stop();
  }, [pulse]);

  return (
    <View accessibilityLabel={label ?? 'Loading'} style={{ gap: space.md, paddingVertical: space.lg }}>
      <Animated.View style={[styles.skeleton, { width: 220, height: 28, opacity: pulse }]} />
      <Animated.View style={[styles.skeleton, { width: '100%', height: 120, opacity: pulse }]} />
      <Animated.View style={[styles.skeleton, { width: '70%', height: 64, opacity: pulse }]} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { color } = useUi();

  return (
    <Panel tone="outline" style={{ gap: space.sm, alignItems: 'flex-start' }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Icon name="warning" size={18} color={color.danger} weight="bold" />
        <T variant="bodyStrong">That did not load.</T>
      </View>
      <T variant="small">{message}</T>
      {onRetry ? <Button label="Try again" tone="secondary" size="sm" onPress={onRetry} /> : null}
    </Panel>
  );
}

export function InlineError({ message }: { message: string }) {
  const { color, styles, typeScale } = useUi();

  return (
    <View style={styles.inlineError}>
      <Icon name="warning" size={16} color={color.danger} weight="bold" />
      <Text style={[typeScale.small, { color: color.danger, flex: 1 }]}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const { color, styles } = useUi();

  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} color={color.ink2} weight="duotone" />
      </View>
      <View style={{ gap: 4, alignItems: 'center' }}>
        <T variant="bodyStrong">{title}</T>
        {body ? <T variant="small" style={{ textAlign: 'center', maxWidth: 360 }}>{body}</T> : null}
      </View>
      {action}
    </View>
  );
}

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

function createStyles(color: Palette, scheme: Scheme) {
  const focusRing = scheme === 'dark' ? 'rgba(244,241,234,0.2)' : 'rgba(28,27,25,0.12)';

  return StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 48,
  },
  buttonSm: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36, borderRadius: radius.sm },
  buttonLg: { paddingVertical: 16, paddingHorizontal: 22, minHeight: 56, borderRadius: radius.lg },
  buttonText: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 15 },
  buttonTextSm: { fontSize: 13 },
  buttonTextLg: { fontSize: 16 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  panel: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line },
  panelSunken: { backgroundColor: color.sunken, borderColor: 'transparent' },
  panelInk: { backgroundColor: color.ink, borderColor: color.ink },
  panelOutline: { backgroundColor: 'transparent', borderColor: color.lineStrong },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.md },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.md, flexWrap: 'wrap' },
  glyph: { alignItems: 'center', justifyContent: 'center' },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeDot: { width: 7, height: 7, borderRadius: 2 },
  amountCaption: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 12, lineHeight: 16 },
  xpChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: color.xp },
  xpChipLarge: { paddingVertical: 6, paddingHorizontal: 10 },
  xpChipText: { fontFamily: font.bold, fontWeight: weight.semibold, fontSize: 12, lineHeight: 16, color: color.xpOn },
  meterTrack: { backgroundColor: color.sunken, overflow: 'hidden', position: 'relative' },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: color.money },
  meterTick: { position: 'absolute', top: 3, bottom: 3, width: 1.5, backgroundColor: color.lineStrong },
  label: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 13, lineHeight: 18, color: color.ink },
  hint: { ...bareType.small, color: color.ink3 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.lineStrong,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    paddingHorizontal: 12,
  },
  inputBoxLarge: { paddingHorizontal: 16, borderRadius: radius.md },
  inputFocused: { borderColor: color.ink, ...(Platform.OS === 'web' ? ({ boxShadow: `0 0 0 3px ${focusRing}` } as object) : {}) },
  inputError: { borderColor: color.danger },
  input: { flex: 1, paddingVertical: 10, fontFamily: font.medium, fontWeight: weight.medium, fontSize: 15, color: color.ink, minWidth: 0 },
  inputLarge: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 32, paddingVertical: 12, letterSpacing: -0.6 },
  prefix: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 15, color: color.ink3, marginRight: 6 },
  prefixLarge: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 32, color: color.ink3, marginRight: 8 },
  error: { ...bareType.small, color: color.danger },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', backgroundColor: color.sunken, borderRadius: radius.md, padding: 3, gap: 2 },
  segment: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8 },
  segmentSelected: { backgroundColor: color.ink },
  segmentText: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 13, color: color.ink2 },
  segmentTextSelected: { fontFamily: font.semi, fontWeight: weight.semibold, color: color.onInk },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: color.lineStrong,
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipSelected: { backgroundColor: color.ink, borderColor: color.ink },
  chipText: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 14, color: color.ink },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    padding: space.md,
  },
  optionSelected: { borderWidth: 2, padding: space.md - 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.md },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  skeleton: { backgroundColor: color.sunken, borderRadius: radius.md },
  inlineError: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: color.dangerSoft, borderRadius: radius.sm, padding: space.sm },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xl, paddingHorizontal: space.lg },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' },
  });
}
