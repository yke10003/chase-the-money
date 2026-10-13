import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/icon';
import type { Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { useReduceMotion } from '@/lib/motion';
import { useTheme } from '@/state/theme';

export type Moment = {
  title: string;
  /** Formatted banked amount, for example "€410". */
  banked?: string | null;
  xp?: number | null;
  note?: string | null;
  again?: { label: string; href: string } | null;
};

const FeedbackContext = createContext<(moment: Moment) => void>(() => undefined);

export function useFeedback() {
  return useContext(FeedbackContext);
}

export function FeedbackProvider({ children, placement = 'bottom' }: { children: ReactNode; placement?: 'top' | 'bottom' }) {
  const [moment, setMoment] = useState<(Moment & { key: number }) | null>(null);
  const show = useCallback((next: Moment) => setMoment({ ...next, key: Date.now() }), []);

  return (
    <FeedbackContext.Provider value={show}>
      {children}
      {moment ? <MomentCard key={moment.key} moment={moment} placement={placement} onDone={() => setMoment(null)} /> : null}
    </FeedbackContext.Provider>
  );
}

function MomentCard({ moment, placement, onDone }: { moment: Moment; placement: 'top' | 'bottom'; onDone: () => void }) {
  const { color, type: typeScale } = useTheme();
  const styles = useMemo(() => createStyles(color), [color]);
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const enter = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  const router = useRouter();

  useEffect(() => {
    if (!reduce) {
      Animated.timing(enter, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    }

    const timer = setTimeout(() => {
      if (reduce) {
        onDone();
        return;
      }

      Animated.timing(enter, { toValue: 0, duration: 180, useNativeDriver: false }).start(onDone);
    }, moment.banked ? 6400 : 4600);

    return () => clearTimeout(timer);
  }, [enter, moment.banked, onDone, reduce]);

  const top = placement === 'top';
  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [top ? -28 : 28, 0] });
  const anchor = top ? { top: insets.top + space.sm } : { bottom: space.xl };

  return (
    <Animated.View pointerEvents="box-none" style={[styles.host, anchor, { opacity: enter, transform: [{ translateY }] }]}>
      <Pressable accessibilityRole="alert" onPress={onDone} style={styles.card}>
        {moment.banked ? (
          <View style={{ gap: 2 }}>
            <Text style={styles.kicker}>Received</Text>
            <Text style={styles.banked}>{moment.banked}</Text>
          </View>
        ) : moment.xp ? (
          <View style={styles.xpBlock}>
            <Icon name="lightning" size={22} color={color.onInk} weight="fill" />
            <Text style={styles.xpFigure}>+{moment.xp} XP</Text>
          </View>
        ) : (
          <View style={styles.check}>
            <Icon name="check" size={20} color={color.onInk} weight="bold" />
          </View>
        )}
        <Text style={typeScale.subheading}>{moment.title.replace(/^Done: /, 'Nice — ')}</Text>
        {moment.xp && moment.banked ? (
          <View style={styles.xpInline}>
            <Icon name="lightning" size={14} color={color.onInk} weight="fill" />
            <Text style={styles.xpInlineText}>+{moment.xp} XP</Text>
          </View>
        ) : null}
        {moment.note ? <Text style={[typeScale.body, { color: color.ink2 }]}>{moment.note}</Text> : null}
        {moment.again ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onDone();
              router.dismissTo(moment.again?.href ?? '/');
            }}
            style={styles.again}
          >
            <Text style={styles.againText}>{moment.again.label}</Text>
            <Icon name="arrowRight" size={16} color={color.onInk} weight="bold" />
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(color: Palette) {
  return StyleSheet.create({
  host: { position: 'absolute', right: space.md, left: space.md, alignItems: 'center', zIndex: 50 },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: space.sm,
    backgroundColor: color.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: color.lineStrong,
    padding: space.lg,
    boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
  },
  kicker: { fontFamily: font.bold, fontWeight: weight.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: color.moneyInk },
  banked: { fontFamily: font.displayHeavy, fontWeight: weight.bold, fontSize: 44, lineHeight: 48, letterSpacing: -0.8, color: color.money },
  xpBlock: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: color.xp, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  xpFigure: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.4, color: color.xpOn },
  xpInline: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: color.xp, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  xpInlineText: { fontFamily: font.bold, fontWeight: weight.semibold, fontSize: 13, color: color.xpOn },
  check: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  again: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: color.ink, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14, marginTop: 4 },
  againText: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 14, color: color.onInk },
  });
}
