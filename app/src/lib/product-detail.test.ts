import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { coverIndex, itemLeaf, listingPlace, listingStatus, movePhoto, productFacts, samePhotoOrder, shotLabel } from './product-detail';

test('the gallery opens on the cover and keeps the saved order', () => {
  assert.equal(coverIndex([]), 0);
  assert.equal(coverIndex([{ is_cover: false }, { is_cover: true }, { is_cover: false }]), 1);
  assert.equal(coverIndex([{ is_cover: false }, { is_cover: false }]), 0);
});

test('product facts skip empty catalog fields and do not repeat brand', () => {
  const rows = productFacts(
    {
      brand: 'Versace',
      condition_label: 'Good',
      details: { size: 'M', material: '', model: 'Medusa' },
    },
    [
      { key: 'brand', label: 'Brand' },
      { key: 'size', label: 'Size' },
      { key: 'material', label: 'Material' },
      { key: 'model', label: 'Model' },
    ],
  );

  assert.deepEqual(rows, [
    { label: 'Brand', value: 'Versace' },
    { label: 'Condition', value: 'Good' },
    { label: 'Size', value: 'M' },
    { label: 'Model', value: 'Medusa' },
  ]);
});

test('photo tools stay inside the photos sheet', () => {
  assert.equal(itemLeaf('/product/4', 4, 'edit'), '/product/4/photos/edit');
  assert.equal(itemLeaf('/product/4/photos', 4, 'background'), '/product/4/photos/background');
  assert.equal(itemLeaf('/sell/items/4/edit', 4, 'collage'), '/sell/items/4/collage');
});

test('reordering moves the photo and keeps its cover flag', () => {
  const photos = [
    { id: 1, is_cover: true, shot: 'main' },
    { id: 2, is_cover: false, shot: 'back' },
    { id: 3, is_cover: false, shot: 'detail' },
  ];
  const moved = movePhoto(photos, 0, 2);

  assert.deepEqual(moved.map((photo) => photo.id), [2, 3, 1]);
  assert.equal(moved.find((photo) => photo.is_cover)?.id, 1);
  assert.equal(samePhotoOrder(photos, moved), false);
  assert.equal(samePhotoOrder(photos, movePhoto(photos, 1, 1)), true);
  assert.equal(shotLabel('main', null), 'Front');
  assert.equal(shotLabel(null, { slots: [] }), 'Collage');
  assert.equal(shotLabel(null, null), 'Photo');
  assert.equal(listingStatus('sold'), 'Sold');
  assert.equal(listingStatus('asking'), 'Asking');
  assert.equal(listingPlace('Grailed', 'https://www.grailed.com/listings/1'), 'Grailed');
  assert.equal(listingPlace(null, 'https://www.ebay.com/itm/1'), 'ebay.com');
  assert.equal(listingPlace('', 'not a url'), 'Listing');
});

test('a sell card opens the product page, and creation still owns setup', () => {
  const board = readFileSync(new URL('../app/(app)/(tabs)/sell/index.tsx', import.meta.url), 'utf8');
  const setup = readFileSync(new URL('../app/(app)/create/sell/setup/[id].tsx', import.meta.url), 'utf8');

  assert.equal(board.includes('router.push(`/product/${item.id}`)'), true);
  assert.equal(board.includes('`/sell/items/${item.id}`'), false);
  // Replacing the creation modal with Product Detail is a modal-to-modal replace (navigation.md, E3).
  assert.equal(setup.includes('router.replace(`/product/'), false);
  assert.equal(setup.includes('Ready for the next step'), false);
  assert.equal(setup.includes("shot === 'review'"), false);
});
