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
  const product = { ...idle, tabUnderneath: 'home' as const, topLevel: { route: 'product/[id]', origin: null } };

  assert.deepEqual(ops(planTransition(product, { type: 'resumeCreation', kind: 'sell', itemId: 17 })), [
    'back',
    'await (tabs)',
    'push /create/sell/setup/17?origin=home',
    'await create/sell',
  ]);
});

test('an origin recorded on the open experience wins over the tab underneath', () => {
  const product = { ...idle, tabUnderneath: 'sell' as const, topLevel: { route: 'product/[id]', origin: 'home' as const } };

  assert.deepEqual(ops(planTransition(product, { type: 'resumeCreation', kind: 'sell', itemId: 4 }))[2], 'push /create/sell/setup/4?origin=home');
});

test('with no known tab, creation falls back to Sell', () => {
  const cold = { ...idle, tabUnderneath: null };

  assert.deepEqual(ops(planTransition(cold, { type: 'resumeCreation', kind: 'sell', itemId: 4 }))[0], 'push /create/sell/setup/4?origin=sell');
});

test('a second request while one is running, or while creation is open, is dropped', () => {
  assert.deepEqual(ops(planTransition({ ...idle, pending: true }, { type: 'startCreation', kind: 'sell' })), ['ignore pending']);

  const open = { ...idle, topLevel: { route: 'create/sell', origin: 'sell' as const } };
  assert.deepEqual(ops(planTransition(open, { type: 'resumeCreation', kind: 'sell', itemId: 4 })), ['ignore creation-open']);
});

test('Finish returns to the origin tab and shows feedback only after the modal has gone', () => {
  const creating = { ...idle, topLevel: { route: 'create/sell', origin: 'sell' as const } };

  assert.deepEqual(ops(planTransition(creating, { type: 'finishCreation', feedback: 'Ready to list' })), [
    'back',
    'await (tabs)',
    'toast Ready to list',
  ]);
  assert.deepEqual(ops(planTransition(creating, { type: 'closeExperience' })), ['back', 'await (tabs)']);
});

test('when the tab underneath is not the origin, closing switches to the origin in the same update', () => {
  const fromHome = { ...idle, tabUnderneath: 'sell' as const, topLevel: { route: 'create/sell', origin: 'home' as const } };
  const cold = { ...idle, tabUnderneath: 'home' as const, topLevel: { route: 'create/sell', origin: null } };

  assert.deepEqual(ops(planTransition(fromHome, { type: 'finishCreation' })), ['dismissTo /', 'await (tabs)']);
  assert.deepEqual(ops(planTransition(cold, { type: 'closeExperience' })), ['dismissTo /sell', 'await (tabs)']);
});

test('closing with nothing open does nothing', () => {
  assert.deepEqual(ops(planTransition(idle, { type: 'closeExperience' })), ['ignore nothing-open']);
});

test('web and Android run the same steps without native waits', () => {
  const web = { ...idle, nativeSettle: false, topLevel: { route: 'product/[id]', origin: null } };

  assert.deepEqual(ops(planTransition(web, { type: 'resumeCreation', kind: 'sell', itemId: 9 })), ['back', 'push /create/sell/setup/9?origin=sell']);
});

test('no plan replaces one top-level modal with another', () => {
  const snapshots: NavSnapshot[] = [
    idle,
    { ...idle, topLevel: { route: 'product/[id]', origin: null } },
    { ...idle, topLevel: { route: '(secondary)', origin: null } },
    { ...idle, topLevel: { route: 'create/sell', origin: 'home' } },
    { ...idle, tabUnderneath: null, nativeSettle: false },
  ];
  const intents = [
    { type: 'startCreation', kind: 'sell' },
    { type: 'startCreation', kind: 'sell-listed' },
    { type: 'resumeCreation', kind: 'sell', itemId: 1 },
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

  assert.deepEqual(readSnapshot(creating, false, true), { tabUnderneath: 'home', topLevel: { route: 'create/sell', origin: 'home' }, pending: false, nativeSettle: true });
  assert.deepEqual(readSnapshot(firstFrame, false, true).topLevel, { route: 'create/sell', origin: 'freelance' });
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
      const page = { name: 'create/sell', key: `create-${calls.length}`, params: { origin: new URLSearchParams(href.split('?')[1]).get('origin') } };
      state = expoRoot({ index: app.routes.length, routes: [...app.routes, page] });
      nav.stateChanged();
    },
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
