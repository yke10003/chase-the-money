import assert from 'node:assert/strict';
import test from 'node:test';

import { QueryClient } from '@tanstack/react-query';

import type { SellItemView } from '@/api/types';
import { categoryIcon, mergeSellItem, rememberSellItem, showsOnSellBoard, startSellWrite } from './sell-cache';

function item(patch: Partial<SellItemView> & Pick<SellItemView, 'id'>): SellItemView {
  return {
    id: patch.id,
    opportunity_id: patch.id,
    name: patch.name ?? null,
    listing_title: null,
    category: patch.category ?? 'wardrobe',
    category_label: 'Wardrobe & fashion',
    subcategory: null,
    subcategory_label: null,
    brand: null,
    condition: null,
    condition_label: null,
    details: {},
    listing_description: null,
    value_min_minor: patch.value_min_minor ?? null,
    value_max_minor: patch.value_max_minor ?? null,
    value_confidence: null,
    currency: 'EUR',
    setup_step: 'identity',
    setup_done: patch.setup_done ?? false,
    origin: 'setup',
    next_step_label: 'Name it',
    xp_earned: 0,
    research_prompt: '',
    cover_url: patch.cover_url ?? null,
    stage: 'valuing',
    stage_label: 'Valuing',
    photos: patch.photos ?? [],
    comparables: [],
    photo_plan: [],
    next: null,
    asking_price_minor: null,
    listed_on: null,
  };
}

test('a category-only draft stays off the board until a name or a photo is saved', () => {
  assert.equal(showsOnSellBoard(item({ id: 1 })), false);
  assert.equal(showsOnSellBoard(item({ id: 1, name: '   ' })), false);
  assert.equal(showsOnSellBoard(item({ id: 1, name: 'Test jas' })), true);
  assert.equal(showsOnSellBoard(item({ id: 1, cover_url: '/storage/cover.jpg', photos: [{ id: 9 } as SellItemView['photos'][number]] })), true);
  assert.equal(showsOnSellBoard(item({ id: 1, setup_done: true })), true);
});

test('category icons come from the catalog and unknown categories use package', () => {
  const categories = [
    { key: 'wardrobe', icon: 'tshirt' },
    { key: 'jewelry', icon: 'watch' },
    { key: 'tech', icon: 'deviceMobile' },
  ];

  assert.equal(categoryIcon(categories, 'wardrobe'), 'tshirt');
  assert.equal(categoryIcon(categories, 'jewelry'), 'watch');
  assert.equal(categoryIcon(undefined, 'wardrobe'), 'package');
  assert.equal(categoryIcon(categories, 'missing'), 'package');
});

test('saving a name replaces that card and leaves the others in place', () => {
  const coat = item({ id: 2, name: 'Coat' });
  const draft = item({ id: 4 });
  const named = item({ id: 4, name: 'Test jas', cover_url: '/storage/jas.jpg' });

  assert.deepEqual(mergeSellItem([coat, draft], named)?.map((entry) => entry.name), ['Coat', 'Test jas']);
  assert.equal(mergeSellItem(undefined, named), undefined);
  assert.equal(mergeSellItem([], named)?.[0].id, 4);
});

test('the sell board and the open item share the saved row, and an older response loses', async () => {
  const client = new QueryClient();
  const current = item({ id: 4, name: 'Test jas', value_min_minor: 4500, value_max_minor: 4500 });
  client.setQueryData(['sell', 'items'], [item({ id: 2, name: 'Coat' }), item({ id: 4 })]);

  const first = startSellWrite(4);
  const second = startSellWrite(4);
  await rememberSellItem(client, current, second);
  await rememberSellItem(client, item({ id: 4, name: null }), first);

  const list = client.getQueryData<SellItemView[]>(['sell', 'items']);
  assert.equal(list?.[0].name, 'Coat');
  assert.equal(list?.[1].name, 'Test jas');
  assert.equal(list?.[1].cover_url, null);
  assert.equal(list?.[1].value_min_minor, 4500);
  assert.equal(client.getQueryData<{ data: SellItemView }>(['sell', 'item', 4])?.data.name, 'Test jas');
});
