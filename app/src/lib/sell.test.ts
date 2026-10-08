import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { journeyIndex, parseEstimate } from './sell';

test('the journey index follows the sell setup order', () => {
  assert.equal(journeyIndex('category'), 0);
  assert.equal(journeyIndex('photos'), 2);
  assert.equal(journeyIndex('estimate'), 5);
  assert.equal(journeyIndex('done'), 5);
});

test('an empty estimate stays unknown and a range stays a range', () => {
  assert.deepEqual(parseEstimate('', '', false), { unknown: true });
  assert.deepEqual(parseEstimate('450', '', false), {
    unknown: false,
    value_min_minor: 45000,
    value_max_minor: 45000,
  });
  assert.deepEqual(parseEstimate('400', '600', false), {
    unknown: false,
    value_min_minor: 40000,
    value_max_minor: 60000,
  });
  assert.equal('error' in parseEstimate('600', '400', false), true);
});

test('starting a sale does not offer another cockpit', () => {
  const source = readFileSync(new URL('../app/(app)/sell/new.tsx', import.meta.url), 'utf8');

  assert.equal(source.includes('Freelance'), false);
  assert.equal(source.includes('Recover'), false);
  assert.equal(source.includes('need_value'), false);
});
