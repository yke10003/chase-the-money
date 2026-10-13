import { useFocusEffect, useIsFocused, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';

import type { IconName } from '@/components/icon';
import type { Accent } from '@/design/palette';
import { creationAvailabilityChanged } from '@/lib/cockpit-scene';

export type CockpitPoint = { period: string; amount_minor: number };

export type CockpitAction = { label: string; onPress: () => void; icon?: IconName };

export type PublishedScore = {
  path: string;
  wash: 'home' | 'sell' | 'earn' | 'build' | 'recover' | 'save';
  paint: Accent;
  kicker: string;
  amount: string;
  caption: string;
  metrics: Array<{ label: string; value: string }>;
  series: CockpitPoint[] | null;
  note: string | null;
  actionLabels: string[];
  actionIcons: Array<IconName | undefined>;
};

type Controller = {
  publish: (score: PublishedScore) => void;
  actionsRef: RefObject<CockpitAction[]>;
  detent: number;
};

const CockpitContext = createContext<Controller | null>(null);

const bodyRef: { current: ReactNode } = { current: null };
const bodyListeners = new Set<() => void>();
const creationRef: { current: ReactNode } = { current: null };
const creationListeners = new Set<() => void>();
const creationAvailabilityListeners = new Set<() => void>();
let creationPath: string | null = null;
let creationExit: (() => void) | null = null;

function publishBody(node: ReactNode) {
  bodyRef.current = node;
  bodyListeners.forEach((listener) => listener());
}

function publishCreation(node: ReactNode, path: string) {
  const availabilityChanged = creationAvailabilityChanged(creationPath, creationRef.current != null, path, node != null);
  creationRef.current = node;
  creationPath = path;
  creationListeners.forEach((listener) => listener());

  // Mount or dismiss the sheet. Content edits stay on creationListeners.
  // The shell re-render publishes again, so a content edit must not land here.
  if (availabilityChanged) {
    creationAvailabilityListeners.forEach((listener) => listener());
  }
}

export function setCreationExit(exit: (() => void) | null) {
  creationExit = exit;
}

export function runCreationExit(): boolean {
  const exit = creationExit;

  if (!exit) {
    return false;
  }

  exit();
  return true;
}

/** Renders the focused page inside the one sheet. Not a parent of the tab screens, so updating it does not loop. */
export function CockpitBody() {
  const [, bump] = useState(0);

  // Subscribe before paint. The screen publishes from its own layout effect,
  // which can run first, so read the latest body once this effect is attached.
  useLayoutEffect(() => {
    const listener = () => bump((value) => value + 1);
    bodyListeners.add(listener);
    bump((value) => value + 1);
    return () => {
      bodyListeners.delete(listener);
    };
  }, []);

  return bodyRef.current;
}

function subscribeCreation(listener: () => void) {
  creationListeners.add(listener);
  return () => {
    creationListeners.delete(listener);
  };
}

function creationSnapshot() {
  return creationRef.current;
}

/** The sell creation flow, drawn in the full-screen sheet above the cockpit. */
export function CreationBody() {
  // Subscribe during render. The screen publishes from a sibling layout effect,
  // which runs after this render and before useEffect, so an effect subscription
  // would miss the update that opened the sheet.
  return useSyncExternalStore(subscribeCreation, creationSnapshot, creationSnapshot);
}

/** Page content for the one sheet. Outside the iOS cockpit it renders in place. */
export function CockpitPage({ children }: { children: ReactNode }) {
  const cockpit = useContext(CockpitContext);
  useCockpitBody(cockpit ? children : null);

  if (cockpit) {
    return null;
  }

  return children;
}

/**
 * Focused screens send their sheet content here. The tab bar stays outside the sheet.
 * Pass active=false to leave the current sheet alone, which the creation flow does
 * so the overview underneath is not cleared.
 */
export function useCockpitBody(node: ReactNode, active = true) {
  const cockpit = useContext(CockpitContext);
  const focused = useIsFocused();
  const nodeRef = useRef(node);
  nodeRef.current = node;

  useLayoutEffect(() => {
    if (!cockpit || !focused || !active) {
      return;
    }

    publishBody(nodeRef.current);
  });
}

/**
 * Focused creation screens fill the sheet above the cockpit instead of replacing it.
 * Null leaves the current sheet alone so a loading hand-off cannot wipe the form.
 * The path is recorded so a leftover screen cannot fill the next route's sheet.
 */
export function useCreationBody(node: ReactNode) {
  const cockpit = useContext(CockpitContext);
  const focused = useIsFocused();
  const path = usePathname();
  const nodeRef = useRef(node);
  nodeRef.current = node;

  useLayoutEffect(() => {
    if (!cockpit || !focused || nodeRef.current == null) {
      return;
    }

    publishCreation(nodeRef.current, path);
  });
}

export function creationPublishedNow(): { node: ReactNode; path: string | null } {
  return { node: creationRef.current, path: creationPath };
}

/** Re-render when a creation screen first publishes, not on every content tweak. */
export function useCreationAvailability() {
  const [, bump] = useState(0);

  useEffect(() => {
    const listener = () => bump((value) => value + 1);
    creationAvailabilityListeners.add(listener);
    return () => {
      creationAvailabilityListeners.delete(listener);
    };
  }, []);
}

export function CockpitProvider({
  children,
  publish,
  actionsRef,
  detent,
}: {
  children: ReactNode;
  publish: (score: PublishedScore) => void;
  actionsRef: RefObject<CockpitAction[]>;
  detent: number;
}) {
  const value = { publish, actionsRef, detent };

  return <CockpitContext.Provider value={value}>{children}</CockpitContext.Provider>;
}

export function useCockpit(): Controller | null {
  return useContext(CockpitContext);
}

export function sceneSignature(score: {
  wash: string;
  paint: Accent;
  kicker: string;
  amount: string;
  caption: string;
  note?: string | null;
  metrics?: Array<{ label: string; value: string }>;
  series?: CockpitPoint[] | null;
  actionLabels: string[];
}): string {
  const metrics = (score.metrics ?? []).map((metric) => `${metric.label}:${metric.value}`).join('|');
  const last = score.series && score.series.length > 0 ? score.series[score.series.length - 1].amount_minor : 0;

  return [
    score.wash,
    score.paint.from,
    score.paint.to,
    score.paint.mid,
    score.kicker,
    score.amount,
    score.caption,
    score.note ?? '',
    metrics,
    score.actionLabels.join('|'),
    String(score.series?.length ?? 0),
    String(last),
  ].join('\u001f');
}

/** The focused cockpit screen publishes the hero. Other mounted tabs do not. */
export function useCockpitPublish(props: {
  wash: PublishedScore['wash'];
  paint: Accent;
  kicker: string;
  amount: string;
  caption: string;
  metrics?: Array<{ label: string; value: string }>;
  series?: CockpitPoint[] | null;
  note?: string | null;
  actions?: CockpitAction[];
}) {
  const cockpit = useContext(CockpitContext);
  const path = usePathname();
  const focused = useIsFocused();
  const actions = props.actions ?? [];

  if (cockpit && focused) {
    cockpit.actionsRef.current = actions;
  }

  const actionLabels = actions.map((action) => action.label);
  const signature = sceneSignature({
    wash: props.wash,
    paint: props.paint,
    kicker: props.kicker,
    amount: props.amount,
    caption: props.caption,
    note: props.note,
    metrics: props.metrics,
    series: props.series,
    actionLabels,
  });

  const publish = useCallback(() => {
    cockpit?.publish({
      path,
      wash: props.wash,
      paint: props.paint,
      kicker: props.kicker,
      amount: props.amount,
      caption: props.caption,
      metrics: props.metrics ?? [],
      series: props.series ?? null,
      note: props.note ?? null,
      actionLabels,
      actionIcons: actions.map((action) => action.icon),
    });
  }, [cockpit, path, signature]);

  useFocusEffect(useCallback(() => {
    publish();
  }, [publish]));
}
