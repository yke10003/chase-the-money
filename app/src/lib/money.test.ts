import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMoney, formatPotential, majorToMinor } from './money.ts';

test('formats minor units without treating them as floats', () => {
  assert.equal(formatMoney(40000, 'EUR'), '€400.00');
  assert.equal(formatMoney(410, 'EUR'), '€4.10');
  assert.equal(formatMoney(5, 'EUR'), '€0.05');
  assert.equal(formatMoney(0, 'EUR'), '€0.00');
  assert.equal(formatMoney(null, 'EUR'), '—');
});

test('parses a major-unit input into minor units', () => {
  assert.equal(majorToMinor('2000'), 200000);
  assert.equal(majorToMinor('20.5'), 2050);
  assert.equal(majorToMinor('20.50'), 2050);
  assert.equal(majorToMinor(''), null);
  assert.equal(majorToMinor('20.555'), null);
  assert.equal(majorToMinor('-1'), null);
});

test('keeps a potential range instead of inventing a midpoint', () => {
  assert.equal(formatPotential(60000, 860000, 'EUR'), '€600.00–€8,600.00');
  assert.equal(formatPotential(20000, 20000, 'EUR'), '€200.00');
  assert.equal(formatPotential(null, null, 'EUR'), 'Not valued');
});
