import { Stack, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CockpitBody, CockpitProvider, type CockpitAction, type PublishedScore } from '@/components/cockpit-context';
import { MenuSheet } from '@/components/menu-sheet';
import { homePaint, ScoreHeroView } from '@/components/score-hero';
import { useTheme } from '@/state/theme';
import { cockpitArea, isCockpitRoot, shellPath, type CockpitArea } from '@/lib/cockpit-scene';
import { navLog } from '@/lib/nav-log';

let cockpitMounts = 0;

function sameScore(current: PublishedScore | null, next: PublishedScore): boolean {
  if (!current || current.path !== next.path) {
    return false;
  }

  return current.wash === next.wash
    && current.paint.from === next.paint.from
    && current.paint.to === next.paint.to
    && current.paint.mid === next.paint.mid
    && current.kicker === next.kicker
    && current.amount === next.amount
    && current.caption === next.caption
    && current.note === next.note
    && current.actionLabels.join('|') === next.actionLabels.join('|')
    && current.metrics.map((metric) => `${metric.label}:${metric.value}`).join('|') === next.metrics.map((metric) => `${metric.label}:${metric.value}`).join('|')
    && (current.series?.length ?? 0) === (next.series?.length ?? 0)
    && (current.series?.at(-1)?.amount_minor ?? 0) === (next.series?.at(-1)?.amount_minor ?? 0);
}

function backdropFor(area: CockpitArea, accent: ReturnType<typeof useTheme>['accent']): PublishedScore {
  if (area === 'home') {
    return { path: '/', wash: 'home', paint: homePaint, kicker: '', amount: '', caption: '', metrics: [], series: null, note: null, actionLabels: [], actionIcons: [] };
  }

  const paint = area === 'sell' ? accent.sell : area === 'freelance' ? accent.earn : area === 'build' ? accent.build : accent.recover;
  const wash = area === 'freelance' ? 'earn' : area;
  const kicker = area === 'sell' ? 'Sell' : area === 'freelance' ? 'Freelance' : area === 'build' ? 'Build' : 'Recover';

  return { path: '', wash, paint, kicker, amount: '', caption: '', metrics: [], series: null, note: null, actionLabels: [], actionIcons: [] };
}

/**
 * One shader stays behind this view (NativeTabWash). One native sheet sits over
 * the tabs. The system tab bar is lifted into that sheet by the native module.
 */
export function CockpitShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { color, accent } = useTheme();
  const actionsRef = useRef<CockpitAction[]>([]);
  const [published, setPublished] = useState<PublishedScore | null>(null);
  const [detent, setDetent] = useState(0);
  const publish = useCallback((next: PublishedScore) => {
    setPublished((current) => (sameScore(current, next) ? current : next));
  }, []);
  // Profile, Progress, Product Detail and Sell creation sit above the tabs.
  // The hero keeps showing the tab underneath them.
  const [lastTabPath, setLastTabPath] = useState<string | null>(null);
  const tabPath = shellPath(pathname, lastTabPath);

  if (tabPath !== lastTabPath) {
    setLastTabPath(tabPath);
  }

  const area = cockpitArea(tabPath);
  const rooted = isCockpitRoot(tabPath) && published != null && published.path === tabPath;
  const score = rooted ? published : area ? backdropFor(area, accent) : null;

  useEffect(() => {
    cockpitMounts += 1;
    navLog('cockpit.mount', { count: cockpitMounts });

    return () => navLog('cockpit.unmount');
  }, []);

  useEffect(() => {
    navLog('cockpit.detent', { index: detent });
  }, [detent]);

  useEffect(() => {
    navLog('cockpit.hero', { area, tabPath });
  }, [area, tabPath]);

  return (
    <CockpitProvider publish={publish} actionsRef={actionsRef} detent={detent}>
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }} pointerEvents="box-none">{children}</View>
        {score ? (
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <ScoreHeroView
              backdrop
              detent={detent}
              wash={score.wash}
              paint={score.paint}
              kicker={score.kicker}
              amount={score.amount}
              caption={score.caption}
              metrics={score.metrics}
              series={score.series}
              note={score.note}
              actions={score.actionLabels.map((label, index) => ({
                label,
                icon: score.actionIcons[index],
                onPress: () => actionsRef.current[index]?.onPress(),
              }))}
            />
          </View>
        ) : null}
        <MenuSheet paper={color.paper} onDetent={setDetent}>
          <CockpitBody />
        </MenuSheet>
      </View>
    </CockpitProvider>
  );
}

/** Stack under one tab so nested routes are real screens, not extra tabs. */
export function AreaStack({ children, initialRouteName }: { children?: ReactNode; initialRouteName?: string }) {
  return (
    <Stack
      initialRouteName={initialRouteName}
      unstable_nativeProps={{ nativeContainerStyle: { backgroundColor: 'transparent' } }}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      {children}
    </Stack>
  );
}
