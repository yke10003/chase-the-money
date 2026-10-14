import assert from 'node:assert/strict';
import test from 'node:test';

import { createDiscardGuard, isDirty } from './discard';
import { editIsDirty } from './photo-edit';
import { valueDraft, withUnknown } from './value-edit';

test('a form that is unchanged is clean, and blank means the same as missing', () => {
  assert.equal(isDirty({ name: 'Jacket', brand: '' }, { name: 'Jacket' }), false);
  assert.equal(isDirty({ name: 'Jacket', brand: null }, { brand: '', name: ' Jacket ' }), false);
  assert.equal(isDirty({ details: { size: 'M' } }, { details: { size: 'M', color: '' } }), false);
});

test('a typed change makes a form dirty, and putting it back makes it clean again', () => {
  const opened = { name: 'Jacket', condition: 'good', details: { size: 'M' } };

  assert.equal(isDirty(opened, { ...opened, name: 'Versace jacket' }), true);
  assert.equal(isDirty(opened, { ...opened, condition: 'new' }), true);
  assert.equal(isDirty(opened, { ...opened, details: { size: 'L' } }), true);
  assert.equal(isDirty(opened, { ...opened, name: 'Versace jacket' }), true);
  assert.equal(isDirty(opened, { ...opened, name: 'Jacket' }), false);
});

test('the value editor is dirty after typing or choosing unknown, not after opening', () => {
  const item = { value_min_minor: 40000, value_max_minor: 60000 };
  const opened = valueDraft(item);

  assert.equal(isDirty(opened, valueDraft(item)), false);
  assert.equal(isDirty(opened, { ...opened, low: '450' }), true);
  assert.equal(isDirty(opened, withUnknown(opened, true)), true);
  assert.equal(isDirty(opened, withUnknown(withUnknown(opened, true), false)), false);
});

test('a collage is dirty once a slot, a zoom or the background differs from the saved layout', () => {
  const saved = { background: '#FFFFFF', left: { id: 1, zoom: 1 }, top: { id: 2, zoom: 1 }, bottom: { id: null, zoom: 1 } };

  assert.equal(isDirty(saved, { ...saved }), false);
  assert.equal(isDirty(saved, { ...saved, bottom: { id: 3, zoom: 1 } }), true);
  assert.equal(isDirty(saved, { ...saved, left: { id: 1, zoom: 1.2 } }), true);
  assert.equal(isDirty(saved, { ...saved, background: '#000000' }), true);
});

test('Edit Photo is dirty only for an edit that is not saved yet', () => {
  const saved = { hasEdit: false, background: '#FFFFFF' };
  const raw = { uri: 'a', kind: 'raw' as const, fresh: false, transparent: false, background: '#FFFFFF' };

  assert.equal(editIsDirty(null, saved), false);
  assert.equal(editIsDirty(raw, saved), false);
  assert.equal(editIsDirty({ ...raw, kind: 'cut', fresh: true, transparent: true }, saved), true);
  assert.equal(editIsDirty(raw, { hasEdit: true, background: '#FFFFFF' }), true);
  assert.equal(editIsDirty({ ...raw, kind: 'cut', transparent: true, background: '#FF0000' }, saved), true);
});

test('two requests to leave show one dialog, and the second is answered no', async () => {
  let dialogs = 0;
  let answer: (discard: boolean) => void = () => {};
  const guard = createDiscardGuard(() => {
    dialogs += 1;

    return new Promise<boolean>((resolve) => {
      answer = resolve;
    });
  });

  const swipe = guard.request();
  const closeTap = guard.request();

  assert.equal(await closeTap, false);
  assert.equal(dialogs, 1);

  answer(true);
  assert.equal(await swipe, true);

  // Answered, so the next attempt may ask again.
  const again = guard.request();
  answer(false);

  assert.equal(await again, false);
  assert.equal(dialogs, 2);
});

test('Keep editing answers no, and a dialog that throws does not block the next one', async () => {
  let fail = true;
  const guard = createDiscardGuard(async () => {
    if (fail) {
      throw new Error('alert failed');
    }

    return true;
  });

  await assert.rejects(guard.request());
  fail = false;
  assert.equal(await guard.request(), true);
});
