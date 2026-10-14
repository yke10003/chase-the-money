import assert from 'node:assert/strict';
import test from 'node:test';

import { createSheetHandoff } from './sheet-handoff';

function setup(ios: boolean) {
  const calls: string[] = [];
  const handoff = createSheetHandoff({ ios, close: () => calls.push('close'), log: (event) => calls.push(event) });

  return { calls, handoff };
}

test('on iOS the sheet closes first and the next presentation waits for its native dismissal', () => {
  const { calls, handoff } = setup(true);

  handoff.run(() => calls.push('open mission'));
  assert.deepEqual(calls, ['sheet.handoff', 'close']);

  handoff.dismissed();
  assert.deepEqual(calls, ['sheet.handoff', 'close', 'sheet.dismissed', 'open mission']);
});

test('the parked action runs once, however many times the sheet reports dismissal', () => {
  const { calls, handoff } = setup(true);

  handoff.run(() => calls.push('open mission'));
  handoff.dismissed();
  handoff.dismissed();

  assert.equal(calls.filter((call) => call === 'open mission').length, 1);
});

test('a plain close of the sheet opens nothing', () => {
  const { calls, handoff } = setup(true);

  handoff.dismissed();

  assert.deepEqual(calls, []);
});

test('a second request before the sheet has gone replaces the first, so only one thing opens', () => {
  const { calls, handoff } = setup(true);

  handoff.run(() => calls.push('open mission'));
  handoff.run(() => calls.push('open profile'));
  handoff.dismissed();

  assert.deepEqual(calls.filter((call) => call.startsWith('open')), ['open profile']);
});

test('off iOS there is no dismissal event, so the action runs right after the close', () => {
  const { calls, handoff } = setup(false);

  handoff.run(() => calls.push('open mission'));

  assert.deepEqual(calls, ['close', 'open mission']);
});
