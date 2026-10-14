/**
 * Navigation between top-level experiences (navigation.md, sections 8 and 9).
 *
 * Expo Router owns route state. This module turns one intent into router calls,
 * waits for the (app) stack's native onFinishTransitioning between them, and
 * drops a second intent while one is running. It keeps no copy of the stack.
 *
 * Nothing here imports expo-router, so the planner runs under tsx --test.
 * The (app) layout attaches the real router and the native callbacks.
 */

export type MainTab = 'home' | 'sell' | 'freelance' | 'build' | 'recover';
export type CreationKind = 'sell' | 'sell-listed' | 'freelance' | 'recover' | 'build';

export type Intent =
  | { type: 'startCreation'; kind: CreationKind }
  | { type: 'resumeCreation'; kind: 'sell'; itemId: number }
  /** `itemId` is a Sell item id, never an opportunity id. */
  | { type: 'openProduct'; itemId: number; origin?: MainTab }
  /** A Sell mission with a known item opens that item's Product Detail instead (T6). */
  | { type: 'openMission'; missionId: number; sellItemId?: number | null; origin?: MainTab }
  | { type: 'finishCreation'; feedback?: string }
  | { type: 'closeExperience' }
  /** Profile, Progress or All activity from a tab (Stage 5). Not for moving between pages inside the (secondary) group. */
  | { type: 'openSecondary'; href: string }
  /** Closes the open experience, lands on `tab`, and optionally hands it a `start` param once the dismissal is done (Stage 5). */
  | { type: 'openTab'; tab: MainTab; start?: string };

export type NavSnapshot = {
  /** The tab selected under any top-level experience. */
  tabUnderneath: MainTab | null;
  /** The (app) route above the tabs, if any, with the origin it was opened from and its `id` param (a product or setup id). */
  topLevel: { route: string; origin: MainTab | null; id: string | null } | null;
  /** An earlier intent is still waiting for its native transition. */
  pending: boolean;
  /** iOS reports onFinishTransitioning. Elsewhere steps run back to back. */
  nativeSettle: boolean;
};

export type Step =
  | { op: 'push'; href: string }
  | { op: 'back' }
  | { op: 'dismissTo'; href: string }
  /** On the focused route, so only after a settle that has made the intended tab focused. */
  | { op: 'setParams'; params: Record<string, string> }
  /** Wait for the (app) stack to finish, then check that `top` is the route on top. */
  | { op: 'awaitNativeSettle'; top: string }
  | { op: 'toast'; message: string }
  | { op: 'ignore'; reason: string };

export const TABS_ROUTE = '(tabs)';
export const SELL_CREATION_ROUTE = 'create/sell';
export const PRODUCT_ROUTE = 'product/[id]';
/** Missions open inside the (secondary) group, which is one native modal for every secondary page. */
export const SECONDARY_ROUTE = '(secondary)';

const TAB_ROUTES: Record<string, MainTab> = {
  index: 'home',
  sell: 'sell',
  freelance: 'freelance',
  build: 'build',
  recover: 'recover',
};

const TAB_HREFS: Record<MainTab, string> = {
  home: '/',
  sell: '/sell',
  freelance: '/freelance',
  build: '/build',
  recover: '/recover',
};

export function parseTab(value: unknown): MainTab | null {
  if (typeof value !== 'string') {
    return null;
  }

  return value in TAB_HREFS ? (value as MainTab) : null;
}

export function tabHref(tab: MainTab): string {
  return TAB_HREFS[tab];
}

/** Every creation session is one (app) route. Sell's is a group with its own steps, the others are one screen. */
const CREATION_CATEGORY: Record<string, MainTab> = {
  'create/sell': 'sell',
  'create/freelance': 'freelance',
  'create/recover': 'recover',
  'create/build': 'build',
};

export function isCreationRoute(route: string | undefined): boolean {
  return route != null && route in CREATION_CATEGORY;
}

function creationRoute(kind: CreationKind): string {
  return kind === 'sell-listed' ? SELL_CREATION_ROUTE : `create/${kind}`;
}

/** Where an experience returns when it was opened without an origin, such as a cold link. */
function categoryTab(route: string): MainTab | null {
  if (route === PRODUCT_ROUTE) {
    return 'sell';
  }

  return CREATION_CATEGORY[route] ?? null;
}

function creationHref(intent: Extract<Intent, { type: 'startCreation' | 'resumeCreation' }>, origin: MainTab): string {
  if (intent.type === 'resumeCreation') {
    return `/create/sell/setup/${intent.itemId}?origin=${origin}`;
  }

  if (intent.kind === 'sell' || intent.kind === 'sell-listed') {
    const page = intent.kind === 'sell-listed' ? 'listed' : 'new';

    return `/create/sell/${page}?origin=${origin}`;
  }

  return `/create/${intent.kind}?origin=${origin}`;
}

function productHref(itemId: number, origin: MainTab): string {
  return `/product/${itemId}?origin=${origin}`;
}

function missionHref(missionId: number, origin: MainTab): string {
  return `/opportunities/${missionId}?origin=${origin}`;
}

function settled(now: NavSnapshot, top: string, steps: Step[]): Step[] {
  if (!now.nativeSettle) {
    return steps;
  }

  return [...steps, { op: 'awaitNativeSettle', top }];
}

/**
 * Opening a detail. One push when nothing is open. Otherwise the open experience closes first and the
 * detail is presented once UIKit has finished, because a top-level modal is never replaced by another.
 * Creation is never closed here: its X owns the save-or-discard decision.
 */
function planDetail(now: NavSnapshot, intent: Extract<Intent, { type: 'openProduct' | 'openMission' }>): Step[] {
  const sellItemId = intent.type === 'openProduct' ? intent.itemId : intent.sellItemId;
  const product = sellItemId != null;
  const route = product ? PRODUCT_ROUTE : SECONDARY_ROUTE;

  if (isCreationRoute(now.topLevel?.route)) {
    return [{ op: 'ignore', reason: 'creation-open' }];
  }

  if (product && now.topLevel?.route === PRODUCT_ROUTE && now.topLevel.id === String(sellItemId)) {
    return [{ op: 'ignore', reason: 'already-open' }];
  }

  // Read now, while the experience that started this is still in route state.
  const origin = intent.origin ?? now.topLevel?.origin ?? now.tabUnderneath ?? (product ? 'sell' : 'home');
  const href = product ? productHref(sellItemId, origin) : missionHref(intent.type === 'openMission' ? intent.missionId : 0, origin);
  const present = settled(now, route, [{ op: 'push', href }]);

  if (!now.topLevel) {
    return present;
  }

  return [...settled(now, TABS_ROUTE, [{ op: 'back' }]), ...present];
}

/**
 * Profile, Progress and All activity share one (secondary) modal. From a tab it is one push. Another top-level
 * page open means close it, wait, then push. Pages inside the group are the group's own pushes, never this intent.
 */
function planSecondary(now: NavSnapshot, intent: Extract<Intent, { type: 'openSecondary' }>): Step[] {
  if (isCreationRoute(now.topLevel?.route)) {
    return [{ op: 'ignore', reason: 'creation-open' }];
  }

  if (now.topLevel?.route === SECONDARY_ROUTE) {
    return [{ op: 'ignore', reason: 'secondary-open' }];
  }

  const present = settled(now, SECONDARY_ROUTE, [{ op: 'push', href: intent.href }]);

  if (!now.topLevel) {
    return present;
  }

  return [...settled(now, TABS_ROUTE, [{ op: 'back' }]), ...present];
}

/**
 * Leaves the open experience for a tab. One `dismissTo` removes the modal and selects the tab in one update.
 * A `start` param is set only after UIKit has finished dismissing, because what it opens (a sheet) must not
 * present while the modal is still leaving. It is `setParams` and not a push: pushing the tab's own index would add
 * a second copy of it when that tab is already selected. Callers own any unsaved input in the experience they leave.
 */
function planTab(now: NavSnapshot, intent: Extract<Intent, { type: 'openTab' }>): Step[] {
  if (!now.topLevel) {
    return [{ op: 'ignore', reason: 'nothing-open' }];
  }

  const href = tabHref(intent.tab);

  // Without native waits nothing can race, so the param rides on the dismissal itself.
  if (!now.nativeSettle) {
    return [{ op: 'dismissTo', href: intent.start ? `${href}?start=${encodeURIComponent(intent.start)}` : href }];
  }

  const steps = settled(now, TABS_ROUTE, [{ op: 'dismissTo', href }]);

  if (intent.start) {
    steps.push({ op: 'setParams', params: { start: intent.start } });
  }

  return steps;
}

/**
 * Pure. Every plan changes the (app) stack one modal at a time: a close, or a
 * push. It never replaces one top-level modal with another, because that loses
 * or orphans a native controller (navigation.md, E3).
 */
export function planTransition(now: NavSnapshot, intent: Intent): Step[] {
  if (now.pending) {
    return [{ op: 'ignore', reason: 'pending' }];
  }

  if (intent.type === 'startCreation' || intent.type === 'resumeCreation') {
    if (isCreationRoute(now.topLevel?.route)) {
      return [{ op: 'ignore', reason: 'creation-open' }];
    }

    const route = creationRoute(intent.type === 'resumeCreation' ? 'sell' : intent.kind);
    // Read now, while the experience that started this is still in route state.
    const origin = now.topLevel?.origin ?? now.tabUnderneath ?? CREATION_CATEGORY[route];
    const present = settled(now, route, [{ op: 'push', href: creationHref(intent, origin) }]);

    if (!now.topLevel) {
      return present;
    }

    // Product Detail or a secondary page is open: close it, wait until it is gone, then present (T1).
    return [...settled(now, TABS_ROUTE, [{ op: 'back' }]), ...present];
  }

  if (intent.type === 'openProduct' || intent.type === 'openMission') {
    return planDetail(now, intent);
  }

  if (intent.type === 'openSecondary') {
    return planSecondary(now, intent);
  }

  if (intent.type === 'openTab') {
    return planTab(now, intent);
  }

  if (!now.topLevel) {
    return [{ op: 'ignore', reason: 'nothing-open' }];
  }

  const origin = now.topLevel.origin ?? categoryTab(now.topLevel.route) ?? now.tabUnderneath;
  // On iOS the tab bar is hidden under the modal, so the tab underneath is
  // normally the origin. They differ after a cold link.
  const close: Step = origin == null || origin === now.tabUnderneath ? { op: 'back' } : { op: 'dismissTo', href: tabHref(origin) };
  const steps = settled(now, TABS_ROUTE, [close]);

  if (intent.type === 'finishCreation' && intent.feedback) {
    steps.push({ op: 'toast', message: intent.feedback });
  }

  return steps;
}

type NavRoute = { name: string; key?: string; params?: Record<string, unknown>; state?: NavState };
type NavState = { key?: string; index?: number; routes?: NavRoute[] };

// Expo Router mounts the root layout as the container's one `__root` route (ExpoRoot.js), so (app) is a level down.
function appState(root: unknown): NavState | null {
  const containerRoutes = (root as NavState | undefined)?.routes ?? [];
  const rootLayout = containerRoutes.find((route) => route.name === '__root')?.state;
  const layoutRoutes = rootLayout?.routes ?? [];

  return layoutRoutes.find((route) => route.name === '(app)')?.state ?? null;
}

function focusedRoute(state: NavState | null | undefined): NavRoute | null {
  const routes = state?.routes ?? [];

  return routes[state?.index ?? routes.length - 1] ?? null;
}

/**
 * GO_BACK aimed at the (app) navigator. An untargeted `router.back()` goes to the deepest focused navigator first,
 * so inside the (secondary) group it would pop one page instead of removing the modal (navigation.md, Stage 5).
 * The coordinator's `back` always means "remove the top-level (app) route", so it names its navigator.
 * Null before the (app) stack exists.
 */
export function appBackAction(root: unknown): { type: 'GO_BACK'; target: string } | null {
  const key = appState(root)?.key;

  return typeof key === 'string' ? { type: 'GO_BACK', target: key } : null;
}

/** The (app) route that is on top, or null before the (app) stack exists. */
export function appTop(root: unknown): string | null {
  return focusedRoute(appState(root))?.name ?? null;
}

/** Identity of the (app) route list. It changes on every present and dismiss, and on nothing else. */
export function appRouteKeys(root: unknown): string | null {
  const state = appState(root);

  if (!state?.routes) {
    return null;
  }

  return state.routes.map((route) => route.key ?? route.name).join(',');
}

/** A param on the route or on the page focused inside it. Before the nested state exists, params nest as `params.params`. */
function routeParam(route: NavRoute | null, key: string): unknown {
  if (!route) {
    return undefined;
  }

  const own = route.params?.[key];

  if (own !== undefined) {
    return own;
  }

  const nested = routeParam(focusedRoute(route.state), key);

  if (nested !== undefined) {
    return nested;
  }

  const pending = route.params?.params;

  return pending && typeof pending === 'object' ? routeParam({ name: '', params: pending as Record<string, unknown> }, key) : undefined;
}

export function readSnapshot(root: unknown, pending: boolean, nativeSettle: boolean): NavSnapshot {
  const app = appState(root);
  const top = focusedRoute(app);
  const tabs = app?.routes?.find((route) => route.name === TABS_ROUTE) ?? null;
  const selected = focusedRoute(tabs?.state)?.name ?? tabs?.params?.screen;
  const tabUnderneath = typeof selected === 'string' ? TAB_ROUTES[selected] ?? null : null;
  const id = top ? routeParam(top, 'id') : undefined;
  const topLevel = top && top.name !== TABS_ROUTE
    ? { route: top.name, origin: parseTab(routeParam(top, 'origin')), id: typeof id === 'string' || typeof id === 'number' ? String(id) : null }
    : null;

  return { tabUnderneath, topLevel, pending, nativeSettle };
}

export type NavFields = Record<string, string | number | boolean | null | undefined>;

export type NavigatorDeps = {
  getRootState: () => unknown;
  back: () => void;
  push: (href: string) => void;
  dismissTo: (href: string) => void;
  setParams: (params: Record<string, string>) => void;
  notify: (message: string) => void;
  log: (event: string, fields?: NavFields) => void;
  nativeSettle: boolean;
};

function describe(intent: Intent): NavFields {
  if (intent.type === 'startCreation') {
    return { kind: intent.kind };
  }

  if (intent.type === 'resumeCreation') {
    return { kind: intent.kind, id: intent.itemId };
  }

  if (intent.type === 'openProduct') {
    return { id: intent.itemId, origin: intent.origin };
  }

  if (intent.type === 'openMission') {
    return { id: intent.missionId, sellItemId: intent.sellItemId, origin: intent.origin };
  }

  if (intent.type === 'openSecondary') {
    return { href: intent.href };
  }

  if (intent.type === 'openTab') {
    return { tab: intent.tab, start: intent.start };
  }

  return {};
}

export function createNavigator() {
  let deps: NavigatorDeps | null = null;
  // Our own plan, parked until the (app) stack reports that its transition finished.
  let waiting: { top: string; rest: Step[] } | null = null;
  // The (app) route list changed outside a plan (a Close, a card tap) and UIKit is still animating it.
  let busy = false;
  // One intent that arrived while busy. It runs once that transition finishes.
  let deferred: Intent | null = null;
  let lastKeys: string | null = null;

  function snapshot(current: NavigatorDeps): NavSnapshot {
    return readSnapshot(current.getRootState(), waiting != null, current.nativeSettle);
  }

  // A changed (app) route list means UIKit is animating a present or dismiss until the next finish.
  function noteKeys(current: NavigatorDeps) {
    if (!current.nativeSettle) {
      return;
    }

    const keys = appRouteKeys(current.getRootState());

    if (keys == null) {
      return;
    }

    if (lastKeys != null && keys !== lastKeys) {
      busy = true;
    }

    lastKeys = keys;
  }

  function run(current: NavigatorDeps, steps: Step[]) {
    for (let at = 0; at < steps.length; at += 1) {
      const step = steps[at];

      if (step.op === 'ignore') {
        current.log('intent.ignored', { reason: step.reason });
        return;
      }

      if (step.op === 'back') {
        current.log('transition.dismiss.request');
        current.back();
      } else if (step.op === 'dismissTo') {
        current.log('transition.dismiss.request', { to: step.href });
        current.dismissTo(step.href);
      } else if (step.op === 'push') {
        current.log('transition.present.request', { href: step.href });
        current.push(step.href);
      } else if (step.op === 'setParams') {
        current.log('transition.setParams', step.params);
        current.setParams(step.params);
      } else if (step.op === 'toast') {
        current.notify(step.message);
      } else {
        waiting = { top: step.top, rest: steps.slice(at + 1) };
        return;
      }
    }
  }

  function go(intent: Intent) {
    const current = deps;

    if (!current) {
      return;
    }

    current.log(`intent.${intent.type}`, describe(intent));
    // A screen's mount effect runs before the container reports the state that mounted it.
    noteKeys(current);

    if (busy && waiting == null) {
      if (deferred) {
        current.log('intent.ignored', { reason: 'pending' });
        return;
      }

      deferred = intent;
      current.log('intent.deferred', { until: 'native.app.finishTransitioning' });
      return;
    }

    run(current, planTransition(snapshot(current), intent));
  }

  return {
    /** The (app) layout passes the real router. Returns a detach function. */
    attach(next: NavigatorDeps) {
      deps = next;
      lastKeys = appRouteKeys(next.getRootState());

      return () => {
        if (deps === next) {
          deps = null;
        }
      };
    },

    /** Call on every navigation container state change. */
    stateChanged() {
      if (deps) {
        noteKeys(deps);
      }
    },

    /** The (app) stack's onFinishTransitioning. */
    nativeSettled() {
      const current = deps;

      if (!current) {
        return;
      }

      busy = false;

      if (waiting) {
        const expected = waiting.top;
        const actual = appTop(current.getRootState());
        const rest = waiting.rest;
        waiting = null;

        // Something else changed the stack meanwhile. Presenting now would stack on top of it.
        if (actual !== expected) {
          current.log('transition.aborted', { expected, actual });
          return;
        }

        if (expected === TABS_ROUTE) {
          current.log('transition.dismiss.finished');
        } else if (isCreationRoute(expected)) {
          current.log('creation.presented', { top: actual });
        } else {
          current.log('detail.presented', { top: actual });
        }

        run(current, rest);
        return;
      }

      if (deferred) {
        const intent = deferred;
        deferred = null;
        current.log('intent.resumed', { type: intent.type });
        run(current, planTransition(snapshot(current), intent));
      }
    },

    go,

    startCreation(kind: CreationKind = 'sell') {
      go({ type: 'startCreation', kind });
    },

    resumeCreation(kind: 'sell', itemId: number) {
      go({ type: 'resumeCreation', kind, itemId });
    },

    /** Closes the creation flow to its origin tab. The feedback toast shows once it has gone. */
    finishCreation(feedback?: string) {
      go({ type: 'finishCreation', feedback });
    },

    closeExperience() {
      go({ type: 'closeExperience' });
    },

    /** Profile, Progress or All activity, from outside the (secondary) group. */
    openSecondary(href: string) {
      go({ type: 'openSecondary', href });
    },

    /** Closes the open experience and lands on a tab. `start` is read by that tab (for example `message` on Freelance). */
    openTab(tab: MainTab, start?: string) {
      go({ type: 'openTab', tab, start });
    },

    /** Product Detail for a Sell item. The id is the item's own id. */
    openProduct(itemId: number, origin?: MainTab) {
      go({ type: 'openProduct', itemId, origin });
    },

    /** Generic mission detail. Pass `sellItemId` when the API names one, and Product Detail opens instead. */
    openMission(missionId: number, options: { sellItemId?: number | null; origin?: MainTab } = {}) {
      go({ type: 'openMission', missionId, sellItemId: options.sellItemId, origin: options.origin });
    },
  };
}

export const navigation = createNavigator();
