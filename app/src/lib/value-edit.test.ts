import assert from 'node:assert/strict';
import test from 'node:test';

import { parseValueEdit, valueDraft, withUnknown } from './value-edit';

test('an unknown value opens with empty inputs and unknown turned off', () => {
  assert.deepEqual(valueDraft({ value_min_minor: null, value_max_minor: null }), {
    low: '',
    high: '',
    unknown: false,
  });
});

test('a saved amount and range are prefilled', () => {
  assert.deepEqual(valueDraft({ value_min_minor: 45000, value_max_minor: 60000 }), {
    low: '450',
    high: '600',
    unknown: false,
  });
  assert.deepEqual(valueDraft({ value_min_minor: 45000, value_max_minor: 45000 }), {
    low: '450',
    high: '',
    unknown: false,
  });
});

test('unknown keeps typed amounts, and a blank form is not saved as a value', () => {
  const typed = withUnknown({ low: '450', high: '600', unknown: false }, true);

  assert.deepEqual(typed, { low: '450', high: '600', unknown: true });
  assert.deepEqual(withUnknown(typed, false).low, '450');
  assert.deepEqual(parseValueEdit(typed), { value_min_minor: null, value_max_minor: null });
  assert.equal('error' in parseValueEdit({ low: '', high: '', unknown: false }), true);
  assert.deepEqual(parseValueEdit({ low: '450', high: '', unknown: false }), {
    value_min_minor: 45000,
    value_max_minor: 45000,
  });
  assert.equal('value_confidence' in parseValueEdit({ low: '450', high: '600', unknown: false }), false);
});
