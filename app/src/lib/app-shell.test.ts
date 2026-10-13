import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { appWrapper, secondaryPresentation } from './app-shell';
import { cockpitArea, shellPath } from './cockpit-scene';

// The router tests drive Expo Router's own path parsing, target selection and
// stack router against the real files under src/app.
const load = createRequire(import.meta.url);
// The fork only uses validatePathConfig from here; the real module pulls in react-native.
load.cache[load.resolve('expo-router/build/react-navigation/native')] = { exports: { validatePathConfig: () => {} } } as never;
const { getRoutes } = load('expo-router/build/getRoutesCore.js');
const { getReactNavigationConfig } = load('expo-router/build/getReactNavigationConfig.js');
const { getStateFromPath } = load('expo-router/build/fork/getStateFromPath.js');
const { findDivergentState, getPayloadFromStateRoute } = load('expo-router/build/global-state/stateUtils.js');
const { StackRouter } = load('expo-router/build/react-navigation/routers/StackRouter.js');

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

function buildRoutes() {
  const files = routeFiles(appDir);
  const modules: Record<string, Record<string, unknown>> = {};

  for (const file of files) {
    const source = readFileSync(join(appDir, file), 'utf8');
    const anchor = source.match(/unstable_settings\s*=\s*\{[^}]*anchor:\s*'([^']+)'/)?.[1];
    modules[file] = anchor ? { default: () => null, unstable_settings: { anchor } } : { default: () => null };
  }

  const context = Object.assign((key: string) => modules[key], { keys: () => files, resolve: (key: string) => key, id: 'app' });
  const tree = getRoutes(context, { platform: 'ios', ignoreEntryPoints: true });

  return { tree, config: getReactNavigationConfig(tree, true) };
}

const { tree, config } = buildRoutes();

function childNames(node: { route: string; children: unknown[] }, name: string): string[] {
  const found = (node.children as { route: string; children: unknown[] }[]).find((child) => child.route === name);

  return (found?.children as { route: string }[] | undefined)?.map((child) => child.route) ?? [];
}

const appRouteNames = childNames(tree, '(app)');
const secondaryRouteNames = childNames(tree.children.find((child: { route: string }) => child.route === '(app)'), '(secondary)');

function parse(path: string): PartialRoute[] {
  const state = getStateFromPath(path, config);
  const app = state.routes.find((route: PartialRoute) => route.name === '(app)');

  return app?.state?.routes ?? [];
}

const appRouter = StackRouter({});
const secondaryRouter = StackRouter({});
const options = (routeNames: string[]) => ({ routeNames, routeParamList: {}, routeGetIdList: {} });

/** The live state on iOS phone: the cockpit tabs on Sell, and whatever sits above them. */
function liveRoot(above: Route[] = []): Nav {
  const tabs: Route = {
    key: 'tabs-1',
    name: '(tabs)',
    state: { key: 'tab-nav', type: 'tab', index: 1, routes: [{ key: 'home', name: 'index' }, { key: 'sell', name: 'sell' }] },
  };
  const app: Nav = { key: 'app-nav', type: 'stack', index: above.length, routes: [tabs, ...above], routeNames: appRouteNames, preloadedRoutes: [] };

  return { key: 'root-nav', type: 'stack', index: 0, routes: [{ key: 'app-1', name: '(app)', state: app }] };
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
  const target = getStateFromPath(href, config);
  const { actionStateRoute, navigationState } = findDivergentState(target, root);
  const payload = getPayloadFromStateRoute(actionStateRoute ?? {});

  return { targetKey: navigationState.key as string, action: { type, payload: { name: payload.screen, params: payload.params } } };
}

function appState(root: Nav): Nav {
  return root.routes[0].state as Nav;
}

test('the iOS phone wrapper never changes with the page, so the (app) stack is not remounted', () => {
  const paths = ['/', '/sell', '/sell/new', '/sell/setup/4', '/freelance', '/recover', '/build', '/product/17', '/settings', '/progress', '/friends', '/opportunities', '/opportunities/12', '/opportunities/new', '/discover'];
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
