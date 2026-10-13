import type { QueryClient } from '@tanstack/react-query';

import type { SellItemView } from '@/api/types';

const latestWrite = new Map<number, number>();
let writeClock = 0;

/** Stamp a save before the request. An older response must not replace a newer one. */
export function startSellWrite(id: number): number {
  writeClock += 1;
  latestWrite.set(id, writeClock);

  return writeClock;
}

/**
 * A category by itself is not a card yet. The draft stays on the server so setup
 * can resume once a name or a photo has been saved.
 */
export function showsOnSellBoard(item: SellItemView): boolean {
  if (item.name != null && item.name.trim() !== '') {
    return true;
  }

  if (item.cover_url != null || item.photos.length > 0) {
    return true;
  }

  return item.setup_done;
}

/** Keep the card where it is. A brand new id goes to the front, matching the list endpoint. */
export function mergeSellItem(items: SellItemView[] | undefined, item: SellItemView): SellItemView[] | undefined {
  if (!items) {
    return items;
  }

  const index = items.findIndex((entry) => entry.id === item.id);

  if (index === -1) {
    return [item, ...items];
  }

  const next = items.slice();
  next[index] = item;

  return next;
}

/** Icon name from the sell catalog. Package is the generic mark already used for Other. */
export function categoryIcon(categories: Array<{ key: string; icon: string }> | undefined, category: string): string {
  return categories?.find((entry) => entry.key === category)?.icon ?? 'package';
}

/**
 * Write one saved item into the detail cache and the Sell board.
 * Cancels a list refetch that started before this save, so it cannot put the old row back.
 */
export async function rememberSellItem(client: QueryClient, item: SellItemView, token: number): Promise<void> {
  if (latestWrite.get(item.id) !== token) {
    return;
  }

  const boardLoaded = client.getQueryData<SellItemView[]>(['sell', 'items']) != null;

  if (boardLoaded) {
    await client.cancelQueries({ queryKey: ['sell', 'items'] });
  }

  await client.cancelQueries({ queryKey: ['sell', 'item', item.id] });

  if (latestWrite.get(item.id) !== token) {
    return;
  }

  client.setQueryData(['sell', 'item', item.id], { data: item });
  client.setQueryData<SellItemView[]>(['sell', 'items'], (current) => mergeSellItem(current, item));
}

/** Drop a discarded draft from both caches so it cannot reappear on the board. */
export function forgetSellItem(client: QueryClient, id: number): void {
  client.setQueryData<SellItemView[]>(['sell', 'items'], (current) => current?.filter((entry) => entry.id !== id));
  client.removeQueries({ queryKey: ['sell', 'item', id] });
}
