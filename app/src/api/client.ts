import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { NativeModules, Platform } from 'react-native';

import { parseApiError } from '@/lib/errors';

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

function bundleScriptUrl(): string | null {
  const sourceCode = NativeModules.SourceCode as
    | { getConstants?: () => { scriptURL?: string }; scriptURL?: string }
    | undefined;
  const scriptUrl = sourceCode?.getConstants?.().scriptURL ?? sourceCode?.scriptURL;

  return scriptUrl || null;
}

function devMachineHost(): string | null {
  const scriptUrl = bundleScriptUrl();

  if (scriptUrl) {
    try {
      const host = new URL(scriptUrl).hostname;

      if (host && host !== 'localhost' && host !== '127.0.0.1') {
        return host;
      }
    } catch {
      // A file:// bundle has no host. Fall through to the Expo dev server host.
    }
  }

  const packagerHost = Constants.expoConfig?.hostUri?.split(':')[0];

  if (packagerHost && packagerHost !== 'localhost' && packagerHost !== '127.0.0.1') {
    return packagerHost;
  }

  return null;
}

// The phone's "localhost" is the phone. iOS also resolves "localhost" to ::1,
// while `php artisan serve` only listens on 127.0.0.1 unless SERVER_HOST is set.
export function apiUrl(): string {
  if (Platform.OS === 'web') {
    return configuredApiUrl;
  }

  let url: URL;

  try {
    url = new URL(configuredApiUrl);
  } catch {
    return configuredApiUrl;
  }

  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (!loopback) {
    return configuredApiUrl;
  }

  const devHost = devMachineHost();
  url.hostname = devHost ?? '127.0.0.1';

  return url.origin;
}

const TOKEN_KEY = 'nolume.token';
let memoryToken: string | null = null;

export async function loadToken(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  memoryToken = token;

  if (Platform.OS === 'web') {
    return;
  }

  if (token) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
};

function xsrfToken(): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return null;
  }

  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);

  return match ? decodeURIComponent(match[1]) : null;
}

function nativeHeaders(): Record<string, string> {
  if (Platform.OS === 'web') {
    return {};
  }

  return {
    'X-Nolume-Client': 'native',
    ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
  };
}

async function ensureCsrfCookie(): Promise<void> {
  if (Platform.OS !== 'web') {
    return;
  }

  await fetch(`${apiUrl()}/sanctum/csrf-cookie`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';

  if (method !== 'GET' && method !== 'HEAD') {
    await ensureCsrfCookie();
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...nativeHeaders(),
  };
  const token = xsrfToken();

  if (token) {
    headers['X-XSRF-TOKEN'] = token;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${apiUrl()}/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw parseApiError(response.status, payload);
  }

  return rewriteDevUrls(payload) as T;
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  await ensureCsrfCookie();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...nativeHeaders(),
  };
  const token = xsrfToken();

  if (token) {
    headers['X-XSRF-TOKEN'] = token;
  }

  const response = await fetch(`${apiUrl()}/api${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body,
  });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw parseApiError(response.status, payload);
  }

  return rewriteDevUrls(payload) as T;
}

type NativeUpload = {
  fieldName: string;
  mimeType: string;
  parameters?: Record<string, string>;
};

export async function apiUploadFile<T>(path: string, fileUri: string, options: NativeUpload): Promise<T> {
  // The Expo File class calls validatePath() in its constructor. The web build of
  // expo-file-system does not implement that method, so a library photo never uploads.
  if (Platform.OS === 'web') {
    return uploadBrowserFile(path, fileUri, options);
  }

  const { File, UploadType } = await import('expo-file-system');
  const file = new File(fileUri);
  const result = await file.upload(`${apiUrl()}/api${path}`, {
    uploadType: UploadType.MULTIPART,
    httpMethod: 'POST',
    fieldName: options.fieldName,
    mimeType: options.mimeType,
    parameters: options.parameters,
    sessionType: 'foreground',
    headers: {
      Accept: 'application/json',
      ...nativeHeaders(),
    },
  });

  let payload: unknown = null;

  if (result.body) {
    payload = parseUploadBody(result.body);
  }

  if (result.status < 200 || result.status >= 300) {
    throw parseApiError(result.status, payload);
  }

  return rewriteDevUrls(payload) as T;
}

async function uploadBrowserFile<T>(path: string, fileUri: string, options: NativeUpload): Promise<T> {
  const response = await fetch(fileUri);

  if (!response.ok) {
    throw new Error('Could not read the photo.');
  }

  const blob = await response.blob();
  const type = blob.type || options.mimeType;
  const named = new globalThis.File([blob], uploadFileName(type), { type });
  const body = new FormData();
  body.append(options.fieldName, named);

  for (const [key, value] of Object.entries(options.parameters ?? {})) {
    body.append(key, value);
  }

  return apiUpload(path, body);
}

function uploadFileName(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.split('+')[0] ?? 'bin';
  const extension = subtype === 'jpeg' ? 'jpg' : subtype;

  return `upload.${extension}`;
}

/** PHP prints a warning in front of the JSON when a POST exceeds post_max_size. */
function parseUploadBody(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');

    if (start === -1 || end <= start) {
      throw new Error('Could not read the upload response.');
    }

    try {
      return JSON.parse(body.slice(start, end + 1)) as unknown;
    } catch {
      throw new Error('Could not read the upload response.');
    }
  }
}

/** Photo URLs come back as APP_URL, which is localhost in dev. The phone cannot load that. */
export function mediaUrl(value: string): string {
  if (Platform.OS === 'web') {
    return value;
  }

  const devHost = devMachineHost();

  if (!devHost) {
    return value;
  }

  return rewriteLoopbackUrl(value, devHost);
}

function rewriteDevUrls(value: unknown): unknown {
  if (Platform.OS === 'web') {
    return value;
  }

  const devHost = devMachineHost();

  if (!devHost) {
    return value;
  }

  return rewriteLoopback(value, devHost);
}

function rewriteLoopback(value: unknown, devHost: string): unknown {
  if (typeof value === 'string') {
    return rewriteLoopbackUrl(value, devHost);
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewriteLoopback(item, devHost));
  }

  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      next[key] = rewriteLoopback(item, devHost);
    }

    return next;
  }

  return value;
}

function rewriteLoopbackUrl(value: string, devHost: string): string {
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    return value;
  }

  try {
    const url = new URL(value);

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      url.hostname = devHost;

      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}
