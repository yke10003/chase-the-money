import assert from 'node:assert/strict';
import test from 'node:test';

import { createNavigator, planTransition, readSnapshot, type NavSnapshot, type Step } from './navigation';

const idle: NavSnapshot = { tabUnderneath: 'sell', topLevel: null, pending: false, nativeSettle: true };

function ops(steps: Step[]): string[] {
  return steps.map((step) => {
    if (step.op === 'push' || step.op === 'dismissTo') {
      return `${step.op} ${step.href}`;
    }

    if (step.op === 'awaitNativeSettle') {
      return `await ${step.top}`;
    }

    if (step.op === 'toast') {
      return `toast ${step.message}`;
    }

    if (step.op === 'ignore') {
      return `ignore ${step.reason}`;
    }

    return step.op;
  });
}

test('Sell something presents creation over the tab it was started from', () => {
  assert.deepEqual(ops(planTransition(idle, { type: 'startCreation', kind: 'sell' })), [
    'push /create/sell/new?origin=sell',
    'await create/sell',
  ]);
  assert.deepEqual(ops(planTransition({ ...idle, tabUnderneath: 'home' }, { type: 'startCreation', kind: 'sell-listed' })), [
    'push /create/sell/listed?origin=home',
    'await create/sell',
  ]);
});

test('Continue Setup closes Product Detail, waits for UIKit, then presents setup with the same origin', () => {
  const product = { ...idle, tabUnderneath: 'home' as const, topLevel: { route: 'product/[id]', origin: null, id: null } };

  assert.deepEqual(ops(planTransition(product, { type: 'resumeCreation', kind: 'sell', itemId: 17 })), [
    'back',
    'await (tabs)',
    'push /create/sell/setup/17?origin=home',
    'await create/sell',
  ]);
});

test('an origin recorded on the open experience wins over the tab underneath', () => {
  const product = { ...idle, tabUnderneath: 'sell' as const, topLevel: { route: 'product/[id]', origin: 'home' as const, id: null } };

  assert.deepEqual(ops(planTransition(product, { type: 'resumeCreation', kind: 'sell', itemId: 4 }))[2], 'push /create/sell/setup/4?origin=home');
});

test('with no known tab, creation falls back to Sell', () => {
  const cold = { ...idle, tabUnderneath: null };

  assert.deepEqual(ops(planTransition(cold, { type: 'resumeCreation', kind: 'sell', itemId: 4 }))[0], 'push /create/sell/setup/4?origin=sell');
});

test('a second request while one is running, or while creation is open, is dropped', () => {
  assert.deepEqual(ops(planTransition({ ...idle, pending: true }, { type: 'startCreation', kind: 'sell' })), ['ignore pending']);

  const open = { ...idle, topLevel: { route: 'create/sell', origin: 'sell' as const, id: null } };
  assert.deepEqual(ops(planTransition(open, { type: 'resumeCreation', kind: 'sell', itemId: 4 })), ['ignore creation-open']);
});

test('Finish returns to the origin tab and shows feedback only after the modal has gone', () => {
  const creating = { ...idle, topLevel: { route: 'create/sell', origin: 'sell' as const, id: null } };

  assert.deepEqual(ops(planTransition(creating, { type: 'finishCreation', feedback: 'Ready to list' })), [
    'back',
    'await (tabs)',
    'toast Ready to list',
  ]);
  assert.deepEqual(ops(planTransition(creating, { type: 'closeExperience' })), ['back', 'await (tabs)']);
});

test('when the tab underneath is not the origin, closing switches to the origin in the same update', () => {
  const fromHome = { ...idle, tabUnderneath: 'sell' as const, topLevel: { route: 'create/sell', origin: 'home' as const, id: null } };
  const cold = { ...idle, tabUnderneath: 'home' as const, topLevel: { route: 'create/sell', origin: null, id: null } };

  assert.deepEqual(ops(planTransition(fromHome, { type: 'finishCreation' })), ['dismissTo /', 'await (tabs)']);
  assert.deepEqual(ops(planTransition(cold, { type: 'closeExperience' })), ['dismissTo /sell', 'await (tabs)']);
});

test('closing with nothing open does nothing', () => {
  assert.deepEqual(ops(planTransition(idle, { type: 'closeExperience' })), ['ignore nothing-open']);
});

test('web and Android run the same steps without native waits', () => {
  const web = { ...idle, nativeSettle: false, topLevel: { route: 'product/[id]', origin: null, id: null } };

  assert.deepEqual(ops(planTransition(web, { type: 'resumeCreation', kind: 'sell', itemId: 9 })), ['back', 'push /create/sell/setup/9?origin=sell']);
});

test('no plan replaces one top-level modal with another', () => {
  const snapshots: NavSnapshot[] = [
    idle,
    { ...idle, topLevel: { route: 'product/[id]', origin: null, id: null } },
    { ...idle, topLevel: { route: '(secondary)', origin: null, id: null } },
    { ...idle, topLevel: { route: 'create/sell', origin: 'home', id: null } },
    { ...idle, topLevel: { route: 'create/freelance', origin: 'freelance', id: null } },
    { ...idle, tabUnderneath: null, nativeSettle: false },
  ];
  const intents = [
    { type: 'startCreation', kind: 'sell' },
    { type: 'startCreation', kind: 'sell-listed' },
    { type: 'startCreation', kind: 'freelance' },
    { type: 'startCreation', kind: 'recover' },
    { type: 'startCreation', kind: 'build' },
    { type: 'openSecondary', href: '/progress' },
    { type: 'openTab', tab: 'freelance', start: 'message' },
    { type: 'resumeCreation', kind: 'sell', itemId: 1 },
    { type: 'openProduct', itemId: 5 },
    { type: 'openMission', missionId: 9 },
    { type: 'openMission', missionId: 9, sellItemId: 5, origin: 'home' },
    { type: 'finishCreation', feedback: 'Done' },
    { type: 'closeExperience' },
  ] as const;

  for (const snapshot of snapshots) {
    for (const intent of intents) {
      const steps = planTransition(snapshot, intent);
      const stackChanges = steps.filter((step) => step.op === 'back' || step.op === 'push' || step.op === 'dismissTo');

      // At most one close and one present, never two presents.
      assert.ok(stackChanges.filter((step) => step.op === 'push').length <= 1, JSON.stringify(steps));
      assert.ok(stackChanges.length <= 2, JSON.stringify(steps));
      // With native waits, every change to the stack is followed by a wait before the next one.
      if (snapshot.nativeSettle) {
        steps.forEach((step, at) => {
          if (step.op === 'back' || step.op === 'push' || step.op === 'dismissTo') {
            assert.equal(steps[at + 1]?.op, 'awaitNativeSettle', JSON.stringify(steps));
          }
        });
      }
    }
  }
});

test('a Sell mission opens the Sell item, never the mission id, and other missions open generic detail', () => {
  const fromHome = { ...idle, tabUnderneath: 'home' as const };

  assert.deepEqual(ops(planTransition(fromHome, { type: 'openProduct', itemId: 17 })), ['push /product/17?origin=home', 'await product/[id]']);
  assert.deepEqual(ops(planTransition(fromHome, { type: 'openMission', missionId: 904, sellItemId: 17 })), ['push /product/17?origin=home', 'await product/[id]']);
  assert.deepEqual(ops(planTransition(fromHome, { type: 'openMission', missionId: 904 })), ['push /opportunities/904?origin=home', 'await (secondary)']);
  assert.deepEqual(ops(planTransition(fromHome, { type: 'openMission', missionId: 904, sellItemId: null })), ['push /opportunities/904?origin=home', 'await (secondary)']);
});

test('an explicit origin wins over the tab underneath, and a cold start falls back to Sell for products and Home for missions', () => {
  assert.deepEqual(ops(planTransition(idle, { type: 'openProduct', itemId: 3, origin: 'freelance' }))[0], 'push /product/3?origin=freelance');

  const cold = { ...idle, tabUnderneath: null };

  assert.deepEqual(ops(planTransition(cold, { type: 'openProduct', itemId: 3 }))[0], 'push /product/3?origin=sell');
  assert.deepEqual(ops(planTransition(cold, { type: 'openMission', missionId: 8 }))[0], 'push /opportunities/8?origin=home');
});

test('opening a detail over another top-level page closes it first and presents after UIKit has finished', () => {
  const secondary = { ...idle, tabUnderneath: 'home' as const, topLevel: { route: '(secondary)', origin: null, id: null } };
  const otherProduct = { ...idle, tabUnderneath: 'sell' as const, topLevel: { route: 'product/[id]', origin: 'home' as const, id: '4' } };

  assert.deepEqual(ops(planTransition(secondary, { type: 'openProduct', itemId: 17 })), [
    'back',
    'await (tabs)',
    'push /product/17?origin=home',
    'await product/[id]',
  ]);
  // The open page's own origin carries over.
  assert.deepEqual(ops(planTransition(otherProduct, { type: 'openProduct', itemId: 17 }))[2], 'push /product/17?origin=home');
});

test('the product that is already open is not opened again, and creation is never closed to open a detail', () => {
  const open = { ...idle, topLevel: { route: 'product/[id]', origin: null, id: '17' } };
  const creating = { ...idle, topLevel: { route: 'create/sell', origin: 'sell' as const, id: '17' } };

  assert.deepEqual(ops(planTransition(open, { type: 'openProduct', itemId: 17 })), ['ignore already-open']);
  assert.deepEqual(ops(planTransition(open, { type: 'openMission', missionId: 904, sellItemId: 17 })), ['ignore already-open']);
  assert.deepEqual(ops(planTransition(creating, { type: 'openProduct', itemId: 17 })), ['ignore creation-open']);
  assert.deepEqual(ops(planTransition(creating, { type: 'openMission', missionId: 9 })), ['ignore creation-open']);
});

test('web and Android open a detail without native waits', () => {
  const web = { ...idle, nativeSettle: false };

  assert.deepEqual(ops(planTransition(web, { type: 'openProduct', itemId: 2 })), ['push /product/2?origin=sell']);
});

type AppRoute = { name: string; key: string; params?: Record<string, unknown>; state?: unknown };
type AppStack = { index: number; routes: AppRoute[] };

/** The container state as Expo Router builds it: its one `__root` route holds the root layout, which holds (app). */
function expoRoot(app: AppStack) {
  return { routes: [{ name: '__root', key: 'root', state: { index: 0, routes: [{ name: '(app)', key: 'app', state: app }] } }] };
}

function appStack(state: ReturnType<typeof expoRoot>): AppStack {
  return state.routes[0].state.routes[0].state;
}

/** (tabs) on `tab`, plus whatever sits above it. */
function root(tab: string, above: AppRoute[] = []) {
  const tabs = { name: '(tabs)', key: 'tabs-1', state: { index: ['index', 'sell', 'freelance', 'build', 'recover'].indexOf(tab), routes: ['index', 'sell', 'freelance', 'build', 'recover'].map((name) => ({ name, key: name })) } };

  return expoRoot({ index: above.length, routes: [tabs, ...above] });
}

test('the snapshot reads the tab underneath and the origin of the page inside a top-level experience', () => {
  const creating = root('index', [{
    name: 'create/sell',
    key: 'create-1',
    params: { screen: 'setup/[id]', params: { id: '17', origin: 'home' } },
    state: { index: 0, routes: [{ name: 'setup/[id]', key: 'setup-1', params: { id: '17', origin: 'home' } }] },
  }]);
  const firstFrame = root('sell', [{ name: 'create/sell', key: 'create-1', params: { screen: 'new', params: { origin: 'freelance' } } }]);

  assert.deepEqual(readSnapshot(creating, false, true), { tabUnderneath: 'home', topLevel: { route: 'create/sell', origin: 'home', id: '17' }, pending: false, nativeSettle: true });
  assert.deepEqual(readSnapshot(firstFrame, false, true).topLevel, { route: 'create/sell', origin: 'freelance', id: null });
  assert.equal(readSnapshot(root('sell'), false, true).topLevel, null);
  assert.equal(readSnapshot(undefined, false, true).tabUnderneath, null);
});

/** A fake router: route changes apply at once, native completion arrives when the test says so. */
function harness(start: ReturnType<typeof root>) {
  let state = start;
  const calls: string[] = [];
  const logs: string[] = [];
  const nav = createNavigator();
  const tabsOnly = () => expoRoot({ index: 0, routes: [appStack(state).routes[0]] });

  nav.attach({
    getRootState: () => state,
    back: () => {
      calls.push('back');
      state = tabsOnly();
      nav.stateChanged();
    },
    dismissTo: (href) => {
      calls.push(`dismissTo ${href}`);
      state = tabsOnly();
      nav.stateChanged();
    },
    push: (href) => {
      calls.push(`push ${href}`);
      const app = appStack(state);
      const [path, query] = href.split('?');
      const params: Record<string, unknown> = { origin: new URLSearchParams(query).get('origin') };
      const name = path.startsWith('/product/')
        ? 'product/[id]'
        : path.startsWith('/opportunities/') || path === '/settings' || path === '/progress'
          ? '(secondary)'
          : path.startsWith('/create/sell')
            ? 'create/sell'
            : path.slice(1);

      if (name === 'product/[id]') {
        params.id = path.split('/')[2];
      }

      const page = { name, key: `${name}-${calls.length}`, params };
      state = expoRoot({ index: app.routes.length, routes: [...app.routes, page] });
      nav.stateChanged();
    },
    setParams: (params) => calls.push(`setParams ${JSON.stringify(params)}`),
    notify: (message) => calls.push(`toast ${message}`),
    log: (event) => logs.push(event),
    nativeSettle: true,
  });
  nav.stateChanged();

  return {
    nav,
    calls,
    logs,
    setState(next: ReturnType<typeof root>) {
      state = next;
      nav.stateChanged();
    },
    /** The route state changed, and the container has not reported it yet. */
    setStateUnreported(next: ReturnType<typeof root>) {
      state = next;
    },
  };
}

test('Continue Setup does not present until the dismissal has finished natively', () => {
  const { nav, calls, logs } = harness(root('sell', [{ name: 'product/[id]', key: 'product-1', params: { id: '17' } }]));

  nav.resumeCreation('sell', 17);
  assert.deepEqual(calls, ['back']);

  nav.nativeSettled();
  assert.deepEqual(calls, ['back', 'push /create/sell/setup/17?origin=sell']);

  nav.nativeSettled();
  assert.deepEqual(logs.filter((line) => line.startsWith('transition') || line === 'creation.presented'), [
    'transition.dismiss.request',
    'transition.dismiss.finished',
    'transition.present.request',
    'creation.presented',
  ]);
});

test('double tapping Continue Setup starts one handoff', () => {
  const { nav, calls, logs } = harness(root('sell', [{ name: 'product/[id]', key: 'product-1' }]));

  nav.resumeCreation('sell', 17);
  nav.resumeCreation('sell', 17);
  nav.nativeSettled();
  nav.resumeCreation('sell', 17);
  nav.nativeSettled();
  nav.resumeCreation('sell', 17);

  assert.deepEqual(calls, ['back', 'push /create/sell/setup/17?origin=sell']);
  assert.equal(logs.filter((line) => line === 'intent.ignored').length, 3);
});

test('if something else takes over the stack during the handoff, creation is not stacked on top', () => {
  const { nav, calls, logs, setState } = harness(root('sell', [{ name: 'product/[id]', key: 'product-1' }]));

  nav.resumeCreation('sell', 17);
  // A card tap pushed another product while the first one was still dismissing.
  setState(root('sell', [{ name: 'product/[id]', key: 'product-2' }]));
  nav.nativeSettled();

  assert.deepEqual(calls, ['back']);
  assert.ok(logs.includes('transition.aborted'));

  nav.nativeSettled();
  nav.resumeCreation('sell', 17);
  assert.deepEqual(calls, ['back', 'back']);
});

test('a request while another modal is still animating waits for it, then runs once', () => {
  const { nav, calls, setState } = harness(root('sell', [{ name: 'product/[id]', key: 'product-1' }]));

  // Product Detail was closed with its own Close button. UIKit is still animating.
  setState(root('sell'));
  nav.startCreation('sell');
  nav.startCreation('sell');
  assert.deepEqual(calls, []);

  nav.nativeSettled();
  assert.deepEqual(calls, ['push /create/sell/new?origin=sell']);
});

test('a redirect page that asks on mount waits for its own present before closing it', () => {
  const { nav, calls, setStateUnreported } = harness(root('sell'));

  // /opportunities/new?mode=sell mounts and asks for creation before the container's state event.
  setStateUnreported(root('sell', [{ name: '(secondary)', key: 'secondary-1' }]));
  nav.startCreation('sell');
  assert.deepEqual(calls, []);

  // The secondary modal finished presenting. Now it can close, then creation opens.
  nav.nativeSettled();
  assert.deepEqual(calls, ['back']);
  nav.nativeSettled();
  assert.deepEqual(calls, ['back', 'push /create/sell/new?origin=sell']);
});

test('Finish from creation opened on Home returns to Home after the modal has gone, then shows feedback', () => {
  const { nav, calls } = harness(root('sell', [{ name: 'create/sell', key: 'create-1', params: { origin: 'home' } }]));

  nav.finishCreation('Ready to list');
  assert.deepEqual(calls, ['dismissTo /']);

  nav.nativeSettled();
  assert.deepEqual(calls, ['dismissTo /', 'toast Ready to list']);
});

test('Finish closes creation after Continue setup, reading (app) inside the __root route (device A, item 17)', () => {
  const { nav, calls, logs } = harness(root('sell', [{ name: 'product/[id]', key: 'product-1', params: { id: '17' } }]));

  // With (app) unread, this pushed over Product Detail, aborted with no top, and Finish logged nothing-open.
  nav.resumeCreation('sell', 17);
  nav.nativeSettled();
  nav.nativeSettled();
  nav.finishCreation('Ready to list');
  nav.nativeSettled();

  assert.deepEqual(calls, ['back', 'push /create/sell/setup/17?origin=sell', 'back', 'toast Ready to list']);
  assert.ok(!logs.includes('transition.aborted'));
  assert.ok(!logs.includes('intent.ignored'));
});

test('Money Hunt on the Sell tab presents its new draft straight away, and Save & exit returns to Sell', () => {
  const { nav, calls, logs } = harness(root('sell'));

  nav.resumeCreation('sell', 24);
  assert.deepEqual(calls, ['push /create/sell/setup/24?origin=sell']);

  nav.nativeSettled();
  assert.ok(logs.includes('creation.presented'));

  nav.closeExperience();
  nav.nativeSettled();
  assert.deepEqual(calls, ['push /create/sell/setup/24?origin=sell', 'back']);
  assert.ok(!logs.includes('intent.ignored'));
  assert.ok(!logs.includes('transition.aborted'));
});

test('a navigator that is not attached ignores intents', () => {
  const nav = createNavigator();

  assert.doesNotThrow(() => {
    nav.startCreation('sell');
    nav.nativeSettled();
    nav.stateChanged();
  });
});

test('Home opens a Sell product once however many times it is tapped, and Close returns to Home', () => {
  const { nav, calls, logs } = harness(root('index'));

  nav.openMission(904, { sellItemId: 17 });
  nav.openMission(904, { sellItemId: 17 });
  nav.openProduct(17);
  nav.nativeSettled();
  nav.openProduct(17);

  assert.deepEqual(calls, ['push /product/17?origin=home']);
  assert.ok(logs.includes('detail.presented'));

  // Close: Product Detail calls closeExperience. The origin tab is the one underneath, so no tab switch.
  nav.closeExperience();
  nav.nativeSettled();
  assert.deepEqual(calls, ['push /product/17?origin=home', 'back']);
});

test('a different product tapped while one is presenting waits and is dropped, not stacked', () => {
  const { nav, calls } = harness(root('sell'));

  nav.openProduct(1);
  nav.openProduct(2);
  nav.nativeSettled();

  assert.deepEqual(calls, ['push /product/1?origin=sell']);
});

test('opening a product while another detail is closing waits for UIKit, then presents once', () => {
  const { nav, calls, setState } = harness(root('index', [{ name: '(secondary)', key: 'secondary-1' }]));

  // The user closed the mission page. UIKit is still animating.
  setState(root('index'));
  nav.openProduct(17);
  nav.openProduct(17);
  assert.deepEqual(calls, []);

  nav.nativeSettled();
  assert.deepEqual(calls, ['push /product/17?origin=home']);
});

test('a mission opens through the secondary page: close, wait, present', () => {
  const { nav, calls } = harness(root('index', [{ name: 'product/[id]', key: 'product-1', params: { id: '4' } }]));

  nav.openMission(904);
  assert.deepEqual(calls, ['back']);

  nav.nativeSettled();
  assert.deepEqual(calls, ['back', 'push /opportunities/904?origin=home']);
});

test('creation is left alone when a detail is requested', () => {
  const { nav, calls, logs } = harness(root('sell', [{ name: 'create/sell', key: 'create-1', params: { origin: 'sell' } }]));

  nav.openProduct(17);

  assert.deepEqual(calls, []);
  assert.ok(logs.includes('intent.ignored'));
});

// ---- Stage 5 ----

test('every creation kind presents its own route over the tab it started from, once', () => {
  const kinds = [['freelance', 'create/freelance'], ['recover', 'create/recover'], ['build', 'create/build']] as const;

  for (const [kind, route] of kinds) {
    assert.deepEqual(ops(planTransition({ ...idle, tabUnderneath: 'home' }, { type: 'startCreation', kind })), [`push /${route}?origin=home`, `await ${route}`], kind);
    assert.deepEqual(ops(planTransition({ ...idle, tabUnderneath: null }, { type: 'startCreation', kind })), [`push /${route}?origin=${kind}`, `await ${route}`], `${kind} cold`);
    assert.deepEqual(ops(planTransition({ ...idle, topLevel: { route, origin: kind, id: null } }, { type: 'startCreation', kind })), ['ignore creation-open'], `${kind} open`);
  }
});

test('creation never opens over another creation, and Sell and Freelance creation exclude each other', () => {
  const sellOpen = { ...idle, topLevel: { route: 'create/sell', origin: 'sell' as const, id: null } };
  const freelanceOpen = { ...idle, topLevel: { route: 'create/freelance', origin: 'freelance' as const, id: null } };

  assert.deepEqual(ops(planTransition(sellOpen, { type: 'startCreation', kind: 'freelance' })), ['ignore creation-open']);
  assert.deepEqual(ops(planTransition(freelanceOpen, { type: 'startCreation', kind: 'sell' })), ['ignore creation-open']);
  assert.deepEqual(ops(planTransition(freelanceOpen, { type: 'openMission', missionId: 3 })), ['ignore creation-open']);
  assert.deepEqual(ops(planTransition(freelanceOpen, { type: 'openSecondary', href: '/progress' })), ['ignore creation-open']);
});

test('closing or finishing a single-screen creation returns to its origin, then to its own category when there is none', () => {
  const recover = { ...idle, tabUnderneath: 'recover' as const, topLevel: { route: 'create/recover', origin: 'recover' as const, id: null } };
  const fromHome = { ...idle, tabUnderneath: 'recover' as const, topLevel: { route: 'create/recover', origin: 'home' as const, id: null } };
  const cold = { ...idle, tabUnderneath: 'home' as const, topLevel: { route: 'create/freelance', origin: null, id: null } };

  assert.deepEqual(ops(planTransition(recover, { type: 'finishCreation' })), ['back', 'await (tabs)']);
  assert.deepEqual(ops(planTransition(fromHome, { type: 'finishCreation' })), ['dismissTo /', 'await (tabs)']);
  assert.deepEqual(ops(planTransition(cold, { type: 'closeExperience' })), ['dismissTo /freelance', 'await (tabs)']);
});

test('web runs the creation steps back to back', () => {
  const web = { ...idle, nativeSettle: false, tabUnderneath: 'freelance' as const };

  assert.deepEqual(ops(planTransition(web, { type: 'startCreation', kind: 'freelance' })), ['push /create/freelance?origin=freelance']);
  assert.deepEqual(ops(planTransition({ ...web, topLevel: { route: '(secondary)', origin: null, id: null } }, { type: 'openTab', tab: 'freelance', start: 'message' })), ['dismissTo /freelance?start=message']);
});

test('Profile and Progress: one push from a tab, close then present over another page, never over creation or themselves', () => {
  assert.deepEqual(ops(planTransition(idle, { type: 'openSecondary', href: '/settings?tab=profile' })), ['push /settings?tab=profile', 'await (secondary)']);
  assert.deepEqual(ops(planTransition({ ...idle, topLevel: { route: 'product/[id]', origin: null, id: '4' } }, { type: 'openSecondary', href: '/progress' })), [
    'back',
    'await (tabs)',
    'push /progress',
    'await (secondary)',
  ]);
  assert.deepEqual(ops(planTransition({ ...idle, topLevel: { route: '(secondary)', origin: null, id: null } }, { type: 'openSecondary', href: '/progress' })), ['ignore secondary-open']);
  assert.deepEqual(ops(planTransition({ ...idle, pending: true }, { type: 'openSecondary', href: '/progress' })), ['ignore pending']);
});

test('opening a tab needs an open experience, and sets its start param only after the dismissal has finished', () => {
  const mission = { ...idle, tabUnderneath: 'home' as const, topLevel: { route: '(secondary)', origin: 'home' as const, id: null } };

  assert.deepEqual(ops(planTransition(idle, { type: 'openTab', tab: 'freelance', start: 'message' })), ['ignore nothing-open']);
  assert.deepEqual(ops(planTransition(mission, { type: 'openTab', tab: 'freelance', start: 'message' })), ['dismissTo /freelance', 'await (tabs)', 'setParams']);
  assert.deepEqual(ops(planTransition(mission, { type: 'openTab', tab: 'freelance' })), ['dismissTo /freelance', 'await (tabs)']);
});

test('Message someone else: the tab opens at once, the sheet request waits for UIKit, and a double tap runs once', () => {
  const { nav, calls, logs } = harness(root('home', [{ name: '(secondary)', key: 'secondary-1', params: { origin: 'home' } }]));

  nav.openTab('freelance', 'message');
  nav.openTab('freelance', 'message');
  assert.deepEqual(calls, ['dismissTo /freelance']);

  nav.nativeSettled();
  assert.deepEqual(calls, ['dismissTo /freelance', 'setParams {"start":"message"}']);
  assert.ok(logs.includes('transition.dismiss.finished'));
  assert.equal(logs.filter((line) => line === 'intent.ignored').length, 1);
});

test('Message someone to Mission detail: the mission is presented once, and a second request is dropped', () => {
  const { nav, calls, logs } = harness(root('freelance'));

  // The sheet's onDismiss calls this, after the sheet has gone (sheet-handoff.ts).
  nav.openMission(77);
  nav.openMission(77);
  assert.deepEqual(calls, ['push /opportunities/77?origin=freelance']);

  nav.nativeSettled();
  assert.ok(logs.includes('detail.presented'));
  assert.equal(logs.filter((line) => line === 'intent.ignored').length, 1);
});

test('Add a lead from Freelance: one presentation, and Finish closes to Freelance with no tab change', () => {
  const { nav, calls, logs } = harness(root('freelance'));

  nav.startCreation('freelance');
  nav.startCreation('freelance');
  assert.deepEqual(calls, ['push /create/freelance?origin=freelance']);

  nav.nativeSettled();
  assert.ok(logs.includes('creation.presented'));

  nav.finishCreation();
  nav.nativeSettled();
  assert.deepEqual(calls, ['push /create/freelance?origin=freelance', 'back']);
});

test('if something else takes over while a tab is opening, its start param is not set', () => {
  const { nav, calls, logs, setState } = harness(root('home', [{ name: '(secondary)', key: 'secondary-1' }]));

  nav.openTab('freelance', 'message');
  setState(root('home', [{ name: 'product/[id]', key: 'product-9', params: { id: '9' } }]));
  nav.nativeSettled();

  assert.deepEqual(calls, ['dismissTo /freelance']);
  assert.ok(logs.includes('transition.aborted'));
});
