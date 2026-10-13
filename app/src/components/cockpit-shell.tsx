import { Stack, useNavigationContainerRef, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CockpitBody, CockpitProvider, CreationBody, creationPublishedNow, runCreationExit, useCreationAvailability, type CockpitAction, type PublishedScore } from '@/components/cockpit-context';
import { MenuSheet } from '@/components/menu-sheet';
import { homePaint, ScoreHeroView } from '@/components/score-hero';
import { leaveSell, takeSellResume } from '@/components/sell-flow';
import { useTheme } from '@/state/theme';
import { abandonedSellStackKey, cockpitArea, creationHandoffReady, decideCreationCover, holdsCockpitScene, isCockpitRoot, isSellCreationPath, readSellStack, type CockpitArea, type SellStackSnap } from '@/lib/cockpit-scene';

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
  const router = useRouter();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const { color, accent } = useTheme();
  const actionsRef = useRef<CockpitAction[]>([]);
  const [published, setPublished] = useState<PublishedScore | null>(null);
  const [detent, setDetent] = useState(0);
  const publish = useCallback((next: PublishedScore) => {
    setPublished((current) => (sameScore(current, next) ? current : next));
  }, []);
  const area = cockpitArea(pathname);
  const rooted = isCockpitRoot(pathname) && published != null && published.path === pathname;
  const held = published != null && holdsCockpitScene(pathname, published.path);
  const score = rooted || held ? published : area ? backdropFor(area, accent) : null;
  const navigationRef = useNavigationContainerRef();
  const rootState = useRootNavigationState();
  const poppedStack = useRef<string | null>(null);
  const previous = useRef<{ path: string | null; snap: SellStackSnap | null }>({ path: null, snap: null });
  const blockedPath = useRef<string | null>(null);
  const armedPath = useRef<string | null>(null);
  const snap = readSellStack(rootState);
  const snapKey = snap ? `${snap.selected}:${snap.key}:${snap.focusedName}:${snap.depth}` : '';
  useCreationAvailability();
  const publishedCreation = creationPublishedNow();
  const handoffReady = creationHandoffReady({
    pathname,
    previousPath: previous.current.path,
    publishedPath: publishedCreation.path,
    hasNode: publishedCreation.node != null,
  });

  if (!isSellCreationPath(pathname)) {
    blockedPath.current = null;
  }

  const decision = decideCreationCover({
    pathname,
    previousPath: previous.current.path,
    snap,
    previousSnap: previous.current.snap,
    blocked: blockedPath.current === pathname,
  });

  if (decision.pop) {
    blockedPath.current = pathname;
  }

  if (!decision.present) {
    armedPath.current = null;
  } else if (handoffReady) {
    armedPath.current = pathname;
  }

  const showCover = decision.present && armedPath.current === pathname;
  const showCoverRef = useRef(showCover);
  showCoverRef.current = showCover;
  const [, setCoverEpoch] = useState(0);

  useLayoutEffect(() => {
    const live = creationPublishedNow();

    if (!decision.present || live.path !== pathname || live.node == null || armedPath.current === pathname) {
      return;
    }

    armedPath.current = pathname;
    setCoverEpoch((value) => value + 1);
  });

  useEffect(() => {
    previous.current = { path: pathname, snap };

    if (pathname === '/sell') {
      const resumeId = takeSellResume();

      if (resumeId != null) {
        router.push(`/sell/setup/${resumeId}`);
      }
    }

    if (!decision.pop || !decision.stackKey) {
      return;
    }

    navigationRef.current?.dispatch({
      type: 'POP_TO_TOP',
      target: decision.stackKey,
    });
  }, [decision.pop, decision.present, decision.stackKey, navigationRef, pathname, router, showCover, snapKey]);

  useEffect(() => {
    if (isSellCreationPath(pathname)) {
      return;
    }

    const stackKey = abandonedSellStackKey(rootState);

    if (!stackKey) {
      poppedStack.current = null;
      return;
    }

    if (poppedStack.current === stackKey) {
      return;
    }

    poppedStack.current = stackKey;
    navigationRef.current?.dispatch({
      type: 'POP_TO_TOP',
      target: stackKey,
    });
  }, [navigationRef, pathname, rootState]);

  function dismissCreation() {
    if (!showCoverRef.current || !isSellCreationPath(pathRef.current)) {
      return;
    }

    if (!runCreationExit()) {
      leaveSell(router);
    }
  }

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
        <MenuSheet
          paper={color.paper}
          onDetent={setDetent}
          cover={showCover ? <CreationBody /> : null}
          onCoverDismiss={dismissCreation}
        >
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
