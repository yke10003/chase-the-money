import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { comparableDraft, coverIndex, itemLeaf, listingPlace, listingStatus, movePhoto, productFacts, productNameInput, samePhotoOrder, shotLabel } from './product-detail';

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
  assert.equal(itemLeaf(4, 'edit'), '/product/4/photos/edit');
  assert.equal(itemLeaf(4, 'collage'), '/product/4/photos/collage');
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

test('a similar listing link is normalized, and the product name stays off the listing title', () => {
  assert.deepEqual(comparableDraft({ url: '  vinted.com/abc?id=1#photo  ', amount: '45', state: 'sold' }), {
    url: 'https://vinted.com/abc?id=1#photo',
    amount_minor: 4500,
    state: 'sold',
  });
  assert.deepEqual(comparableDraft({ url: 'https://vinted.com/abc', amount: '12.50', state: 'asking' }), {
    url: 'https://vinted.com/abc',
    amount_minor: 1250,
    state: 'asking',
  });
  assert.equal('error' in comparableDraft({ url: 'javascript:alert(1)', amount: '10', state: 'sold' }), true);
  assert.equal('error' in comparableDraft({ url: 'vinted.com/abc', amount: '', state: 'sold' }), true);

  assert.deepEqual(productNameInput('  Navy coat  '), { name: 'Navy coat' });
  assert.equal('error' in productNameInput('   '), true);
  assert.equal('error' in productNameInput('n'.repeat(121)), true);

  const page = readFileSync(new URL('../components/product-page.tsx', import.meta.url), 'utf8');
  const details = page.slice(page.indexOf('function DetailsForm'), page.indexOf('function NameForm'));
  const name = page.slice(page.indexOf('function NameForm'), page.indexOf('function ValueForm'));
  const description = page.slice(page.indexOf('function DescriptionForm'), page.indexOf('function ActionForm'));

  assert.equal(details.includes('label="Name"'), false);
  assert.equal(details.includes('listing_title'), false);
  assert.equal(name.includes('label="Name"'), true);
  assert.equal(name.includes('listing_title'), false);
  assert.equal(name.includes('name: parsed.name'), true);
  assert.equal(description.includes('listing_title'), true);
  assert.equal(page.includes('ListingsOverview'), false);
  assert.equal(page.includes('Add similar listing'), true);
  assert.equal(page.includes('Edit name'), true);
  assert.equal(page.includes("setSheet('listing')"), true);
  assert.equal(page.includes('updateSellComparable'), true);
  assert.equal(page.includes('Remove this listing?'), true);
  assert.equal(page.includes("navigation.resumeCreation('sell', record.id)"), true);
});

test('creation still owns setup', () => {
  const setup = readFileSync(new URL('../app/(app)/create/sell/setup/[id].tsx', import.meta.url), 'utf8');

  // Replacing the creation modal with Product Detail is a modal-to-modal replace (navigation.md, E3).
  assert.equal(setup.includes('router.replace(`/product/'), false);
  assert.equal(setup.includes('Ready for the next step'), false);
  assert.equal(setup.includes("shot === 'review'"), false);
});
