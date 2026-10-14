import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { journeyIndex, listingDraft, openShot, parseEstimate, shotAfter } from './sell';

test('the journey index follows the sell setup order', () => {
  assert.equal(journeyIndex('category'), 0);
  assert.equal(journeyIndex('photos'), 2);
  assert.equal(journeyIndex('estimate'), 5);
  assert.equal(journeyIndex('description'), 6);
  assert.equal(journeyIndex('done'), 6);
});

test('a skipped photo does not reopen, and the listing draft does not rename the product', () => {
  const plan = [
    { key: 'main', recommended: true, taken: true },
    { key: 'back', recommended: true },
    { key: 'damage', recommended: false, skipped: true },
  ];

  assert.equal(openShot(plan), 'back');
  assert.equal(openShot(plan.map((shot) => shot.key === 'back' ? { ...shot, skipped: true } : shot)), null);
  assert.equal(shotAfter(plan, 'main'), 'back');
  assert.equal(shotAfter(plan, 'back'), null);
  assert.deepEqual(listingDraft({ name: 'Versace jacket', listing_title: null, listing_description: null }), {
    title: 'Versace jacket',
    description: '',
  });
  assert.deepEqual(listingDraft({ name: 'Versace jacket', listing_title: 'Versace zwarte jas', listing_description: 'Maat M.' }), {
    title: 'Versace zwarte jas',
    description: 'Maat M.',
  });
});

test('guided photos do not reuse another shot, and estimate does not ask for confidence', () => {
  const setup = readFileSync(new URL('../app/(app)/create/sell/setup/[id].tsx', import.meta.url), 'utf8');

  assert.equal(setup.includes('opacity: 0.35'), false);
  assert.equal(setup.includes('Pretty sure'), false);
  assert.equal(setup.includes("shot === 'review'"), false);
  assert.equal(setup.includes('if (item.setup_step === held.step)'), true);
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

test('Find something opens Money Hunt at the top of the Sell sheet, and a found item hands off to the creation modal', () => {
  const sell = readFileSync(new URL('../app/(app)/(tabs)/sell/index.tsx', import.meta.url), 'utf8');
  const discover = readFileSync(new URL('../app/(app)/discover.tsx', import.meta.url), 'utf8');
  const below = sell.slice(sell.indexOf('below={'));
  const hunt = discover.slice(discover.indexOf('export function MoneyHunt'), discover.indexOf('return (', discover.indexOf('export function MoneyHunt')));

  // On iOS phone the resting cockpit sheet shows only its top. Below the board, the hunt opened off-screen.
  assert.ok(below.indexOf('<MoneyHunt') >= 0);
  assert.ok(below.indexOf('<MoneyHunt') < below.indexOf('<SellBoard'));
  assert.equal(sell.includes("label: 'Find something'"), true);
  assert.equal(sell.includes('setHunt(!hunt)'), true);

  assert.equal(hunt.includes("navigation.resumeCreation('sell', created.data.id)"), true);
  assert.equal(hunt.includes('router.push'), false);
  // The hunt stays mounted under the modal. A stuck busy Start would greet the user when creation closes.
  assert.ok(hunt.indexOf('setBusy(false)', hunt.indexOf('navigation.resumeCreation')) > 0);
});

test('starting a sale does not offer another cockpit', () => {
  const source = readFileSync(new URL('../app/(app)/create/sell/new.tsx', import.meta.url), 'utf8');

  assert.equal(source.includes('Freelance'), false);
  assert.equal(source.includes('Recover'), false);
  assert.equal(source.includes('need_value'), false);
});
