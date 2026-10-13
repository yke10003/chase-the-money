import { unstable_navigationEvents, useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

/**
 * Dev-only navigation diagnostics. One `[nav +NNNNNms] event key=value` line per event.
 *
 * `route.*` lines come from Expo Router state. `native.*` lines come from
 * react-native-screens callbacks. A focused route does not mean UIKit has
 * finished presenting it, so the two are never merged into one event.
 *
 * Nothing here navigates or writes app state.
 */

const startedAt = performance.now();
const inflight = new Set<string>();
let started = false;
let lastFinishAt: number | null = null;
let lastSummary = '';
let lastTab: string | null = null;
let lastTop: string | null = null;

type Fields = Record<string, string | number | boolean | null | undefined>;

function elapsed(): number {
  return Math.round(performance.now() - startedAt);
}

export function navLog(event: string, fields: Fields = {}) {
  if (!__DEV__) {
    return;
  }

  const parts: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    parts.push(`${key}=${value}`);
  }

  const time = String(elapsed()).padStart(5, '0');
  const tail = parts.length > 0 ? ` ${parts.join(' ')}` : '';
  console.log(`[nav +${time}ms] ${event}${tail}`);
}

/**
 * A user-initiated navigation request. Adds the tab and top-level route from the
 * last route state, the native transitions that started without a matching end,
 * and the time since the (app) stack last reported onFinishTransitioning.
 */
export function navRequest(event: string, fields: Fields = {}) {
  if (!__DEV__) {
    return;
  }

  const sinceFinish = lastFinishAt == null ? 'never' : `${Math.round(performance.now() - lastFinishAt)}ms`;

  navLog(event, {
    ...fields,
    tab: lastTab,
    top: lastTop ?? 'none',
    inflight: inflight.size > 0 ? [...inflight].join(',') : 'none',
    sinceFinish,
  });
}

/** Call once at module scope in the root layout, before any route renders. */
export function startNavLog() {
  // Fast refresh re-runs the root layout module. Listeners must not stack up.
  if (!__DEV__ || started) {
    return;
  }

  started = true;
  unstable_navigationEvents.enable();
  unstable_navigationEvents.addListener('actionDispatched', (event) => {
    navLog('route.action', { type: event.actionType, ...describePayload(event.payload) });
  });
  unstable_navigationEvents.addListener('pageFocused', (event) => {
    navLog('route.focus', { path: event.pathname, screen: event.screenId });
  });
  unstable_navigationEvents.addListener('pageBlurred', (event) => {
    navLog('route.blur', { path: event.pathname, screen: event.screenId });
  });
  unstable_navigationEvents.addListener('pageRemoved', (event) => {
    navLog('route.removed', { path: event.pathname, screen: event.screenId });
  });
  navLog('nav-log.start');
}

/** Logs the route state after each change, only when the summary differs. */
export function useRouteStateLog() {
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (!__DEV__) {
      return;
    }

    return ref.addListener('state', (event) => {
      const state = (event.data as { state?: NavNode } | undefined)?.state;
      const summary = summarize(state);

      if (summary.line === lastSummary) {
        return;
      }

      lastSummary = summary.line;
      lastTab = summary.tab;
      lastTop = summary.top;
      navLog('route.state', { app: summary.app, tab: summary.tab, [summary.tab ?? 'area']: summary.area });

      if (summary.tabsRoutes > 1) {
        navLog('route.warn.duplicate-tabs', { count: summary.tabsRoutes });
      }

      // Each top-level experience is one native modal over the cockpit. Two at
      // once means a later Close or tab switch has to remove both (navigation.md, E3).
      if (summary.topLevelRoutes > 1) {
        navLog('route.warn.stacked-top-level', { app: summary.app });
      }
    });
  }, [ref]);
}

/** `transitionStart` / `transitionEnd` on (app) routes, named after the native callbacks behind them. */
export function appScreenListeners({ route }: { route: { name: string; key: string } }) {
  return {
    transitionStart: (event: { data: { closing: boolean } }) => {
      const phase = event.data.closing ? 'willDisappear' : 'willAppear';
      inflight.add(`app:${route.name}`);
      navLog(`native.app.${phase}`, { route: route.name, key: shortKey(route.key) });
    },
    transitionEnd: (event: { data: { closing: boolean } }) => {
      const phase = event.data.closing ? 'didDisappear' : 'didAppear';
      inflight.delete(`app:${route.name}`);
      navLog(`native.app.${phase}`, { route: route.name, key: shortKey(route.key) });
    },
    gestureCancel: () => {
      navLog('native.app.gestureCancel', { route: route.name, key: shortKey(route.key) });
    },
  };
}

export function appFinishTransitioning() {
  lastFinishAt = performance.now();
  navLog('native.app.finishTransitioning');
}

/** Appearance callbacks for a raw react-native-screens Screen. Spread only in dev. */
export function screenLifecycleLog(screenId: string) {
  return {
    onWillAppear: () => {
      inflight.add(screenId);
      navLog(`native.${screenId}.willAppear`);
    },
    onAppear: () => {
      inflight.delete(screenId);
      navLog(`native.${screenId}.didAppear`);
    },
    onWillDisappear: () => {
      inflight.add(screenId);
      navLog(`native.${screenId}.willDisappear`);
    },
    onDisappear: () => {
      inflight.delete(screenId);
      navLog(`native.${screenId}.didDisappear`);
    },
  };
}

type NavNode = {
  index?: number;
  routes?: { name: string; key?: string; params?: object; state?: NavNode }[];
};

function shortKey(key: string): string {
  const dash = key.lastIndexOf('-');

  return dash === -1 ? key : key.slice(dash + 1, dash + 6);
}

function routeLabel(route: { name: string; params?: object }): string {
  const id = (route.params as { id?: unknown } | undefined)?.id;

  return typeof id === 'string' || typeof id === 'number' ? `${route.name}:${id}` : route.name;
}

function findRoute(node: NavNode | undefined, name: string): { state?: NavNode } | null {
  for (const route of node?.routes ?? []) {
    if (route.name === name) {
      return route;
    }

    const nested = findRoute(route.state, name);

    if (nested) {
      return nested;
    }
  }

  return null;
}

function summarize(root: NavNode | undefined) {
  const app = findRoute(root, '(app)')?.state;
  const appRoutes = app?.routes ?? [];
  const appFocused = appRoutes[app?.index ?? appRoutes.length - 1];
  const tabsRoute = appRoutes.find((route) => route.name === '(tabs)');
  const tabs = tabsRoute?.state;
  const tabRoute = tabs?.routes?.[tabs.index ?? 0];
  const tabStack = tabRoute?.state?.routes ?? [];
  const appLine = appRoutes.map((route) => {
    const inner = route.name === '(tabs)' ? [] : (route.state?.routes ?? []).map(routeLabel);

    return inner.length > 0 ? `${routeLabel(route)}(${inner.join('>')})` : routeLabel(route);
  }).join('>');
  const area = tabStack.map(routeLabel).join('>');
  const focusedInner = appFocused?.state?.routes?.[appFocused.state.index ?? appFocused.state.routes.length - 1];
  const topRoute = focusedInner ?? appFocused;
  const top = appFocused && appFocused.name !== '(tabs)' && topRoute ? routeLabel(topRoute) : null;
  const tab = tabRoute?.name ?? null;
  const tabsRoutes = appRoutes.filter((route) => route.name === '(tabs)').length;
  const topLevelRoutes = appRoutes.filter((route) => route.name !== '(tabs)').length;

  return {
    app: appLine || 'none',
    top,
    tab,
    area: area || null,
    tabsRoutes,
    topLevelRoutes,
    line: `${appLine}|${tab}|${area}`,
  };
}

function describePayload(payload: unknown): Fields {
  if (payload == null || typeof payload !== 'object') {
    return {};
  }

  const names: string[] = [];
  let node: Record<string, unknown> | undefined = payload as Record<string, unknown>;
  let leaf: Record<string, unknown> | undefined;

  for (let depth = 0; node && depth < 8; depth += 1) {
    const name = typeof node.name === 'string' ? node.name : typeof node.screen === 'string' ? node.screen : null;

    if (name) {
      names.push(name);
    }

    leaf = node;
    node = node.params && typeof node.params === 'object' ? node.params as Record<string, unknown> : undefined;
  }

  const id = leaf && (typeof leaf.id === 'string' || typeof leaf.id === 'number') ? leaf.id : undefined;
  const count = (payload as { count?: unknown }).count;

  return {
    to: names.length > 0 ? names.join('/') : undefined,
    id,
    count: typeof count === 'number' ? count : undefined,
  };
}
