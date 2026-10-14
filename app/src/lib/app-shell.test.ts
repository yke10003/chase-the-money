import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { appWrapper, secondaryPresentation } from './app-shell';
import { cockpitArea, shellPath } from './cockpit-scene';
import { photosSheetGestureEnabled, photosStackGestures } from './photos-nav';
import { appBackAction, appRouteKeys, createNavigator, planTransition, readSnapshot, type Step } from './navigation';

// The router tests drive Expo Router's own path parsing, target selection and
// stack router against the real files under src/app.
const load = createRequire(import.meta.url);
// The fork only uses validatePathConfig from here; the real module pulls in react-native.
load.cache[load.resolve('expo-router/build/react-navigation/native')] = { exports: { validatePathConfig: () => {} } } as never;
// Redirects only call expo-linking for external destinations.
load.cache[load.resolve('expo-linking')] = { exports: { openURL: () => {} } } as never;
const { getRoutes } = load('expo-router/build/getRoutesCore.js');
const { getReactNavigationConfig, parseRouteSegments } = load('expo-router/build/getReactNavigationConfig.js');
const { getStateFromPath } = load('expo-router/build/fork/getStateFromPath.js');
const { routePatternToRegex } = load('expo-router/build/fork/getStateFromPath-forks.js');
const { applyRedirects } = load('expo-router/build/getRoutesRedirects.js');
const { findDivergentState, getPayloadFromStateRoute } = load('expo-router/build/global-state/stateUtils.js');
const { StackRouter } = load('expo-router/build/react-navigation/routers/StackRouter.js');
const { INTERNAL_SLOT_NAME } = load('expo-router/build/constants.js');

type Route = { key: string; name: string; params?: Record<string, unknown>; state?: Nav };
type Nav = { key: string; type: string; index: number; routes: Route[]; routeNames?: string[]; preloadedRoutes?: Route[] };
type PartialRoute = { name: string; params?: Record<string, unknown>; state?: { routes: PartialRoute[] } };

const appDir = fileURLToPath(new URL('../app', import.meta.url));

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);

    if (statSync(full).isDirectory()) {
      return routeFiles(full);
    }

    return /\.tsx?$/.test(name) ? [`./${relative(appDir, full)}`] : [];
  });
}

type Redirect = { source: string; destination: string };

// The expo-router plugin options in app.json, which the app reads back as expoConfig.extra.router.
const appJson = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
const routerPlugin = (appJson.expo.plugins as unknown[]).find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-router') as [string, { redirects: Redirect[] }] | undefined;
const redirects: Redirect[] = routerPlugin?.[1].redirects ?? [];

function buildRoutes(extra: Record<string, unknown> = {}) {
  const files = routeFiles(appDir);
  const modules: Record<string, Record<string, unknown>> = {};

  for (const file of files) {
    const source = readFileSync(join(appDir, file), 'utf8');
    const anchor = source.match(/unstable_settings\s*=\s*\{[^}]*anchor:\s*'([^']+)'/)?.[1];
    modules[file] = anchor ? { default: () => null, unstable_settings: { anchor } } : { default: () => null };
  }

  const context = Object.assign((key: string) => modules[key], { keys: () => files, resolve: (key: string) => key, id: 'app' });
  const tree = getRoutes(context, { platform: 'ios', ignoreEntryPoints: true, ...extra });

  return { tree, config: getReactNavigationConfig(tree, true) };
}

const { tree, config } = buildRoutes();
// What the app links with: getNavigationConfig (getLinkingConfig.js) nests the route config under `__root`.
const linkingConfig = { screens: { [INTERNAL_SLOT_NAME]: { path: '', ...config } } };

function childNames(node: { route: string; children: unknown[] }, name: string): string[] {
  const found = (node.children as { route: string; children: unknown[] }[]).find((child) => child.route === name);

  return (found?.children as { route: string }[] | undefined)?.map((child) => child.route) ?? [];
}

const appNode = tree.children.find((child: { route: string }) => child.route === '(app)');
const appRouteNames = childNames(tree, '(app)');
const secondaryRouteNames = childNames(appNode, '(secondary)');
const creationRouteNames = childNames(appNode, 'create/sell');
const tabsNode = appNode.children.find((child: { route: string }) => child.route === '(tabs)');
const sellTabRouteNames = childNames(tabsNode, 'sell');

function parse(path: string): PartialRoute[] {
  const state = getStateFromPath(path, config);
  const app = state.routes.find((route: PartialRoute) => route.name === '(app)');

  return app?.state?.routes ?? [];
}

const appRouter = StackRouter({});
const secondaryRouter = StackRouter({});
const creationRouter = StackRouter({});
const options = (routeNames: string[]) => ({ routeNames, routeParamList: {}, routeGetIdList: {} });

/** The live state on iOS phone: the cockpit tabs (on Sell unless told otherwise), and whatever sits above them. */
type Tab = 'index' | 'sell' | 'freelance' | 'build' | 'recover';
const TAB_NAMES: Tab[] = ['index', 'sell', 'freelance', 'build', 'recover'];

function liveRoot(above: Route[] = [], tab: Tab = 'sell'): Nav {
  const tabs: Route = {
    key: 'tabs-1',
    name: '(tabs)',
    state: { key: 'tab-nav', type: 'tab', index: TAB_NAMES.indexOf(tab), routes: TAB_NAMES.map((name) => ({ key: `tab-${name}`, name })) },
  };

  return withApp({ key: 'app-nav', type: 'stack', index: above.length, routes: [tabs, ...above], routeNames: appRouteNames, preloadedRoutes: [] });
}

/** The container state as ExpoRoot builds it: its one `__root` route holds the root layout, which holds (app). */
function withApp(app: Nav): Nav {
  const rootLayout: Nav = { key: 'root-nav', type: 'stack', index: 0, routes: [{ key: 'app-1', name: '(app)', state: app }] };

  return { key: 'container-nav', type: 'stack', index: 0, routes: [{ key: 'root-1', name: INTERNAL_SLOT_NAME, state: rootLayout }] };
}

function creation(page: string, params: Record<string, unknown>): Route {
  return {
    key: 'creation-1',
    name: 'create/sell',
    state: {
      key: 'creation-nav',
      type: 'stack',
      index: 0,
      routes: [{ key: 'step-0', name: page, params }],
      routeNames: creationRouteNames,
      preloadedRoutes: [],
    },
  };
}

/**
 * React Navigation's onAction, over the real routers: an action goes to the deepest focused navigator first and
 * bubbles up when that one cannot handle it. An action with a `target` is only tried by the navigator with that key
 * (useOnAction.js). Returns the new container state, or the same one when nothing changed.
 */
function dispatchFocused(root: Nav, action: { type: string; target?: string; payload?: unknown }): Nav {
  const chain: Nav[] = [root];

  for (let node = root; node.routes[node.index]?.state; ) {
    node = node.routes[node.index].state as Nav;
    chain.push(node);
  }

  function replaceAt(state: Nav, depth: number, next: Nav): Nav {
    if (depth === 0) {
      return next;
    }

    return { ...state, routes: state.routes.map((route, at) => (at === state.index ? { ...route, state: replaceAt(route.state as Nav, depth - 1, next) } : route)) };
  }

  for (let depth = chain.length - 1; depth >= 0; depth -= 1) {
    const state = chain[depth];

    if (typeof action.target === 'string' && action.target !== state.key) {
      continue;
    }

    const router = state.key === 'secondary-nav' ? secondaryRouter : state.key === 'creation-nav' ? creationRouter : appRouter;
    const names = state.key === 'app-nav' ? appRouteNames : state.key === 'secondary-nav' ? secondaryRouteNames : state.key === 'creation-nav' ? creationRouteNames : state.routes.map((route) => route.name);
    const result = router.getStateForAction(state, action, options(names));

    if (result === null) {
      if (action.target === state.key) {
        return root;
      }

      continue;
    }

    return replaceAt(root, depth, result);
  }

  return root;
}

/** The coordinator's `back`, as the (app) layout dispatches it. */
function coordinatorBack(root: Nav): Nav {
  const action = appBackAction(root);

  assert.ok(action);

  return dispatchFocused(root, action);
}

/**
 * Runs a navigation.ts plan through Expo Router's own action building and the
 * (app) StackRouter. Native waits are where UIKit would animate; here the
 * state is already final, so the wait only checks the expected top.
 */
function runPlan(root: Nav, steps: Step[]): Nav {
  let current = root;

  for (const step of steps) {
    const app = appState(current);

    if (step.op === 'back') {
      current = coordinatorBack(current);
    } else if (step.op === 'push' || step.op === 'dismissTo') {
      const { targetKey, action } = linkAction(step.href, step.op === 'push' ? 'PUSH' : 'POP_TO', current);
      assert.equal(targetKey, 'app-nav', step.href);
      current = withApp(appRouter.getStateForAction(app, action, options(appRouteNames)));
    } else if (step.op === 'setParams') {
      // On the focused tab's route, which is where router.setParams lands once the dismissal has settled.
      const tabsRoute = appState(current).routes[0];
      const tabs = tabsRoute.state as Nav;
      const selected = tabs.routes.find((route) => route.name === tabsRoute.params?.screen) ?? tabs.routes[tabs.index];

      selected.params = { ...selected.params, ...step.params };
    } else if (step.op === 'awaitNativeSettle') {
      const top = appState(current).routes[appState(current).index].name;
      assert.equal(top, step.top);
    }
  }

  return current;
}

function secondary(pages: string[]): Route {
  return {
    key: 'secondary-1',
    name: '(secondary)',
    state: {
      key: 'secondary-nav',
      type: 'stack',
      index: pages.length - 1,
      routes: pages.map((name, at) => ({ key: `page-${at}`, name })),
      routeNames: secondaryRouteNames,
      preloadedRoutes: [],
    },
  };
}

/** What router.push / navigate / dismissTo dispatch, and on which navigator (getNavigationAction.js). */
function linkAction(href: string, type: string, root: Nav) {
  const target = getStateFromPath(href, linkingConfig);
  const { actionStateRoute, navigationState } = findDivergentState(target, root);
  const payload = getPayloadFromStateRoute(actionStateRoute ?? {});

  return { targetKey: navigationState.key as string, action: { type, payload: { name: payload.screen, params: payload.params } } };
}

function appState(root: Nav): Nav {
  const rootLayout = root.routes[0].state as Nav;

  return rootLayout.routes[0].state as Nav;
}

test('the iOS phone wrapper never changes with the page, so the (app) stack is not remounted', () => {
  const paths = ['/', '/sell', '/create/sell/new', '/create/sell/listed', '/create/sell/setup/4', '/sell/items/4', '/freelance', '/recover', '/build', '/product/17', '/settings', '/progress', '/friends', '/opportunities', '/opportunities/12', '/opportunities/new', '/discover'];
  const wrappers = new Set(paths.map((pathname) => appWrapper({ os: 'ios', phone: true, pathname })));

  assert.deepEqual([...wrappers], ['NativeTabWash']);
  assert.equal(appWrapper({ os: 'ios', phone: true, pathname: '/onboarding' }), 'FocusShell');
});

test('web, Android and iPad keep the page shell', () => {
  for (const pathname of ['/', '/settings', '/opportunities/12', '/product/17']) {
    assert.equal(appWrapper({ os: 'web', phone: true, pathname }), 'AppShell');
    assert.equal(appWrapper({ os: 'android', phone: true, pathname }), 'AppShell');
    assert.equal(appWrapper({ os: 'ios', phone: false, pathname }), 'AppShell');
  }
});

test('secondary pages are a full-screen modal on iOS phone and plain pages elsewhere', () => {
  assert.deepEqual(secondaryPresentation('ios', true), { presentation: 'fullScreenModal', animation: 'slide_from_bottom' });
  assert.deepEqual(secondaryPresentation('ios', false), { presentation: 'card', animation: 'none' });
  assert.deepEqual(secondaryPresentation('web', true), { presentation: 'card', animation: 'none' });
  assert.deepEqual(secondaryPresentation('android', true), { presentation: 'card', animation: 'none' });
});

test('the hero follows the last tab, not the page on top of it', () => {
  assert.equal(shellPath('/sell', null), '/sell');
  assert.equal(shellPath('/settings', '/sell'), '/sell');
  assert.equal(shellPath('/opportunities/12', '/freelance'), '/freelance');
  assert.equal(shellPath('/product/17', '/sell'), '/sell');
  assert.equal(shellPath('/progress', null), '/');
  assert.equal(cockpitArea(shellPath('/settings', '/recover')), 'recover');
});

test('profile, progress, activity and missions open in the secondary group, with URLs unchanged', () => {
  for (const name of ['settings', 'progress', 'friends', 'opportunities/index', 'opportunities/[id]', 'opportunities/new']) {
    assert.ok(secondaryRouteNames.includes(name), name);
    assert.ok(!appRouteNames.includes(name), name);
  }

  assert.ok(appRouteNames.includes('(secondary)'));
  assert.ok(appRouteNames.includes('product/[id]'));

  const mission = parse('/opportunities/12');
  assert.deepEqual(mission.map((route) => route.name), ['(tabs)', '(secondary)']);
  assert.equal(mission[1].state?.routes[0].name, 'opportunities/[id]');
  assert.equal(mission[1].state?.routes[0].params?.id, '12');
  assert.equal(parse('/settings')[1].state?.routes[0].name, 'settings');
  assert.equal(parse('/progress')[1].state?.routes[0].name, 'progress');
});

test('opening a secondary page from a tab adds one route above the existing tabs', () => {
  const root = liveRoot();
  const { targetKey, action } = linkAction('/progress', 'PUSH', root);

  assert.equal(targetKey, 'app-nav');
  const next = appRouter.getStateForAction(appState(root), action, options(appRouteNames));

  assert.deepEqual(next.routes.map((route: Route) => route.name), ['(tabs)', '(secondary)']);
  assert.equal(next.routes[0].key, 'tabs-1');
});

test('a page opened from inside the secondary group is pushed inside it, not as a second modal', () => {
  const root = liveRoot([secondary(['progress'])]);
  const { targetKey, action } = linkAction('/opportunities', 'PUSH', root);

  assert.equal(targetKey, 'secondary-nav');
  const inner = secondaryRouter.getStateForAction(appState(root).routes[1].state, action, options(secondaryRouteNames));

  assert.deepEqual(inner.routes.map((route: Route) => route.name), ['progress', 'opportunities/index']);
});

test('Back stays inside the secondary group, Close removes exactly that group', () => {
  const root = liveRoot([secondary(['progress', 'opportunities/index'])]);
  const app = appState(root);
  const back = secondaryRouter.getStateForAction(app.routes[1].state, { type: 'GO_BACK' }, options(secondaryRouteNames));

  assert.deepEqual(back.routes.map((route: Route) => route.name), ['progress']);

  const close = appRouter.getStateForAction(app, { type: 'GO_BACK' }, options(appRouteNames));

  assert.deepEqual(close.routes.map((route: Route) => route.name), ['(tabs)']);
  assert.equal(close.routes[0].key, 'tabs-1');
});

test('Back on the first secondary page has nothing to pop, so it falls through to Close', () => {
  const root = liveRoot([secondary(['opportunities/[id]'])]);
  const inner = secondaryRouter.getStateForAction(appState(root).routes[1].state, { type: 'GO_BACK' }, options(secondaryRouteNames));

  assert.equal(inner, null);
});

test('switching tab from a secondary page reuses the tabs underneath', () => {
  const root = liveRoot([secondary(['progress', 'opportunities/index', 'opportunities/[id]'])]);
  const { targetKey, action } = linkAction('/freelance', 'POP_TO', root);

  assert.equal(targetKey, 'app-nav');
  const next = appRouter.getStateForAction(appState(root), action, options(appRouteNames));

  assert.deepEqual(next.routes.map((route: Route) => route.name), ['(tabs)']);
  assert.equal(next.routes[0].key, 'tabs-1');
  assert.equal(next.routes[0].params?.screen, 'freelance');
});

test('push or navigate to a tab from a secondary page would stack a second tabs navigator', () => {
  const root = liveRoot([secondary(['progress'])]);

  for (const type of ['PUSH', 'NAVIGATE']) {
    const { action } = linkAction('/sell', type, root);
    const next = appRouter.getStateForAction(appState(root), action, options(appRouteNames));
    const tabs = next.routes.filter((route: Route) => route.name === '(tabs)');

    assert.equal(tabs.length, 2, type);
  }
});

test('Product Detail closes back to the same tabs', () => {
  const root = liveRoot([{ key: 'product-1', name: 'product/[id]', params: { id: '17' } }]);
  const close = appRouter.getStateForAction(appState(root), { type: 'GO_BACK' }, options(appRouteNames));
  const fallback = linkAction('/sell', 'POP_TO', root);
  const dismissed = appRouter.getStateForAction(appState(root), fallback.action, options(appRouteNames));

  assert.equal(close.routes.length, 1);
  assert.equal(close.routes[0].key, 'tabs-1');
  assert.equal(dismissed.routes.length, 1);
  assert.equal(dismissed.routes[0].key, 'tabs-1');
});

test('opening Product Detail from Home pushes one route above the same tabs, and Close returns to Home', () => {
  const root = liveRoot([], 'index');
  const opened = runPlan(root, planTransition(readSnapshot(root, false, true), { type: 'openMission', missionId: 904, sellItemId: 17 }));
  const app = appState(opened);

  assert.deepEqual(app.routes.map((route) => route.name), ['(tabs)', 'product/[id]']);
  assert.equal(app.routes[0].key, 'tabs-1');
  assert.equal(app.routes[1].params?.id, '17');
  // The mission id never reaches the product route.
  assert.notEqual(app.routes[1].params?.id, '904');
  assert.deepEqual(readSnapshot(opened, false, true).topLevel, { route: 'product/[id]', origin: 'home', id: '17' });

  const closed = runPlan(opened, planTransition(readSnapshot(opened, false, true), { type: 'closeExperience' }));

  assert.deepEqual(appState(closed).routes.map((route) => route.key), ['tabs-1']);
  // No tab switch: Home is still the selected tab underneath.
  assert.equal(readSnapshot(closed, false, true).tabUnderneath, 'home');
});

test('a mission with no Sell item opens the generic detail inside the secondary group', () => {
  const root = liveRoot([], 'index');
  const opened = runPlan(root, planTransition(readSnapshot(root, false, true), { type: 'openMission', missionId: 904, sellItemId: null }));

  assert.deepEqual(appState(opened).routes.map((route) => route.name), ['(tabs)', '(secondary)']);
});

test('opening a product from a secondary page closes that page first, so no second modal is stacked', () => {
  const root = liveRoot([secondary(['opportunities/index'])], 'index');
  const steps = planTransition(readSnapshot(root, false, true), { type: 'openProduct', itemId: 17 });
  const next = runPlan(root, steps);

  assert.deepEqual(steps.map((step) => step.op), ['back', 'awaitNativeSettle', 'push', 'awaitNativeSettle']);
  assert.deepEqual(appState(next).routes.map((route) => route.name), ['(tabs)', 'product/[id]']);
});

test('a cold link builds the tabs underneath, and Close reveals them without a duplicate', () => {
  for (const path of ['/opportunities/12', '/settings', '/progress', '/product/17']) {
    const routes = parse(path);

    assert.equal(routes[0].name, '(tabs)', path);
    assert.equal(routes.filter((route) => route.name === '(tabs)').length, 1, path);
    assert.equal(routes.length, 2, path);

    const app = appRouter.getRehydratedState({ stale: true, routes, index: routes.length - 1 }, options(appRouteNames));
    const close = appRouter.getStateForAction(app, { type: 'GO_BACK' }, options(appRouteNames));

    assert.deepEqual(close.routes.map((route: Route) => route.name), ['(tabs)'], path);
  }

  assert.deepEqual(parse('/sell').map((route) => route.name), ['(tabs)']);
});

test('Sell creation is one (app) route with its steps inside it, and none of it is in the Sell tab', () => {
  assert.ok(appRouteNames.includes('create/sell'));
  assert.deepEqual([...creationRouteNames].sort(), ['listed', 'new', 'setup/[id]']);
  assert.deepEqual(sellTabRouteNames.filter((name) => name === 'new' || name === 'listed' || name.startsWith('setup')), []);

  const setup = parse('/create/sell/setup/17?origin=home');
  assert.deepEqual(setup.map((route) => route.name), ['(tabs)', 'create/sell']);
  assert.equal(setup[1].state?.routes[0].name, 'setup/[id]');
  assert.equal(setup[1].state?.routes[0].params?.id, '17');
  assert.equal(setup[1].state?.routes[0].params?.origin, 'home');
  assert.equal(parse('/create/sell/new?origin=sell')[1].state?.routes[0].name, 'new');
  assert.equal(parse('/create/sell/listed')[1].state?.routes[0].name, 'listed');
});

test('starting creation from a tab pushes one modal above the same tabs, and the origin is readable', () => {
  const root = liveRoot();
  const steps = planTransition(readSnapshot(root, false, true), { type: 'startCreation', kind: 'sell' });
  const next = runPlan(root, steps);
  const app = appState(next);

  assert.deepEqual(app.routes.map((route) => route.name), ['(tabs)', 'create/sell']);
  assert.equal(app.routes[0].key, 'tabs-1');
  // The pushed route carries its page and params nested until the creation stack mounts.
  assert.deepEqual(readSnapshot(next, false, true).topLevel, { route: 'create/sell', origin: 'sell', id: null });
});

test('Category replaces itself with setup inside the creation stack, so the modal stays up', () => {
  const root = liveRoot([creation('new', { origin: 'sell' })]);
  const { targetKey, action } = linkAction('/create/sell/setup/4?origin=sell', 'REPLACE', root);

  assert.equal(targetKey, 'creation-nav');
  const inner = creationRouter.getStateForAction(appState(root).routes[1].state, action, options(creationRouteNames));

  assert.deepEqual(inner.routes.map((route: Route) => route.name), ['setup/[id]']);
  assert.equal(inner.routes[0].params?.id, '4');
});

test('Continue setup closes Product Detail first, then presents creation over the same tabs', () => {
  const root = liveRoot([{ key: 'product-1', name: 'product/[id]', params: { id: '17' } }]);
  const steps = planTransition(readSnapshot(root, false, true), { type: 'resumeCreation', kind: 'sell', itemId: 17 });

  assert.deepEqual(steps.map((step) => step.op), ['back', 'awaitNativeSettle', 'push', 'awaitNativeSettle']);

  const app = appState(runPlan(root, steps));

  assert.deepEqual(app.routes.map((route) => route.name), ['(tabs)', 'create/sell']);
  assert.equal(app.routes.filter((route) => route.name === '(tabs)').length, 1);
  assert.equal(app.routes[0].key, 'tabs-1');
});

test('finishing returns to the origin tab and never stacks a second tabs navigator', () => {
  // Opened from Sell: a plain close.
  const fromSell = liveRoot([creation('setup/[id]', { id: '4', origin: 'sell' })]);
  const sellSteps = planTransition(readSnapshot(fromSell, false, true), { type: 'finishCreation', feedback: 'Ready to list' });
  const afterSell = appState(runPlan(fromSell, sellSteps));

  assert.equal(sellSteps[0].op, 'back');
  assert.deepEqual(afterSell.routes.map((route) => route.key), ['tabs-1']);

  // Opened from Home while the tabs underneath show Sell, as after a cold link: POP_TO Home.
  const fromHome = liveRoot([creation('setup/[id]', { id: '4', origin: 'home' })]);
  const homeSteps = planTransition(readSnapshot(fromHome, false, true), { type: 'finishCreation' });
  const afterHome = appState(runPlan(fromHome, homeSteps));

  assert.deepEqual(homeSteps[0], { op: 'dismissTo', href: '/' });
  assert.deepEqual(afterHome.routes.map((route) => route.key), ['tabs-1']);
  assert.equal(afterHome.routes[0].params?.screen, 'index');

  // Save & exit from creation opened on Home, with Home underneath.
  const onHome = liveRoot([creation('new', { origin: 'home' })], 'index');
  const closeSteps = planTransition(readSnapshot(onHome, false, true), { type: 'closeExperience' });

  assert.equal(closeSteps[0].op, 'back');
  assert.deepEqual(appState(runPlan(onHome, closeSteps)).routes.map((route) => route.key), ['tabs-1']);
});

test('old Sell creation links redirect to the creation route', () => {
  const compiled = redirects.map((redirect) => [routePatternToRegex(parseRouteSegments(redirect.source)), redirect, false]);

  for (const [from, to] of [['/sell/new', '/create/sell/new'], ['/sell/listed', '/create/sell/listed'], ['/sell/setup/17', '/create/sell/setup/17']]) {
    const href = applyRedirects(from, compiled);

    assert.equal(`/${String(href).replace(/^\//, '')}`, to, from);
    assert.deepEqual(parse(href).map((route) => route.name), ['(tabs)', 'create/sell'], from);
  }

  assert.equal(applyRedirects('/sell', compiled), '/sell');
});

test('old Sell item links open the canonical Product Detail, once, over the tabs', () => {
  const compiled = redirects.map((redirect) => [routePatternToRegex(parseRouteSegments(redirect.source)), redirect, false]);

  for (const from of ['/sell/items/4', '/sell/items/4/edit', '/sell/items/4/collage']) {
    const href = `/${String(applyRedirects(from, compiled)).replace(/^\//, '')}`;

    assert.equal(href, '/product/4', from);
    // The redirect target is a real route, and it is not itself redirected again.
    assert.equal(`/${String(applyRedirects(href, compiled)).replace(/^\//, '')}`, '/product/4', from);
    assert.deepEqual(parse(href).map((route) => route.name), ['(tabs)', 'product/[id]'], from);
  }

  // A query string is dropped by the redirect, so the old ?photo= is not carried into Product Detail.
  assert.equal(applyRedirects('/product/4', compiled), '/product/4');
});

test('the legacy Sell item pages and the unused background routes are gone from the route tree', () => {
  const getSystemRoute = ({ defaults }: { defaults: unknown }) => defaults;
  const routed = buildRoutes({ redirects, preserveRedirectAndRewrites: true, getSystemRoute, sitemap: false, notFound: false });
  const appRoute = routed.tree.children.find((child: { route: string }) => child.route === '(app)');
  const tabsRoute = appRoute.children.find((child: { route: string }) => child.route === '(tabs)');
  const productRoute = appRoute.children.find((child: { route: string }) => child.route === 'product/[id]');

  assert.deepEqual(childNames(tabsRoute, 'sell'), ['index']);
  assert.deepEqual(childNames(productRoute, 'photos').sort(), ['collage', 'edit', 'index']);
});

test('redirect sources become root routes, not screens in the Sell tab', () => {
  // getRoutes.js wraps a redirect node in a component that renders <Redirect>. The tree is all this needs.
  const getSystemRoute = ({ type, defaults }: { type: string; defaults: unknown }) => {
    assert.equal(type, 'redirect');
    return defaults;
  };
  const routed = buildRoutes({ redirects, preserveRedirectAndRewrites: true, getSystemRoute, sitemap: false, notFound: false });
  const routedApp = routed.tree.children.find((child: { route: string }) => child.route === '(app)');
  const routedTabs = routedApp.children.find((child: { route: string }) => child.route === '(tabs)');

  const rootRoutes = (routed.tree.children as { route: string; type: string }[]).filter((child) => child.type === 'redirect').map((child) => child.route);

  assert.deepEqual(rootRoutes.sort(), ['build/new', 'freelance/new', 'recover/new', 'sell/items/[id]', 'sell/items/[id]/collage', 'sell/items/[id]/edit', 'sell/listed', 'sell/new', 'sell/setup/[id]']);
  assert.deepEqual(childNames(routedTabs, 'sell').filter((name) => name === 'new' || name === 'listed' || name.startsWith('setup')), []);
  assert.deepEqual(childNames(routed.tree, '(app)').filter((name) => name.startsWith('sell/')), []);
});

// ---- Stage 5: Freelance, Recover and Build creation, mission returns, secondary pages ----

const SINGLE_SCREEN_CREATIONS = ['create/freelance', 'create/recover', 'create/build'];

test('Freelance, Recover and Build creation are (app) routes, and those tabs hold only their index', () => {
  for (const name of SINGLE_SCREEN_CREATIONS) {
    assert.ok(appRouteNames.includes(name), name);
  }

  for (const area of ['freelance', 'recover', 'build']) {
    assert.deepEqual(childNames(tabsNode, area), ['index'], area);
  }

  for (const [path, route] of [['/create/freelance', 'create/freelance'], ['/create/recover?origin=home', 'create/recover'], ['/create/build', 'create/build']]) {
    assert.deepEqual(parse(path).map((entry) => entry.name), ['(tabs)', route], path);
  }

  assert.equal(parse('/create/recover?origin=home')[1].params?.origin, 'home');
});

test('Add a lead from Freelance presents one modal above the same tabs, and Close or Finish return to Freelance', () => {
  const root = liveRoot([], 'freelance');
  const steps = planTransition(readSnapshot(root, false, true), { type: 'startCreation', kind: 'freelance' });
  const opened = runPlan(root, steps);

  assert.deepEqual(appState(opened).routes.map((route) => route.name), ['(tabs)', 'create/freelance']);
  assert.equal(appState(opened).routes[0].key, 'tabs-1');
  assert.deepEqual(readSnapshot(opened, false, true).topLevel, { route: 'create/freelance', origin: 'freelance', id: null });

  for (const intent of [{ type: 'closeExperience' }, { type: 'finishCreation' }] as const) {
    const closed = runPlan(opened, planTransition(readSnapshot(opened, false, true), intent));

    assert.deepEqual(appState(closed).routes.map((route) => route.key), ['tabs-1'], intent.type);
    assert.equal(readSnapshot(closed, false, true).tabUnderneath, 'freelance', intent.type);
  }
});

test('Recover creation started from Home finishes on Home, even if the tab underneath changed', () => {
  const fromHome = liveRoot([], 'index');
  const opened = runPlan(fromHome, planTransition(readSnapshot(fromHome, false, true), { type: 'startCreation', kind: 'recover' }));

  assert.deepEqual(readSnapshot(opened, false, true).topLevel, { route: 'create/recover', origin: 'home', id: null });

  const finish = planTransition(readSnapshot(opened, false, true), { type: 'finishCreation' });
  const closed = runPlan(opened, finish);

  assert.equal(finish[0].op, 'back');
  assert.deepEqual(appState(closed).routes.map((route) => route.key), ['tabs-1']);

  // Cold link: no origin, tabs underneath on Home. The category tab is the fallback and it is reached in the same update.
  const cold = liveRoot([{ key: 'create-1', name: 'create/recover' }], 'index');
  const coldClose = planTransition(readSnapshot(cold, false, true), { type: 'closeExperience' });

  assert.deepEqual(coldClose[0], { op: 'dismissTo', href: '/recover' });
  assert.deepEqual(appState(runPlan(cold, coldClose)).routes.map((route) => route.key), ['tabs-1']);
});

test('a second tap on Add a lead while creation is open does nothing', () => {
  const root = liveRoot([{ key: 'create-1', name: 'create/freelance', params: { origin: 'freelance' } }], 'freelance');
  const steps = planTransition(readSnapshot(root, false, true), { type: 'startCreation', kind: 'freelance' });

  assert.deepEqual(steps, [{ op: 'ignore', reason: 'creation-open' }]);
});

test('creation from the custom mission page closes that page first, then presents', () => {
  const root = liveRoot([secondary(['opportunities/index', 'opportunities/new'])], 'freelance');
  const steps = planTransition(readSnapshot(root, false, true), { type: 'startCreation', kind: 'freelance' });
  const next = runPlan(root, steps);

  assert.deepEqual(steps.map((step) => step.op), ['back', 'awaitNativeSettle', 'push', 'awaitNativeSettle']);
  assert.deepEqual(appState(next).routes.map((route) => route.name), ['(tabs)', 'create/freelance']);
});

test('opening a mission from a category and from Home returns to where it started, without a tab change', () => {
  for (const tab of ['freelance', 'recover', 'index'] as const) {
    const root = liveRoot([], tab);
    const opened = runPlan(root, planTransition(readSnapshot(root, false, true), { type: 'openMission', missionId: 31 }));
    const snapshot = readSnapshot(opened, false, true);

    assert.deepEqual(appState(opened).routes.map((route) => route.name), ['(tabs)', '(secondary)'], tab);
    assert.equal(snapshot.topLevel?.origin, tab === 'index' ? 'home' : tab, tab);

    const closed = runPlan(opened, planTransition(snapshot, { type: 'closeExperience' }));

    assert.deepEqual(appState(closed).routes.map((route) => route.key), ['tabs-1'], tab);
    assert.equal(readSnapshot(closed, false, true).tabUnderneath, tab === 'index' ? 'home' : tab, tab);
  }
});

test('"Message someone else" closes the mission, then sets start on Freelance once, without adding a tab route', () => {
  const root = liveRoot([secondary(['opportunities/[id]'])], 'index');
  const steps = planTransition(readSnapshot(root, false, true), { type: 'openTab', tab: 'freelance', start: 'message' });

  assert.deepEqual(steps.map((step) => step.op), ['dismissTo', 'awaitNativeSettle', 'setParams']);
  // A push to the tab would add a second copy of its index when Freelance is already selected, so there is none.
  assert.ok(!steps.some((step) => step.op === 'push'));

  const next = runPlan(root, steps);
  const tabs = appState(next).routes[0];

  assert.deepEqual(appState(next).routes.map((route) => route.key), ['tabs-1']);
  assert.equal(tabs.params?.screen, 'freelance');
  assert.equal((tabs.state as Nav).routes.find((route) => route.name === 'freelance')?.params?.start, 'message');
});

test('Build placeholder leaves for Freelance the same way, and a second request while it runs is dropped', () => {
  const root = liveRoot([{ key: 'create-1', name: 'create/build', params: { origin: 'build' } }], 'build');
  const steps = planTransition(readSnapshot(root, false, true), { type: 'openTab', tab: 'freelance' });
  const next = runPlan(root, steps);

  assert.deepEqual(steps.map((step) => step.op), ['dismissTo', 'awaitNativeSettle']);
  assert.deepEqual(appState(next).routes.map((route) => route.key), ['tabs-1']);
  assert.deepEqual(planTransition(readSnapshot(root, true, true), { type: 'openTab', tab: 'freelance' }), [{ op: 'ignore', reason: 'pending' }]);
});

test('Profile and Progress open once from a tab, never over another top-level page, and never twice', () => {
  const home = liveRoot([], 'index');
  const opened = runPlan(home, planTransition(readSnapshot(home, false, true), { type: 'openSecondary', href: '/settings?tab=profile' }));

  assert.deepEqual(appState(opened).routes.map((route) => route.name), ['(tabs)', '(secondary)']);
  assert.equal(appState(opened).routes[0].key, 'tabs-1');
  assert.deepEqual(planTransition(readSnapshot(opened, false, true), { type: 'openSecondary', href: '/progress' }), [{ op: 'ignore', reason: 'secondary-open' }]);

  const product = liveRoot([{ key: 'product-1', name: 'product/[id]', params: { id: '17' } }], 'sell');
  const steps = planTransition(readSnapshot(product, false, true), { type: 'openSecondary', href: '/progress' });

  assert.deepEqual(steps.map((step) => step.op), ['back', 'awaitNativeSettle', 'push', 'awaitNativeSettle']);
  assert.deepEqual(appState(runPlan(product, steps)).routes.map((route) => route.name), ['(tabs)', '(secondary)']);

  const creating = liveRoot([{ key: 'create-1', name: 'create/sell', params: { origin: 'sell' } }]);

  assert.deepEqual(planTransition(readSnapshot(creating, false, true), { type: 'openSecondary', href: '/progress' }), [{ op: 'ignore', reason: 'creation-open' }]);
});

/** A secondary group whose pages carry params, as a mission does. */
function secondaryPages(pages: [string, Record<string, unknown>?][]): Route {
  return {
    key: 'secondary-1',
    name: '(secondary)',
    state: {
      key: 'secondary-nav',
      type: 'stack',
      index: pages.length - 1,
      routes: pages.map(([name, params], at) => ({ key: `page-${at}`, name, params })),
      routeNames: secondaryRouteNames,
      preloadedRoutes: [],
    },
  };
}

function innerNames(root: Nav): string[] {
  return (appState(root).routes[1].state as Nav).routes.map((route) => route.name);
}

test('Progress to All activity to a mission stays in one secondary group, and a repeated tap adds no copy', () => {
  let root = liveRoot([secondaryPages([['progress']])], 'index');

  function navigateInside(href: string): Nav {
    const { targetKey, action } = linkAction(href, 'NAVIGATE', root);

    assert.equal(targetKey, 'secondary-nav', href);
    const inner = secondaryRouter.getStateForAction(appState(root).routes[1].state, action, options(secondaryRouteNames));

    return withApp({ ...appState(root), routes: [appState(root).routes[0], { ...appState(root).routes[1], state: inner }] });
  }

  root = navigateInside('/opportunities');
  root = navigateInside('/opportunities');
  assert.deepEqual(innerNames(root), ['progress', 'opportunities/index']);

  root = navigateInside('/opportunities/12');
  root = navigateInside('/opportunities/12');
  assert.deepEqual(innerNames(root), ['progress', 'opportunities/index', 'opportunities/[id]']);
  assert.deepEqual(appState(root).routes.map((route) => route.name), ['(tabs)', '(secondary)']);

  // Back returns to the list, Close removes the whole group in one step.
  const back = secondaryRouter.getStateForAction(appState(root).routes[1].state, { type: 'GO_BACK' }, options(secondaryRouteNames));
  const close = appRouter.getStateForAction(appState(root), { type: 'GO_BACK' }, options(appRouteNames));

  assert.deepEqual(back.routes.map((route: Route) => route.name), ['progress', 'opportunities/index']);
  assert.deepEqual(close.routes.map((route: Route) => route.key), ['tabs-1']);
});

test('finishing a cost returns to the All activity page underneath instead of stacking another', () => {
  const root = liveRoot([secondaryPages([['opportunities/index'], ['opportunities/new']])], 'index');
  const { targetKey, action } = linkAction('/opportunities', 'POP_TO', root);

  assert.equal(targetKey, 'secondary-nav');
  const inner = secondaryRouter.getStateForAction(appState(root).routes[1].state, action, options(secondaryRouteNames));

  assert.deepEqual(inner.routes.map((route: Route) => route.name), ['opportunities/index']);
});

test('the old in-tab add pages are redirected to the creation routes', () => {
  const compiled = redirects.map((redirect) => [routePatternToRegex(parseRouteSegments(redirect.source)), redirect, false]);

  for (const [from, to, route] of [['/freelance/new', '/create/freelance', 'create/freelance'], ['/recover/new', '/create/recover', 'create/recover'], ['/build/new', '/create/build', 'create/build']]) {
    const href = `/${String(applyRedirects(from, compiled)).replace(/^\//, '')}`;

    assert.equal(href, to, from);
    assert.deepEqual(parse(href).map((entry) => entry.name), ['(tabs)', route], from);
  }
});

test('creation routes are declared with the same presentation as Sell creation', () => {
  const layout = readFileSync(new URL('../app/(app)/_layout.tsx', import.meta.url), 'utf8');

  for (const name of ['create/sell', ...SINGLE_SCREEN_CREATIONS]) {
    assert.match(layout, new RegExp(`name="${name}"\\s+options=\\{creationOptions\\}`), name);
  }

  assert.equal(secondaryPresentation('ios', true).presentation, 'fullScreenModal');
});

// ---- Closing a top-level experience with pages inside it (the untargeted GO_BACK bug) ----

/** The real coordinator over the real routers. UIKit's finish signal only comes when the (app) route list changed. */
function liveNavigator(start: Nav, back: (root: Nav) => Nav) {
  let root = start;
  let finishDue = false;
  const nav = createNavigator();
  const logs: string[] = [];

  function apply(next: Nav) {
    const before = appRouteKeys(root);

    root = next;
    nav.stateChanged();
    finishDue = finishDue || appRouteKeys(root) !== before;
  }

  function link(href: string, type: 'PUSH' | 'POP_TO') {
    const { targetKey, action } = linkAction(href, type, root);

    apply(dispatchFocused(root, { ...action, target: targetKey }));
  }

  nav.attach({
    getRootState: () => root,
    back: () => apply(back(root)),
    push: (href) => link(href, 'PUSH'),
    dismissTo: (href) => link(href, 'POP_TO'),
    setParams: () => undefined,
    notify: () => undefined,
    log: (event) => logs.push(event),
    nativeSettle: true,
  });

  return {
    nav,
    logs,
    state: () => root,
    appRoutes: () => appState(root).routes.map((route) => route.name),
    /** What UIKit does after each present or dismiss. Returns false when no finish was due. */
    settle() {
      if (!finishDue) {
        return false;
      }

      finishDue = false;
      nav.nativeSettled();

      return true;
    },
    settleAll() {
      for (let at = 0; at < 4 && this.settle(); at += 1) {
        // Each finish can start the next step of the plan.
      }
    },
  };
}

function productRoute(id: string): Route {
  return {
    key: 'product-1',
    name: 'product/[id]',
    params: { id, origin: 'sell' },
    state: { key: 'product-nav', type: 'stack', index: 0, routes: [{ key: 'product-index', name: 'index' }] },
  };
}

test('tab sheets are cockpit sheet content, so React Native presents them from the sheet that is on screen', () => {
  // A Modal rendered beside the page sits in the covered tab's view controller, and UIKit refuses to present from it
  // while the cockpit sheet is up (device log: sheet.visible with no sheet.shown, for Message someone and Marketplaces).
  // Content passed as `below` is drawn inside the cockpit sheet on iOS phone. Native presentation itself needs the device.
  const files = [
    ['../app/(app)/(tabs)/freelance/index.tsx', 'function LeadCard', '<MessageSheet'],
    ['../app/(app)/(tabs)/sell/index.tsx', 'const GRID_GAP', '<Sheet '],
  ] as const;

  for (const [path, end, sheet] of files) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const screen = source.slice(source.indexOf('export default function'), source.indexOf(end));
    const beforeBelow = screen.slice(0, screen.indexOf('below={'));
    const inBelow = screen.slice(screen.indexOf('below={'));

    assert.ok(!beforeBelow.includes(sheet) && !beforeBelow.includes('<Sheet '), path);
    assert.ok(inBelow.includes(sheet) && inBelow.includes('<Sheet '), path);
  }
});

test('the (app) layout dispatches the coordinator back at the (app) navigator', () => {
  const layout = readFileSync(new URL('../app/(app)/_layout.tsx', import.meta.url), 'utf8');

  assert.match(layout, /appBackAction\(/);
  assert.match(layout, /containerRef\.dispatch\(action\)/);
});

test('an untargeted GO_BACK inside a secondary page pops that page, a targeted one removes the modal', () => {
  const root = liveRoot([secondaryPages([['progress'], ['opportunities/index']])], 'sell');
  const popped = dispatchFocused(root, { type: 'GO_BACK' });

  assert.deepEqual(innerNames(popped), ['progress']);
  assert.deepEqual(appState(popped).routes.map((route) => route.key), ['tabs-1', 'secondary-1']);

  const closed = coordinatorBack(root);

  assert.deepEqual(appState(closed).routes.map((route) => route.key), ['tabs-1']);
});

test('ordinary Back inside the secondary group is unchanged, and the first page closes the modal', () => {
  const deep = liveRoot([secondaryPages([['progress'], ['opportunities/index'], ['opportunities/[id]', { id: '4' }]])], 'sell');
  const once = dispatchFocused(deep, { type: 'GO_BACK' });
  const twice = dispatchFocused(once, { type: 'GO_BACK' });

  assert.deepEqual(innerNames(once), ['progress', 'opportunities/index']);
  assert.deepEqual(innerNames(twice), ['progress']);
  // The frame's Close targets the (app) navigator, so it removes one modal from any depth.
  assert.deepEqual(appState(dispatchFocused(deep, { type: 'GO_BACK', target: 'app-nav' })).routes.map((route) => route.key), ['tabs-1']);
  // On the first page there is nothing to pop, so Back bubbles to (app) and closes the modal.
  assert.deepEqual(appState(dispatchFocused(twice, { type: 'GO_BACK' })).routes.map((route) => route.key), ['tabs-1']);
});

test('Progress to All activity to a Sell product: one modal closes, the product opens, and nothing stays pending', () => {
  const start = liveRoot([secondaryPages([['progress'], ['opportunities/index']])], 'sell');
  const run = liveNavigator(start, coordinatorBack);
  const before = appState(start).routes.map((route) => route.key);

  run.nav.openProduct(17);
  // Exactly one native modal is removed.
  assert.deepEqual(appState(run.state()).routes.map((route) => route.key), ['tabs-1']);
  assert.equal(before.length - appState(run.state()).routes.length, 1);

  assert.ok(run.settle(), 'UIKit finishes the dismissal');
  assert.deepEqual(run.appRoutes(), ['(tabs)', 'product/[id]']);
  assert.ok(run.settle(), 'UIKit finishes the presentation');
  assert.ok(run.logs.includes('transition.dismiss.finished'));
  assert.ok(run.logs.includes('detail.presented'));
  assert.ok(!run.logs.includes('transition.aborted'));

  // Not pending: the next intent runs instead of being dropped.
  run.nav.closeExperience();
  assert.ok(!run.logs.includes('intent.ignored'));
  assert.deepEqual(run.appRoutes(), ['(tabs)']);
});

test('the untargeted back left the coordinator waiting for a signal that never came', () => {
  const start = liveRoot([secondaryPages([['progress'], ['opportunities/index']])], 'sell');
  const run = liveNavigator(start, (root) => dispatchFocused(root, { type: 'GO_BACK' }));

  run.nav.openProduct(17);

  assert.deepEqual(innerNames(run.state()), ['progress']);
  assert.equal(run.settle(), false, 'the (app) stack did not change, so UIKit reports nothing');

  run.nav.closeExperience();
  assert.ok(run.logs.includes('intent.ignored'), 'every later intent is dropped as pending');
});

test('Sell creation Close and Finish still remove the one creation modal, from any page depth', () => {
  const shallow = liveRoot([creation('setup/[id]', { id: '17', origin: 'sell' })], 'sell');
  const deepCreation: Route = {
    ...creation('new', { origin: 'sell' }),
    state: {
      key: 'creation-nav',
      type: 'stack',
      index: 1,
      routes: [{ key: 'step-0', name: 'new', params: { origin: 'sell' } }, { key: 'step-1', name: 'setup/[id]', params: { id: '17', origin: 'sell' } }],
      routeNames: creationRouteNames,
      preloadedRoutes: [],
    },
  };
  const deep = liveRoot([deepCreation], 'sell');

  for (const [label, start] of [['one page', shallow], ['two pages', deep]] as const) {
    for (const exit of ['closeExperience', 'finishCreation'] as const) {
      const run = liveNavigator(start, coordinatorBack);

      run.nav[exit]();
      assert.deepEqual(run.appRoutes(), ['(tabs)'], `${label} ${exit}`);
      assert.ok(run.settle());
      assert.deepEqual(run.appRoutes(), ['(tabs)']);
    }
  }
});

test('Product Detail to Continue setup: close, wait for UIKit, present creation once', () => {
  const start = liveRoot([productRoute('17')], 'sell');
  const run = liveNavigator(start, coordinatorBack);

  run.nav.resumeCreation('sell', 17);
  assert.deepEqual(run.appRoutes(), ['(tabs)']);
  assert.ok(run.settle());
  assert.deepEqual(run.appRoutes(), ['(tabs)', 'create/sell']);
  assert.ok(run.settle());
  assert.ok(run.logs.includes('creation.presented'));

  // Nothing is left waiting.
  run.nav.closeExperience();
  assert.ok(!run.logs.includes('intent.ignored'));
  assert.deepEqual(run.appRoutes(), ['(tabs)']);
});

test('a Recover mission opened inside the secondary group closes in one step with the coordinator', () => {
  const start = liveRoot([secondaryPages([['progress'], ['opportunities/index'], ['opportunities/[id]', { id: '48', origin: 'recover' }]])], 'recover');
  const run = liveNavigator(start, coordinatorBack);

  run.nav.closeExperience();
  assert.deepEqual(run.appRoutes(), ['(tabs)']);
  assert.ok(run.settle());
  assert.equal(readSnapshot(run.state(), false, true).tabUnderneath, 'recover');
});

// ---- Photos sheet and its editors (stack 3 holds the sheet, stack 4 holds the pushes inside it) ----

const productNode = appNode.children.find((child: { route: string }) => child.route === 'product/[id]');
const productRouteNames = (productNode.children as { route: string }[]).map((child) => child.route);
const photosRouteNames = childNames(productNode, 'photos');
const productRouter = StackRouter({});
const photosRouter = StackRouter({});

/** Live state with Product Detail open. `photos` is the sheet, `inside` is what sits in the sheet's own stack. */
function withProduct(sheet: string[] | null): Nav {
  const photosRoute: Route = {
    key: 'photos-1',
    name: 'photos',
    state: {
      key: 'photos-nav',
      type: 'stack',
      index: (sheet?.length ?? 1) - 1,
      routes: (sheet ?? ['index']).map((name, at) => ({ key: `inside-${at}`, name })),
      routeNames: photosRouteNames,
      preloadedRoutes: [],
    },
  };
  const product: Route = {
    key: 'product-1',
    name: 'product/[id]',
    params: { id: '17' },
    state: {
      key: 'product-nav',
      type: 'stack',
      index: sheet ? 1 : 0,
      routes: sheet ? [{ key: 'detail-1', name: 'index' }, photosRoute] : [{ key: 'detail-1', name: 'index' }],
      routeNames: productRouteNames,
      preloadedRoutes: [],
    },
  };

  return liveRoot([product], 'index');
}

function productNav(root: Nav): Nav {
  return appState(root).routes[1].state as Nav;
}

function photosNav(root: Nav): Nav {
  return productNav(root).routes[1].state as Nav;
}

function names(nav: Nav): string[] {
  return nav.routes.map((route) => route.name);
}

test('Photos and its editors are pushes in their own stack inside the sheet, not top-level routes', () => {
  assert.deepEqual(productRouteNames.sort(), ['index', 'photos']);
  assert.deepEqual(photosRouteNames.sort(), ['collage', 'edit', 'index']);
});

test('Edit Photo and Edit Collage open inside the Photos stack, leaving the sheet and Product Detail alone', () => {
  for (const editor of ['edit', 'collage']) {
    const root = withProduct(null);
    const sheet = productRouter.getStateForAction(productNav(root), { type: 'NAVIGATE', payload: { name: 'photos' } }, options(productRouteNames));

    assert.deepEqual(names(sheet), ['index', 'photos']);

    const opened = withProduct(['index']);
    const { targetKey, action } = linkAction(`/product/17/photos/${editor}?photo=9`, 'PUSH', opened);

    assert.equal(targetKey, 'photos-nav', editor);

    const next = photosRouter.getStateForAction(photosNav(opened), action, options(photosRouteNames));
    const after = { ...opened };

    assert.deepEqual(names(next), ['index', editor], editor);
    // Nothing above the sheet changed: still one Product Detail over the same tabs, and no second modal.
    assert.deepEqual(names(appState(after)), ['(tabs)', 'product/[id]'], editor);
    assert.deepEqual(names(productNav(after)), ['index', 'photos'], editor);
  }
});

test('Close or Back from an editor returns to the Photos overview and keeps the sheet open', () => {
  for (const editor of ['edit', 'collage']) {
    const root = withProduct(['index', editor]);
    const back = photosRouter.getStateForAction(photosNav(root), { type: 'GO_BACK' }, options(photosRouteNames));

    assert.deepEqual(names(back), ['index'], editor);
    // The editor was the only thing popped. The sheet is still in Product Detail's stack.
    assert.deepEqual(names(productNav(root)), ['index', 'photos'], editor);
  }
});

test('the action a discard dispatches (GO_BACK on the editor) pops the editor and never the sheet', () => {
  const root = withProduct(['index', 'edit']);
  const discard = { type: 'GO_BACK', source: 'inside-1' };
  const inner = photosRouter.getStateForAction(photosNav(root), discard, options(photosRouteNames));

  assert.deepEqual(names(inner), ['index']);

  // This is what a native sheet drag dispatches (onNativeDismissCancelled): pop of the `photos` route in stack 3.
  // It is the action the guard used to replay on Discard, and it removes the editor and Photos together.
  const sheetDrag = { type: 'POP', payload: { count: 1 }, source: 'photos-1', target: 'product-nav' };
  const replayed = productRouter.getStateForAction(productNav(root), sheetDrag, options(productRouteNames));

  assert.deepEqual(names(replayed), ['index']);
});

test('closing the Photos overview returns to Product Detail', () => {
  const root = withProduct(['index']);

  // Nothing to pop in the sheet's stack, so the dispatch falls through to the one that holds the sheet.
  assert.equal(photosRouter.getStateForAction(photosNav(root), { type: 'GO_BACK' }, options(photosRouteNames)), null);

  const closed = productRouter.getStateForAction(productNav(root), { type: 'GO_BACK' }, options(productRouteNames));

  assert.deepEqual(names(closed), ['index']);
});

test('the Photos sheet is draggable only while no editor is open', () => {
  assert.equal(photosSheetGestureEnabled(undefined), true);
  assert.equal(photosSheetGestureEnabled('index'), true);
  assert.equal(photosSheetGestureEnabled('edit'), false);
  assert.equal(photosSheetGestureEnabled('collage'), false);
});

test('no screen inside the Photos sheet pops by swipe', () => {
  assert.equal(photosStackGestures.gestureEnabled, false);
  assert.equal(photosStackGestures.fullScreenGestureEnabled, false);
});

test('the layouts apply those rules to the routes they own', () => {
  const productLayout = readFileSync(join(appDir, '(app)/product/[id]/_layout.tsx'), 'utf8');
  const photosLayout = readFileSync(join(appDir, '(app)/product/[id]/photos/_layout.tsx'), 'utf8');

  assert.match(productLayout, /photosSheetGestureEnabled\(getFocusedRouteNameFromRoute\(route\)\)/);
  assert.doesNotMatch(productLayout, /gestureEnabled: true/);

  for (const screen of ['index', 'edit', 'collage']) {
    assert.match(photosLayout, new RegExp(`name="${screen}"[^\\n]*photosStackGestures`), screen);
  }

  // Product Detail itself and the sheet's grabber stay as they were.
  assert.match(productLayout, /name="index" options=\{\{ animation: 'none' \}\}/);
  assert.match(productLayout, /sheetGrabberVisible: false/);
});
