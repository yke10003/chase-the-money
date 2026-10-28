import { Alert, Platform, Share } from 'react-native';

import { apiUrl, mediaUrl } from '@/api/client';
import type { SellPhoto } from '@/api/types';
import { errorMessage } from '@/lib/errors';

let saving = false;

/** Saves the pictures on screen. `photo.url` is the edited file when one exists. */
export function savePictures(photos: SellPhoto[], index: number, all: boolean, itemName: string, itemId: number): void {
  const chosen = pictures(photos, index, all);

  if (saving || chosen.length === 0) {
    return;
  }

  saving = true;
  void run(chosen, itemName, itemId, all).finally(() => {
    saving = false;
  });
}

function pictures(photos: SellPhoto[], index: number, all: boolean): Array<{ photo: SellPhoto; index: number }> {
  if (all) {
    return photos.map((photo, photoIndex) => ({ photo, index: photoIndex }));
  }

  const current = photos[index] ? index : 0;
  const photo = photos[current];

  return photo ? [{ photo, index: current }] : [];
}

async function run(chosen: Array<{ photo: SellPhoto; index: number }>, itemName: string, itemId: number, all: boolean): Promise<void> {
  try {
    if (all) {
      await downloadZip(chosen, itemName, itemId);
      return;
    }

    if (Platform.OS === 'web') {
      await downloadInBrowser(chosen, itemName, itemId);
      return;
    }

    await saveOnDevice(chosen);
    Alert.alert('Saved this picture');
  } catch (caught) {
    Alert.alert('Could not download', readable(caught));
  }
}

async function downloadZip(chosen: Array<{ photo: SellPhoto; index: number }>, itemName: string, itemId: number): Promise<void> {
  const stem = fileStem(itemName);
  const files = Platform.OS === 'web'
    ? await filesFromBrowser(chosen, stem, itemId)
    : await filesFromDevice(chosen, stem);
  const zip = zipStored(files);
  const name = `${stem}.zip`;

  if (Platform.OS === 'web') {
    const body = new ArrayBuffer(zip.byteLength);
    new Uint8Array(body).set(zip);
    saveBrowserFile(new Blob([body], { type: 'application/zip' }), name);
    return;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const root = FileSystem.cacheDirectory;

  if (!root) {
    throw new Error('Could not store the photo on this phone.');
  }

  const uri = `${root}${name}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(zip), { encoding: FileSystem.EncodingType.Base64 });
  await Share.share({ url: uri, title: name });
}

async function saveOnDevice(chosen: Array<{ photo: SellPhoto; index: number }>): Promise<void> {
  const MediaLibrary = await import('expo-media-library');
  const FileSystem = await import('expo-file-system/legacy');
  const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);

  if (!permission.granted) {
    const where = permission.canAskAgain ? '' : ' in Settings';
    throw new Error(`Allow saving photos${where} to download these pictures.`);
  }

  const root = FileSystem.cacheDirectory;

  if (!root) {
    throw new Error('Could not store the photo on this phone.');
  }

  for (const entry of chosen) {
    const name = `nolume-${entry.photo.id}.${extensionOf(entry.photo.url)}`;
    const downloaded = await FileSystem.downloadAsync(mediaUrl(entry.photo.url), `${root}${name}`);
    await MediaLibrary.Asset.create(downloaded.uri);
  }
}

async function downloadInBrowser(chosen: Array<{ photo: SellPhoto; index: number }>, itemName: string, itemId: number): Promise<void> {
  const entry = chosen[0];

  if (!entry) {
    return;
  }

  const response = await fetch(pictureUrl(itemId, entry.photo.id), { credentials: 'include' });

  if (!response.ok) {
    throw new Error('Could not download this picture.');
  }

  const stem = fileStem(itemName);
  saveBrowserFile(await response.blob(), `${stem}-${entry.index + 1}.${extensionOf(entry.photo.url)}`);
}

async function filesFromBrowser(chosen: Array<{ photo: SellPhoto; index: number }>, stem: string, itemId: number): Promise<ZipFile[]> {
  return Promise.all(chosen.map(async (entry) => {
    const response = await fetch(pictureUrl(itemId, entry.photo.id), { credentials: 'include' });

    if (!response.ok) {
      throw new Error('Could not download this picture.');
    }

    return {
      name: `${stem}-${entry.index + 1}.${extensionOf(entry.photo.url)}`,
      data: new Uint8Array(await response.arrayBuffer()),
    };
  }));
}

function pictureUrl(itemId: number, photoId: number): string {
  // Storage URLs are on the API host, so the browser blocks a direct fetch. The file route is under /api and sends the picture.
  return `${apiUrl()}/api/v1/sell/items/${itemId}/photos/${photoId}/file`;
}

function saveBrowserFile(file: Blob, name: string): void {
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

type ZipFile = { name: string; data: Uint8Array };

async function filesFromDevice(chosen: Array<{ photo: SellPhoto; index: number }>, stem: string): Promise<ZipFile[]> {
  const FileSystem = await import('expo-file-system/legacy');
  const root = FileSystem.cacheDirectory;

  if (!root) {
    throw new Error('Could not store the photo on this phone.');
  }

  const files: ZipFile[] = [];

  for (const entry of chosen) {
    const extension = extensionOf(entry.photo.url);
    const downloaded = await FileSystem.downloadAsync(mediaUrl(entry.photo.url), `${root}nolume-${entry.photo.id}.${extension}`);
    const encoded = await FileSystem.readAsStringAsync(downloaded.uri, { encoding: FileSystem.EncodingType.Base64 });
    files.push({
      name: `${stem}-${entry.index + 1}.${extension}`,
      data: base64ToBytes(encoded),
    });
  }

  return files;
}

/** Uncompressed zip. The pictures are already JPEG or PNG. */
function zipStored(files: ZipFile[]): Uint8Array {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const encoded = files.map((file) => ({
    name: new TextEncoder().encode(file.name),
    data: file.data,
    crc: crc32(file.data),
  }));
  let size = 22;

  for (const file of encoded) {
    size += 30 + file.name.length + file.data.length;
    size += 46 + file.name.length;
  }

  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  const localOffset: number[] = [];
  let offset = 0;

  for (const file of encoded) {
    localOffset.push(offset);
    writeHeader(view, bytes, offset, 0x04034b50, file, time, date, 0);
    offset += 30 + file.name.length + file.data.length;
  }

  const centralOffset = offset;

  encoded.forEach((file, index) => {
    writeHeader(view, bytes, offset, 0x02014b50, file, time, date, localOffset[index] ?? 0);
    offset += 46 + file.name.length;
  });

  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 8, encoded.length, true);
  view.setUint16(offset + 10, encoded.length, true);
  view.setUint32(offset + 12, offset - centralOffset, true);
  view.setUint32(offset + 16, centralOffset, true);

  return bytes;
}

function writeHeader(view: DataView, bytes: Uint8Array, offset: number, signature: number, file: { name: Uint8Array; data: Uint8Array; crc: number }, time: number, date: number, localOffset: number): void {
  const central = signature === 0x02014b50;
  view.setUint32(offset, signature, true);
  view.setUint16(offset + 4, 20, true);

  if (central) {
    view.setUint16(offset + 6, 20, true);
  }

  const methodAt = central ? 10 : 8;
  view.setUint16(offset + methodAt, 0, true);
  view.setUint16(offset + methodAt + 2, time, true);
  view.setUint16(offset + methodAt + 4, date, true);
  view.setUint32(offset + methodAt + 6, file.crc, true);
  view.setUint32(offset + methodAt + 10, file.data.length, true);
  view.setUint32(offset + methodAt + 14, file.data.length, true);
  view.setUint16(offset + methodAt + 18, file.name.length, true);

  if (central) {
    view.setUint32(offset + 38, 0o100644 << 16, true);
    view.setUint32(offset + 42, localOffset, true);
    bytes.set(file.name, offset + 46);
    return;
  }

  bytes.set(file.name, offset + 30);
  bytes.set(file.data, offset + 30 + file.name.length);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }

  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function fileStem(itemName: string): string {
  const stem = itemName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return stem || 'picture';
}

function extensionOf(url: string): string {
  const path = url.split('?')[0] ?? url;
  const match = path.match(/\.([a-z0-9]+)$/i);
  const raw = match?.[1]?.toLowerCase() ?? 'jpg';

  return raw === 'png' ? 'png' : 'jpg';
}

function readable(caught: unknown): string {
  const message = errorMessage(caught);

  if (message.includes('ExpoMediaLibrary') || message.includes('native module')) {
    return 'Rebuild the app, then try the download again.';
  }

  return message;
}
