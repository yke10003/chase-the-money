import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canRedo,
  canReset,
  canUndo,
  currentStep,
  editIsDirty,
  pushStep,
  recolorStep,
  redoEdit,
  resetEdit,
  seedHistory,
  undoEdit,
  type EditStep,
} from './photo-edit';

const raw: EditStep = { uri: 'raw', kind: 'raw', fresh: false, transparent: false, background: '#FFFFFF' };
const cut: EditStep = { uri: 'cut', kind: 'cut', fresh: true, transparent: true, background: '#FFFFFF' };

test('undo and redo walk the edit stack and a new edit drops the future', () => {
  const seeded = seedHistory([raw]);
  const removed = pushStep(seeded, cut);
  const undone = undoEdit(removed);

  assert.equal(currentStep(undone)?.uri, 'raw');
  assert.equal(canUndo(undone), false);
  assert.equal(canRedo(undone), true);
  assert.equal(currentStep(redoEdit(undone))?.uri, 'cut');

  const cropped: EditStep = { uri: 'crop', kind: 'cut', fresh: true, transparent: false, background: '#FFFFFF' };
  const replaced = pushStep(undone, cropped);

  assert.equal(canRedo(replaced), false);
  assert.equal(currentStep(replaced)?.uri, 'crop');
  const untouched = seedHistory([raw]);
  assert.equal(undoEdit(untouched), untouched);
});

test('background removal undo restores the photo underneath, including earlier edits', () => {
  const cropped: EditStep = { uri: 'crop', kind: 'cut', fresh: true, transparent: false, background: '#FFFFFF' };
  const history = pushStep(pushStep(seedHistory([raw]), cropped), cut);
  const undone = undoEdit(history);

  assert.equal(currentStep(undone)?.uri, 'crop');
  assert.equal(editIsDirty(currentStep(undone), { hasEdit: false, background: '#FFFFFF' }), true);
});

test('reset returns to the original and a color change stays undoable', () => {
  const colored = recolorStep(pushStep(seedHistory([raw]), cut), '#000000');

  assert.equal(currentStep(colored)?.background, '#000000');
  assert.equal(currentStep(colored)?.fresh, true);
  assert.equal(currentStep(undoEdit(colored))?.background, '#FFFFFF');
  assert.equal(currentStep(resetEdit(colored))?.uri, 'raw');
  assert.equal(canReset(seedHistory([raw])), false);
  assert.equal(recolorStep(seedHistory([raw, { ...cut, fresh: false }]), '#ffffff').steps.length, 2);
});

test('dirty tracks unsaved pixels, a cleared edit, and a new background', () => {
  const saved = { hasEdit: true, background: '#FFFFFF' };
  const kept = seedHistory([raw, { ...cut, fresh: false }]);

  assert.equal(editIsDirty(currentStep(kept), saved), false);
  assert.equal(editIsDirty(currentStep(resetEdit(kept)), saved), true);
  assert.equal(editIsDirty(currentStep(recolorStep(kept, '#D5E1EB')), saved), true);
  assert.equal(editIsDirty(currentStep(seedHistory([raw])), { hasEdit: false, background: '#FFFFFF' }), false);
});
