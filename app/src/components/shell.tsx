import { usePathname, useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { useLayout } from '@/design/layout';
import type { Palette, Scheme } from '@/design/palette';
import { contentMaxWidth, font, radius, space, weight } from '@/design/tokens';
import { useAuth } from '@/state/auth';
import { useTheme } from '@/state/theme';

type TintKey = 'home' | 'sell' | 'earn' | 'build' | 'recover' | 'progress' | 'friends' | 'profile';
type NavItem = { href: string; label: string; short: string; icon: IconName; soon?: boolean; tint: TintKey };

const HOME: NavItem = { href: '/', label: 'Home', short: 'Home', icon: 'house', tint: 'home' };

const MAKE: NavItem[] = [
  { href: '/sell', label: 'Sell', short: 'Sell', icon: 'storefront', tint: 'sell' },
  { href: '/freelance', label: 'Freelance', short: 'Freelance', icon: 'briefcase', tint: 'earn' },
  { href: '/build', label: 'Build', short: 'Build', icon: 'rocket', tint: 'build' },
  { href: '/recover', label: 'Recover', short: 'Recover', icon: 'handCoins', tint: 'recover' },
];

const TRACK: NavItem[] = [
  { href: '/progress', label: 'Progress', short: 'Progress', icon: 'chart', tint: 'progress' },
  { href: '/friends', label: 'Friends', short: 'Friends', icon: 'users', soon: true, tint: 'friends' },
];

const PHONE_TABS: NavItem[] = [HOME, ...MAKE];

const COCKPIT_ROOTS = new Set(['/', '/sell', '/freelance', '/build', '/recover']);

export function isCockpitRoot(pathname: string): boolean {
  return COCKPIT_ROOTS.has(pathname);
}

function isSellFocus(pathname: string): boolean {
  return pathname === '/sell/new'
    || pathname === '/sell/listed'
    || pathname.startsWith('/sell/setup')
    || pathname.startsWith('/sell/items');
}

function useShell() {
  const theme = useTheme();
  const styles = useMemo(() => createShellStyles(theme.color, theme.scheme), [theme.color, theme.scheme]);

  function tint(key: TintKey) {
    if (key === 'sell') return theme.accent.sell.from;
    if (key === 'earn') return theme.accent.earn.from;
    if (key === 'build') return theme.accent.build.from;
    if (key === 'recover') return theme.accent.recover.from;
    if (key === 'progress') return theme.color.money;

    return key === 'home' ? theme.color.ink : theme.color.ink2;
  }

  return { ...theme, styles, typeScale: theme.type, tint };
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { styles } = useShell();
  const layout = useLayout();

  if (layout.phone) {
    return <PhoneShell>{children}</PhoneShell>;
  }

  return (
    <View style={styles.frame}>
      {layout.desktop ? <Rail /> : <CompactRail />}
      <ScrollView style={{ flex: 1, minWidth: 0 }} contentContainerStyle={[styles.content, { paddingHorizontal: layout.wide ? space.xxl : space.xl }]}>
        <View style={styles.contentInner}>{children}</View>
      </ScrollView>
    </View>
  );
}

function Wordmark({ compact = false, light = true }: { compact?: boolean; light?: boolean }) {
  const { color, styles } = useShell();

  return (
    <View style={styles.wordmark}>
      <View style={styles.mark}>
        <View style={styles.markFill} />
      </View>
      {compact ? null : <Text style={[styles.wordmarkText, { color: light ? color.ink : color.onInk }]}>Nolume</Text>}
    </View>
  );
}

function Rail() {
  const { styles, typeScale } = useShell();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.rail}>
      <View style={{ gap: space.lg }}>
        <Pressable accessibilityRole="link" accessibilityLabel="Home" onPress={() => router.push('/')}>
          <Wordmark />
        </Pressable>
        <View style={{ gap: 2 }}>
          <RailLink item={HOME} active={isActive(pathname, HOME.href)} />
        </View>
        <View style={{ gap: 2 }}>
          <Text style={[typeScale.eyebrow, { paddingHorizontal: 12, paddingTop: 4 }]}>Make money</Text>
          {MAKE.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </View>
        <View style={{ gap: 2 }}>
          <Text style={[typeScale.eyebrow, { paddingHorizontal: 12, paddingTop: 4 }]}>Track</Text>
          {TRACK.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </View>
      </View>
      <RailUser active={isActive(pathname, '/settings')} />
    </View>
  );
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const { color, styles, tint } = useShell();
  const router = useRouter();
  const mark = tint(item.tint);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={() => router.push(item.href)}
      style={(state) => [
        styles.railLink,
        !active && (state as PressableStateCallbackType & { hovered?: boolean }).hovered && { opacity: 0.72 },
      ]}
    >
      {active ? <View style={[styles.railPip, { backgroundColor: mark }]} /> : <View style={styles.railPip} />}
      <Icon name={item.icon} size={20} color={active ? mark : color.ink2} weight={active ? 'fill' : 'regular'} />
      <Text style={[styles.railLabel, active && { color: color.ink, fontFamily: font.semi, fontWeight: weight.semibold }]}>{item.label}</Text>
      {item.soon ? <Text style={styles.soon}>Soon</Text> : null}
    </Pressable>
  );
}

function RailUser({ active }: { active: boolean }) {
  const { color, styles, typeScale } = useShell();
  const router = useRouter();
  const auth = useAuth();
  const initial = (auth.user?.name ?? '?').trim().charAt(0).toUpperCase();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Profile and settings"
      onPress={() => router.push('/settings')}
      style={(state) => [styles.user, (state as PressableStateCallbackType & { hovered?: boolean }).hovered && { opacity: 0.72 }]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[typeScale.bodyStrong, active && { color: color.ink }]}>{auth.user?.name}</Text>
        <Text style={[typeScale.small, { fontSize: 12 }]}>Profile</Text>
      </View>
    </Pressable>
  );
}

function CompactRail() {
  const { color, styles, tint } = useShell();
  const pathname = usePathname();
  const router = useRouter();
  const items = [HOME, ...MAKE, ...TRACK, { href: '/settings', label: 'Profile', short: 'You', icon: 'user' as IconName, tint: 'profile' as const }];

  return (
    <ScrollView style={styles.compactRail} contentContainerStyle={{ alignItems: 'center', gap: space.xs, paddingBottom: space.lg }}>
      <Wordmark compact />
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Pressable key={item.href} accessibilityRole="link" accessibilityLabel={item.label} onPress={() => router.push(item.href)} style={styles.compactLink}>
            <Icon name={item.icon} size={22} color={active ? tint(item.tint) : color.ink2} weight={active ? 'fill' : 'regular'} />
            <Text style={[styles.compactLabel, active && { color: color.ink }]}>{item.short}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  const { color, styles, tint } = useShell();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bleed = isCockpitRoot(pathname);
  const focus = isSellFocus(pathname);

  if (focus) {
    return (
      <View style={{ flex: 1, backgroundColor: color.paper, paddingTop: insets.top }}>
        {children}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      {bleed ? null : <View style={{ height: insets.top }} />}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: bleed ? 0 : space.md, paddingTop: bleed ? 0 : space.sm, paddingBottom: 128 + insets.bottom }}>
        {bleed ? (
          <View style={{ position: 'absolute', top: insets.top + 8, right: 12, zIndex: 5, flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="link" accessibilityLabel="Progress" onPress={() => router.push('/progress')} style={styles.heroIcon}>
              <Icon name="chart" size={18} color="#F7F4EE" />
            </Pressable>
            <Pressable accessibilityRole="link" accessibilityLabel="Profile" onPress={() => router.push('/settings')} style={styles.heroIcon}>
              <Icon name="user" size={18} color="#F7F4EE" />
            </Pressable>
          </View>
        ) : null}
        {children}
      </ScrollView>
      <View style={[styles.tabDock, { bottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.tabBar}>
          {PHONE_TABS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Pressable key={item.href} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => router.push(item.href)} style={styles.tab}>
                <View style={styles.tabIcon}>
                  <Icon name={item.icon} size={22} color={active ? tint(item.tint) : color.ink3} weight={active ? 'fill' : 'regular'} />
                </View>
                <Text style={[styles.tabLabel, active && { color: color.ink }]} numberOfLines={1}>{item.short}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Full-bleed page without navigation, for onboarding. */
export function FocusShell({ children }: { children: ReactNode }) {
  const { color } = useShell();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.paper }} contentContainerStyle={{ flexGrow: 1 }}>
      {children}
    </ScrollView>
  );
}

const webPointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null;

function createShellStyles(color: Palette, scheme: Scheme) {
  return StyleSheet.create({
  frame: { flex: 1, flexDirection: 'row', backgroundColor: color.paper },
  content: { paddingTop: space.xl, paddingBottom: space.xxxl },
  contentInner: { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' },
  rail: {
    width: 232,
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingTop: space.lg,
    paddingBottom: space.md,
    justifyContent: 'space-between',
    backgroundColor: color.paper,
  },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  mark: { width: 22, height: 22, borderRadius: 7, backgroundColor: color.ink, overflow: 'hidden', justifyContent: 'flex-end' },
  markFill: { height: '46%', backgroundColor: color.money },
  wordmarkText: { fontFamily: font.displayHeavy, fontWeight: weight.bold, fontSize: 18, letterSpacing: -0.4 },
  railLink: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingRight: 10, ...webPointer },
  railPip: { width: 3, height: 18, borderRadius: 2 },
  railLabel: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 15, color: color.ink2, flex: 1 },
  soon: { fontFamily: font.semi, fontWeight: weight.medium, fontSize: 10, color: color.ink3, letterSpacing: 0.3 },
  railGoal: { gap: 6, padding: space.md, borderRadius: radius.lg, backgroundColor: color.paper, borderWidth: 1, borderColor: color.line },
  railGoalFigure: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 24, letterSpacing: -0.5 },
  railGoalOf: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 12, color: color.ink3, marginTop: -2, marginBottom: 4 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.md, ...webPointer },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.display, fontWeight: weight.semibold, fontSize: 15, color: color.onInk },
  compactRail: { width: 84, maxWidth: 84, flexGrow: 0, flexShrink: 0, paddingTop: space.lg, backgroundColor: color.paper },
  phoneIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heroIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  compactLink: { width: 68, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: radius.md, ...webPointer },
  compactLabel: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 10, color: color.ink3 },
  phoneTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.md, paddingBottom: 4 },
  tabDock: { position: 'absolute', left: 12, right: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: 22,
    paddingVertical: 6,
    paddingHorizontal: 4,
    boxShadow: scheme === 'dark' ? '0 16px 40px rgba(0,0,0,0.45)' : '0 10px 28px rgba(28,27,25,0.12)',
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2, ...webPointer },
  tabIcon: { width: 44, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 10, color: color.ink3 },
  });
}
