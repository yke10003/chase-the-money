import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { cockpitArea, isCockpitRoot, outsideActionsVisible, SHEET_RESTING_DETENT, sheetCover, shellPath } from './cockpit-scene';

test('cockpit routes stay in an area, and the rest leave it', () => {
  assert.equal(cockpitArea('/'), 'home');
  assert.equal(cockpitArea('/sell'), 'sell');
  assert.equal(cockpitArea('/sell/items/4'), 'sell');
  assert.equal(cockpitArea('/freelance/new'), 'freelance');
  assert.equal(cockpitArea('/build/new'), 'build');
  assert.equal(cockpitArea('/recover/new'), 'recover');
  assert.equal(cockpitArea('/opportunities/3'), null);
  assert.equal(cockpitArea('/settings'), null);
  assert.equal(cockpitArea('/progress'), null);
  assert.equal(cockpitArea('/create/sell/new'), null);
});

test('sell creation covers the tabs, so the hero keeps the tab underneath', () => {
  assert.equal(shellPath('/create/sell/new', '/sell'), '/sell');
  assert.equal(shellPath('/create/sell/setup/4', '/'), '/');
  assert.equal(shellPath('/create/sell/setup/4', null), '/');
});

test('only the five tab roots publish a rich hero', () => {
  assert.equal(isCockpitRoot('/sell'), true);
  assert.equal(isCockpitRoot('/sell/items/4'), false);
  assert.equal(isCockpitRoot('/'), true);
});

test('the resting detent matches the taller sheet, and full covers the space under the island', () => {
  assert.equal(sheetCover(874, 59, 0), (874 - 59) * SHEET_RESTING_DETENT);
  assert.equal(sheetCover(874, 59, 1), 874 - 59);
  assert.equal(outsideActionsVisible(0), true);
  assert.equal(outsideActionsVisible(1), false);
});

test('the sell stack is only the overview and the legacy item pages', () => {
  const layout = readFileSync(new URL('../app/(app)/(tabs)/sell/_layout.tsx', import.meta.url), 'utf8');

  assert.equal(layout.includes('initialRouteName="index"'), true);
  assert.equal(layout.includes('name="index"'), true);
  assert.equal(layout.includes('name="new"'), false);
  assert.equal(layout.includes('name="listed"'), false);
  assert.equal(layout.includes('setup/'), false);
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
  // Sell creation is an (app) stack modal, not a second screen in the cockpit's stack.
  assert.equal(sheet.includes('stackPresentation="fullScreenModal"'), false);
  assert.equal(sheet.includes('sell-create'), false);
  assert.equal(sheet.includes('PanResponder'), false);
  assert.equal(moduleConfig.includes('NolumeSheetTabBarSubscriber'), true);
});
