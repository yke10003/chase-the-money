import assert from 'node:assert/strict';
import test from 'node:test';

import { applyNativeMove, coverTarget, nextEditing, rowHref, usesNativePhotoList } from './photos-list';

const ids = (list: { id: number }[]) => list.map((item) => item.id);
const photos = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

test('a native move down inserts before the destination row of the original list', () => {
  // SwiftUI: drag row 0 below row 2 reports destination 3.
  assert.deepEqual(ids(applyNativeMove(photos, [0], 3)), [2, 3, 1, 4]);
  assert.deepEqual(ids(applyNativeMove(photos, [0], 4)), [2, 3, 4, 1]);
});

test('a native move up lands on the destination index', () => {
  assert.deepEqual(ids(applyNativeMove(photos, [3], 1)), [1, 4, 2, 3]);
  assert.deepEqual(ids(applyNativeMove(photos, [2], 0)), [3, 1, 2, 4]);
});

test('dropping a row where it already is leaves the order alone', () => {
  assert.deepEqual(ids(applyNativeMove(photos, [1], 1)), [1, 2, 3, 4]);
  assert.deepEqual(ids(applyNativeMove(photos, [1], 2)), [1, 2, 3, 4]);
});

test('several rows move together and keep their relative order', () => {
  assert.deepEqual(ids(applyNativeMove(photos, [0, 1], 4)), [3, 4, 1, 2]);
  assert.deepEqual(ids(applyNativeMove(photos, [2, 3], 0)), [3, 4, 1, 2]);
});

test('a bad native move is ignored, and the cover flag travels with the photo', () => {
  assert.equal(applyNativeMove(photos, [9], 1), photos);
  assert.equal(applyNativeMove(photos, [0], -1), photos);
  assert.equal(applyNativeMove(photos, [0], 9), photos);
  assert.equal(applyNativeMove(photos, [], 1), photos);

  const withCover = [{ id: 1, is_cover: true }, { id: 2, is_cover: false }];
  const moved = applyNativeMove(withCover, [0], 2);

  assert.deepEqual(moved, [{ id: 2, is_cover: false }, { id: 1, is_cover: true }]);
});

test('Edit turns reordering on and Done turns it off, and one photo has nothing to reorder', () => {
  assert.equal(nextEditing(false, 3), true);
  assert.equal(nextEditing(true, 3), false);
  assert.equal(nextEditing(false, 1), false);
  assert.equal(nextEditing(true, 1), false);
  assert.equal(nextEditing(false, 0), false);
});

test('a row opens Edit Photo, or Edit Collage for a collage, and nothing while editing', () => {
  assert.equal(rowHref(false, 17, { id: 9, collage: null }), '/product/17/photos/edit?photo=9');
  assert.equal(rowHref(false, 17, { id: 9, collage: { slots: [] } }), '/product/17/photos/collage?photo=9');
  assert.equal(rowHref(true, 17, { id: 9, collage: null }), null);
  assert.equal(rowHref(true, 17, { id: 9, collage: { slots: [] } }), null);
});

test('the star picks a new cover, and does nothing on the current cover', () => {
  assert.equal(coverTarget({ id: 5, is_cover: false }), 5);
  assert.equal(coverTarget({ id: 5, is_cover: true }), null);
});

test('only iOS gets the native list', () => {
  assert.equal(usesNativePhotoList('ios'), true);
  assert.equal(usesNativePhotoList('android'), false);
  assert.equal(usesNativePhotoList('web'), false);
});
