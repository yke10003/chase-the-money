import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import type { ListingAvailability } from './listing-generation';
import type { SellCatalog, SellItemView } from '@/api/types';
import { listingFacts, type ListingFact } from './listing-facts';
import {
  applyStyleResult,
  conditionOmission,
  LISTING_STYLES,
  outputLanguage,
  pressStyle,
  resolveOverwrite,
  styleBlockedReason,
  styleInstructions,
  stylePhotoCount,
  styleRequest,
} from './listing-styles';

const ready: Extract<ListingAvailability, { state: 'ready' }> = {
  state: 'ready',
  vision: true,
  contextSize: 4096,
  supportsEnglish: true,
  supportsDutch: true,
};

const facts: ListingFact[] = [
  { label: 'Product name', value: 'Noir jacket' },
  { label: 'Brand', value: 'Example' },
  { label: 'Condition', value: 'New' },
  { label: 'Size', value: 'S' },
];

const photos = ['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'];

test('each style keeps its own writing strategy and the same factual close', () => {
  const a = styleInstructions('a', 'en');
  const b = styleInstructions('b', 'en');
  const c = styleInstructions('c', 'en');

  assert.match(a, /like a real person selling an item/);
  assert.match(b, /Avoid keyword stuffing/);
  assert.match(c, /must-have/);
  assert.equal(a.includes('Avoid keyword stuffing'), false);
  assert.equal(b.includes('must-have'), false);
  assert.equal(a.includes('No marketing filler'), false);
  assert.equal(a.includes('M+RC'), false);
  assert.equal(a.includes('graffiti-print jacket'), false);

  const d = styleInstructions('d', 'en');

  for (const text of [a, b, c, d]) {
    assert.match(text, /Confirmed labeled facts stay in the description/);
    assert.match(text, /Requested language: English/);
  }

  assert.match(d, /especially when the item is new/);
  assert.equal(d.includes('M+RC'), false);
  assert.equal(d.includes('original tags, bag and spare button'), false);
  assert.notEqual(a, b);
  assert.notEqual(b, c);
  assert.notEqual(c, d);
});

test('all four styles send the same facts, photos and language', () => {
  const requests = LISTING_STYLES.map((style) => styleRequest({ style, language: 'nl', facts, photoPaths: photos }));

  assert.deepEqual(LISTING_STYLES, ['a', 'b', 'c', 'd']);
  assert.deepEqual(requests.map((request) => request.facts), [facts, facts, facts, facts]);
  assert.deepEqual(requests.map((request) => request.photoPaths), [photos, photos, photos, photos]);
  assert.deepEqual(requests.map((request) => request.language), ['nl', 'nl', 'nl', 'nl']);
  assert.equal(new Set(requests.map((request) => request.instructions)).size, 4);
  assert.match(requests[0].instructions ?? '', /Requested language: Dutch/);
  assert.match(requests[0].facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n'), /Condition: New/);
});

test('vision uses three photos and a text-only model uses none', () => {
  assert.equal(stylePhotoCount(ready), 3);
  assert.equal(stylePhotoCount({ ...ready, vision: false }), 0);
  assert.equal(stylePhotoCount({ state: 'unavailable', reason: 'modelNotReady' }), 0);
  assert.equal(stylePhotoCount({ state: 'unsupported' }), 0);
});

test('an empty description starts immediately and existing text asks first', () => {
  assert.deepEqual(pressStyle({ description: '', running: false }, 'a'), { kind: 'start', style: 'a', baseline: '' });
  assert.deepEqual(pressStyle({ description: '   ', running: false }, 'b'), { kind: 'start', style: 'b', baseline: '   ' });
  assert.deepEqual(pressStyle({ description: 'Style A text', running: false }, 'c'), { kind: 'confirm', style: 'c' });
  assert.deepEqual(pressStyle({ description: '', running: true }, 'a'), { kind: 'ignored' });
});

test('cancel keeps the description, and overwrite starts from that same text', () => {
  assert.deepEqual(resolveOverwrite({ confirmed: false, style: 'b', description: 'Style A text', baseline: 'Style A text' }), { kind: 'cancelled' });
  assert.deepEqual(resolveOverwrite({ confirmed: true, style: 'b', description: 'Style A text', baseline: 'Style A text' }), {
    kind: 'start',
    style: 'b',
    baseline: 'Style A text',
  });
  assert.deepEqual(resolveOverwrite({ confirmed: true, style: 'b', description: 'Edited while asking', baseline: 'Style A text' }), { kind: 'stale' });
});

test('a result replaces the description only when that generation is still current', () => {
  const applied = applyStyleResult({
    activeId: 4,
    resultId: 4,
    description: 'Style A text',
    baseline: 'Style A text',
    title: 'Kept title',
    generated: 'Style B text',
  });

  assert.deepEqual(applied, { description: 'Style B text', title: 'Kept title', applied: true });

  const edited = applyStyleResult({
    activeId: 4,
    resultId: 4,
    description: 'I typed this',
    baseline: 'Style A text',
    title: 'Kept title',
    generated: 'Style B text',
  });

  assert.deepEqual(edited, { description: 'I typed this', title: 'Kept title', applied: false });

  const dropped = applyStyleResult({
    activeId: null,
    resultId: 4,
    description: 'Style A text',
    baseline: 'Style A text',
    title: 'Kept title',
    generated: 'Style C text',
  });

  assert.deepEqual(dropped, { description: 'Style A text', title: 'Kept title', applied: false });
});

test('a saved condition is a confirmed fact, and a missing label falls back to the stored key', () => {
  const catalog = {
    categories: [{
      key: 'wardrobe',
      identity: [{ key: 'brand', label: 'Brand' }],
      details: [
        { key: 'size', label: 'Size' },
        { key: 'material', label: 'Material' },
        { key: 'flaws', label: 'Obvious flaws' },
      ],
    }],
  } as SellCatalog;
  const item = {
    category: 'wardrobe',
    category_label: 'Wardrobe & fashion',
    subcategory_label: 'Jacket / coat',
    name: 'Noir jacket',
    brand: 'Example',
    condition: 'new',
    condition_label: 'New / unused',
    details: { size: 'S', material: 'Cotton', flaws: '' },
  } as SellItemView;
  const built = listingFacts(item, catalog);

  assert.deepEqual(built.find((fact) => fact.label === 'Condition'), { label: 'Condition', value: 'New / unused' });
  assert.deepEqual(built.find((fact) => fact.label === 'Size'), { label: 'Size', value: 'S' });
  assert.equal(built.some((fact) => fact.label === 'Obvious flaws'), false);
  assert.equal(built.some((fact) => /tag|packaging|spare/i.test(fact.label)), false);

  const unlabeled = listingFacts({ ...item, condition_label: null }, catalog);

  assert.deepEqual(unlabeled.find((fact) => fact.label === 'Condition'), { label: 'Condition', value: 'new' });
});

test('a missing condition is only a warning', () => {
  const condition = [{ label: 'Condition', value: 'New / unused' }];

  assert.equal(conditionOmission(condition, 'Nieuwe jas in maat S.'), null);
  assert.equal(conditionOmission(condition, 'Black jacket, size S.'), 'Confirmed condition “New / unused” is not in this description.');
  assert.equal(conditionOmission([{ label: 'Size', value: 'S' }], 'Black jacket.'), null);
});

test('unavailable devices explain themselves and do not offer generation', () => {
  assert.equal(styleBlockedReason(undefined), 'Checking Apple Intelligence…');
  assert.equal(styleBlockedReason({ state: 'unsupported' }), 'On-device generation is not available on this device.');
  assert.equal(styleBlockedReason({ state: 'unavailable', reason: 'modelNotReady' }), 'The on-device model is still preparing.');
  assert.equal(styleBlockedReason({ state: 'unavailable', reason: 'appleIntelligenceNotEnabled' }), 'Apple Intelligence is off in Settings.');
  assert.equal(styleBlockedReason({ state: 'unavailable', reason: 'deviceNotEligible' }), 'This iPhone cannot run Apple Intelligence.');
  assert.equal(styleBlockedReason(ready), null);
  assert.equal(outputLanguage(ready, 'nl-NL'), 'nl');
  assert.equal(outputLanguage({ ...ready, supportsDutch: false }, 'nl-NL'), 'en');
  assert.equal(outputLanguage(ready, 'en-US'), 'en');
});

test('the description step asks before replacing text and does not save a style by itself', () => {
  const setup = readFileSync(new URL('../app/(app)/create/sell/setup/[id].tsx', import.meta.url), 'utf8');

  assert.equal(setup.includes('Replace description?'), true);
  assert.equal(setup.includes('Existing text will be overwritten.'), true);
  assert.equal(setup.includes('pressStyle'), true);
  assert.equal(setup.includes('applyStyleResult'), true);
  assert.equal(setup.includes('__DEV__'), true);
  assert.equal(setup.includes("label=\"Listing title\""), true);
  assert.equal(setup.includes('setListingTitle(result'), false);
});
