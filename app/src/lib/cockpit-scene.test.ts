import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { abandonedSellStackKey, cockpitArea, creationAvailabilityChanged, creationHandoffReady, decideCreationCover, holdsCockpitScene, isCockpitRoot, isSellCreationPath, outsideActionsVisible, readSellStack, SHEET_RESTING_DETENT, sheetCover, type SellStackSnap } from './cockpit-scene';

test('cockpit routes stay in an area, and the rest leave it', () => {
  assert.equal(cockpitArea('/'), 'home');
  assert.equal(cockpitArea('/sell'), 'sell');
  assert.equal(cockpitArea('/sell/new'), 'sell');
  assert.equal(cockpitArea('/sell/setup/4'), 'sell');
  assert.equal(cockpitArea('/sell/items/4'), 'sell');
  assert.equal(cockpitArea('/freelance/new'), 'freelance');
  assert.equal(cockpitArea('/build/new'), 'build');
  assert.equal(cockpitArea('/recover/new'), 'recover');
  assert.equal(cockpitArea('/opportunities/3'), null);
  assert.equal(cockpitArea('/settings'), null);
  assert.equal(cockpitArea('/progress'), null);
});

test('only the five tab roots publish a rich hero', () => {
  assert.equal(isCockpitRoot('/sell'), true);
  assert.equal(isCockpitRoot('/sell/new'), false);
  assert.equal(isCockpitRoot('/'), true);
});

test('the resting detent matches the taller sheet, and full covers the space under the island', () => {
  assert.equal(sheetCover(874, 59, 0), (874 - 59) * SHEET_RESTING_DETENT);
  assert.equal(sheetCover(874, 59, 1), 874 - 59);
  assert.equal(outsideActionsVisible(0), true);
  assert.equal(outsideActionsVisible(1), false);
});

test('opening the creation sheet renders the shell once, and a later edit does not', () => {
  assert.equal(creationAvailabilityChanged(null, false, '/sell/new', true), true);
  assert.equal(creationAvailabilityChanged('/sell/new', true, '/sell/new', true), false);
  assert.equal(creationAvailabilityChanged('/sell/new', true, '/sell/setup/4', true), false);
  assert.equal(creationAvailabilityChanged('/sell/new', true, '/sell', false), true);
  assert.equal(creationAvailabilityChanged('/sell/new', true, '/sell/new', false), true);
  assert.equal(creationAvailabilityChanged('/sell/new', false, '/sell/new', false), false);
});

test('category and setup share one creation sheet', () => {
  assert.equal(creationHandoffReady({
    pathname: '/sell/setup/4',
    previousPath: '/sell/new',
    publishedPath: '/sell/new',
    hasNode: true,
  }), true);
  assert.equal(creationHandoffReady({
    pathname: '/sell/setup/4',
    previousPath: '/sell',
    publishedPath: '/sell/new',
    hasNode: true,
  }), false);
  assert.equal(creationHandoffReady({
    pathname: '/sell/setup/4',
    previousPath: null,
    publishedPath: null,
    hasNode: false,
  }), false);
});

test('the creation sheet uses the availability check instead of the inverted one', () => {
  const source = readFileSync(new URL('../components/cockpit-context.tsx', import.meta.url), 'utf8');

  assert.equal(source.includes('creationAvailabilityChanged(creationPath, creationRef.current != null, path, node != null)'), true);
  assert.equal(source.includes('(creationRef.current == null) !== (node != null)'), false);
});

test('the shell re-render that follows the first publish does not publish forever', () => {
  let path: string | null = null;
  let hadContent = false;
  let shellRenders = 0;

  function publish(nextPath: string, hasContent: boolean) {
    const changed = creationAvailabilityChanged(path, hadContent, nextPath, hasContent);
    path = nextPath;
    hadContent = hasContent;

    if (!changed || shellRenders > 2) {
      return;
    }

    shellRenders += 1;
    publish(nextPath, hasContent);
  }

  publish('/sell/new', true);

  assert.equal(shellRenders, 1);
});

test('adding something to sell is the full-screen creation sheet', () => {
  assert.equal(isSellCreationPath('/sell/new'), true);
  assert.equal(isSellCreationPath('/sell/listed'), true);
  assert.equal(isSellCreationPath('/sell/setup/4'), true);
  assert.equal(isSellCreationPath('/sell'), false);
  assert.equal(isSellCreationPath('/sell/items/4'), false);
});

test('a sell stack left on the creation flow can be popped without touching other tabs', () => {
  const state = {
    routes: [
      {
        name: '(tabs)',
        state: {
          index: 0,
          routes: [
            { name: 'index' },
            {
              name: 'sell',
              state: {
                key: 'sell-stack',
                type: 'stack',
                index: 1,
                routes: [{ name: 'index' }, { name: 'new' }],
              },
            },
          ],
        },
      },
    ],
  };

  assert.equal(abandonedSellStackKey(state), 'sell-stack');
  const onSell = {
    routes: [{
      name: '(tabs)',
      state: {
        index: 1,
        routes: state.routes[0].state.routes,
      },
    }],
  };
  assert.equal(abandonedSellStackKey(onSell), null);
  assert.equal(abandonedSellStackKey({
    routes: [{
      name: 'sell',
      state: { key: 'sell-stack', type: 'stack', index: 0, routes: [{ name: 'index' }] },
    }],
  }), null);
  assert.equal(abandonedSellStackKey({
    routes: [{
      name: 'sell',
      state: { key: 'sell-stack', type: 'stack', index: 1, routes: [{ name: 'index' }, { name: 'items/[id]' }] },
    }],
  }), null);
});

test('the creation sheet keeps the sell overview that opened it', () => {
  assert.equal(holdsCockpitScene('/sell/new', '/sell'), true);
  assert.equal(holdsCockpitScene('/sell/listed', '/sell'), true);
  assert.equal(holdsCockpitScene('/sell/setup/4', '/sell'), true);
  assert.equal(holdsCockpitScene('/sell/new', '/'), false);
  assert.equal(holdsCockpitScene('/sell/new', '/sell/items/4'), false);
  assert.equal(holdsCockpitScene('/sell/items/4', '/sell'), false);
  assert.equal(holdsCockpitScene('/sell/new', null), false);
});

test('selecting sell does not present a creation sheet that was already on the stack', () => {
  const sitting: SellStackSnap = { selected: false, key: 'sell-stack', focusedName: 'new', depth: 2 };
  const focused: SellStackSnap = { selected: true, key: 'sell-stack', focusedName: 'new', depth: 2 };
  const revealed = decideCreationCover({
    pathname: '/sell/new',
    previousPath: '/',
    snap: focused,
    previousSnap: sitting,
    blocked: false,
  });

  assert.equal(revealed.present, false);
  assert.equal(revealed.pop, true);
  assert.equal(revealed.stackKey, 'sell-stack');

  const firstSight = decideCreationCover({
    pathname: '/sell/new',
    previousPath: '/',
    snap: focused,
    previousSnap: null,
    blocked: false,
  });

  assert.equal(firstSight.present, false);
  assert.equal(firstSight.pop, true);

  const stayed = decideCreationCover({
    pathname: '/sell/new',
    previousPath: '/sell/new',
    snap: focused,
    previousSnap: focused,
    blocked: true,
  });

  assert.equal(stayed.present, false);
  assert.equal(stayed.pop, true);
});

test('a push while sell is open, and a cold deep link, still present the creation sheet', () => {
  const overview: SellStackSnap = { selected: true, key: 'sell-stack', focusedName: 'index', depth: 1 };
  const creating: SellStackSnap = { selected: true, key: 'sell-stack', focusedName: 'setup/[id]', depth: 2 };
  const pushed = decideCreationCover({
    pathname: '/sell/setup/10',
    previousPath: '/sell',
    snap: creating,
    previousSnap: overview,
    blocked: false,
  });

  assert.equal(pushed.present, true);
  assert.equal(pushed.pop, false);

  // Cold Sell visit: the overview log has no stack snapshot, then the first
  // product tap arrives with priorFocused=null. That push must stay.
  const firstProduct = decideCreationCover({
    pathname: '/sell/setup/10',
    previousPath: '/sell',
    snap: creating,
    previousSnap: null,
    blocked: false,
  });

  assert.equal(firstProduct.present, true);
  assert.equal(firstProduct.pop, false);

  const deepLink = decideCreationCover({
    pathname: '/sell/setup/10',
    previousPath: null,
    snap: creating,
    previousSnap: null,
    blocked: false,
  });

  assert.equal(deepLink.present, true);
  assert.equal(deepLink.pop, false);

  const fromHome = decideCreationCover({
    pathname: '/sell/setup/10',
    previousPath: '/',
    snap: creating,
    previousSnap: { selected: false, key: 'sell-stack', focusedName: 'index', depth: 1 },
    blocked: false,
  });

  assert.equal(fromHome.present, true);
  assert.equal(fromHome.pop, false);
});

test('the sell stack starts on the overview, not the creation flow', () => {
  const layout = readFileSync(new URL('../app/(app)/(tabs)/sell/_layout.tsx', import.meta.url), 'utf8');
  const indexAt = layout.indexOf('name="index"');
  const newAt = layout.indexOf('name="new"');

  assert.equal(layout.includes('initialRouteName="index"'), true);
  assert.ok(indexAt !== -1 && newAt !== -1 && indexAt < newAt);
  assert.equal(readSellStack(null), null);
});

test('the cockpit has one sheet and each area has a stack for its nested routes', () => {
  const tabs = readFileSync(new URL('../app/(app)/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.equal(tabs.includes('CockpitShell'), true);
  assert.equal(tabs.includes('MenuSheet'), false);
  assert.equal(tabs.includes('minimizeBehavior'), false);
  assert.equal(tabs.includes('sidebarAdaptable'), false);

  for (const area of ['sell', 'freelance', 'build', 'recover']) {
    const layout = readFileSync(new URL(`../app/(app)/(tabs)/${area}/_layout.tsx`, import.meta.url), 'utf8');
    assert.equal(layout.includes('AreaStack'), true);
    assert.equal(layout.includes('CockpitLayer'), false);
  }
});

test('the resting cockpit is a native form sheet and the tab-bar lift is a tracked module', () => {
  const shell = readFileSync(new URL('../components/cockpit-shell.tsx', import.meta.url), 'utf8');
  const sheet = readFileSync(new URL('../components/menu-sheet.tsx', import.meta.url), 'utf8');
  const moduleConfig = readFileSync(new URL('../../modules/nolume-sheet-tab-bar/expo-module.config.json', import.meta.url), 'utf8');

  assert.equal(shell.includes('MenuSheet'), true);
  assert.equal(shell.includes('CockpitSheet'), false);
  assert.equal(shell.includes('CockpitLayer'), false);
  assert.equal(sheet.includes('screenId="cockpit"'), true);
  assert.equal(sheet.includes('stackPresentation="formSheet"'), true);
  assert.equal(sheet.includes('sheetExpandsWhenScrolledToEdge'), true);
  assert.equal(sheet.includes('gestureEnabled={false}'), true);
  assert.equal(sheet.includes('stackPresentation="fullScreenModal"'), true);
  assert.equal(sheet.includes('PanResponder'), false);
  assert.equal(moduleConfig.includes('NolumeSheetTabBarSubscriber'), true);
});
