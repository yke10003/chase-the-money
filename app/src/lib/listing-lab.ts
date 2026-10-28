import { Image } from 'react-native';

import { mediaUrl } from '@/api/client';
import type { SellItemView, SellPhoto } from '@/api/types';
import { listingSuggestion } from '@/lib/sell';

export type { ListingFact } from '@/lib/listing-facts';
export { listingFacts } from '@/lib/listing-facts';

const PHOTO_EDGE = 768;

export function listingLabPhotos(item: SellItemView): SellPhoto[] {
  const chosen: SellPhoto[] = [];
  const used = new Set<number>();

  function take(photo: SellPhoto | undefined) {
    if (!photo || used.has(photo.id)) {
      return;
    }

    used.add(photo.id);
    chosen.push(photo);
  }

  take(item.photos.find((photo) => photo.is_cover) ?? item.photos.find((photo) => photo.shot_key === 'main'));
  take(item.photos.find((photo) => photo.shot_key === 'brand_label' || photo.shot_key === 'size_label'));
  take(item.photos.find((photo) => photo.shot_key === 'detail' || photo.shot_key === 'damage'));

  const rest = [...item.photos].sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
  for (const photo of rest) {
    if (chosen.length >= 3) {
      break;
    }

    take(photo);
  }

  return chosen.slice(0, 3);
}

export function listingLabSuggestion(item: SellItemView): string {
  return listingSuggestion(item);
}

export async function prepareListingPhotos(photos: SellPhoto[], count: number): Promise<string[]> {
  const picked = photos.slice(0, count);
  const paths: string[] = [];

  for (const photo of picked) {
    paths.push(await prepareListingPhoto(photo));
  }

  return paths;
}

async function prepareListingPhoto(photo: SellPhoto): Promise<string> {
  const uri = mediaUrl(photo.original_url);
  const local = await cachedFile(uri, `listing-lab-${photo.id}.jpg`);
  const size = await imageSize(local);
  const longEdge = Math.max(size.width, size.height);

  if (longEdge <= 0 || longEdge <= PHOTO_EDGE) {
    return local;
  }

  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(local);

  if (size.width >= size.height) {
    context.resize({ width: PHOTO_EDGE });
  } else {
    context.resize({ height: PHOTO_EDGE });
  }

  try {
    const image = await context.renderAsync();

    try {
      const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

      return saved.uri;
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

async function cachedFile(uri: string, name: string): Promise<string> {
  if (uri.startsWith('file:') || uri.startsWith('content:')) {
    return uri;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const root = FileSystem.cacheDirectory;

  if (!root) {
    throw Object.assign(new Error('Could not store the photo on this phone.'), { code: 'missingPhoto' });
  }

  const downloaded = await FileSystem.downloadAsync(uri, `${root}${name}`);

  return downloaded.uri;
}

function imageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 }),
    );
  });
}
