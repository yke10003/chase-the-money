import { Platform } from 'react-native';

import { parseApiError } from '@/lib/errors';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

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

async function ensureCsrfCookie(): Promise<void> {
  await fetch(`${API_URL}/sanctum/csrf-cookie`, {
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
  };
  const token = xsrfToken();

  if (token) {
    headers['X-XSRF-TOKEN'] = token;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_URL}/api${path}`, {
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

  return payload as T;
}

export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  await ensureCsrfCookie();
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = xsrfToken();

  if (token) {
    headers['X-XSRF-TOKEN'] = token;
  }

  const response = await fetch(`${API_URL}/api${path}`, {
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

  return payload as T;
}
