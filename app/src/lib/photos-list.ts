import { itemLeaf } from '@/lib/product-detail';

/**
 * Pure rules for the Photos overview. The native SwiftUI list (iOS) and the plain React Native
 * list (Android, web) both use these, so the two cannot drift.
 */

/** SwiftUI's `onMove(from:to:)`: `destination` is an insertion point in the list as it was BEFORE the move. */
export function applyNativeMove<T>(items: T[], sourceIndices: number[], destination: number): T[] {
  const sources = [...new Set(sourceIndices)].filter((index) => index >= 0 && index < items.length).sort((left, right) => left - right);

  if (sources.length === 0 || destination < 0 || destination > items.length) {
    return items;
  }

  const moving = sources.map((index) => items[index]);
  const staying = items.filter((_, index) => !sources.includes(index));
  const removedBefore = sources.filter((index) => index < destination).length;
  const insertAt = destination - removedBefore;

  return [...staying.slice(0, insertAt), ...moving, ...staying.slice(insertAt)];
}

/** Edit/Done. Reordering needs at least two photos, so a shorter list is never in edit mode. */
export function nextEditing(editing: boolean, photoCount: number): boolean {
  if (photoCount < 2) {
    return false;
  }

  return !editing;
}

/** Where a row tap goes. Nothing while reordering, so a drag or a stray tap never navigates. */
export function rowHref(editing: boolean, itemId: number, photo: { id: number; collage: unknown }): string | null {
  if (editing) {
    return null;
  }

  const leaf = photo.collage ? 'collage' : 'edit';

  return `${itemLeaf(itemId, leaf)}?photo=${photo.id}`;
}

/** The star: choosing the photo that is already the cover is a no-op, not a request. */
export function coverTarget(photo: { id: number; is_cover: boolean }): number | null {
  return photo.is_cover ? null : photo.id;
}

/** Native list on iOS, plain React Native list everywhere else. */
export function usesNativePhotoList(platform: string): boolean {
  return platform === 'ios';
}
