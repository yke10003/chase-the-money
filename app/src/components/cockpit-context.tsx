import { useFocusEffect, useIsFocused, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

import type { IconName } from '@/components/icon';
import type { Accent } from '@/design/palette';

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

function publishBody(node: ReactNode) {
  bodyRef.current = node;
  bodyListeners.forEach((listener) => listener());
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

/** Page content for the one sheet. Outside the iOS cockpit it renders in place. */
export function CockpitPage({ children }: { children: ReactNode }) {
  const cockpit = useContext(CockpitContext);
  useCockpitBody(cockpit ? children : null);

  if (cockpit) {
    return null;
  }

  return children;
}

/** Focused screens send their sheet content here. The tab bar stays outside the sheet. */
export function useCockpitBody(node: ReactNode) {
  const cockpit = useContext(CockpitContext);
  const focused = useIsFocused();
  const nodeRef = useRef(node);
  nodeRef.current = node;

  useLayoutEffect(() => {
    if (!cockpit || !focused) {
      return;
    }

    publishBody(nodeRef.current);
  });
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
