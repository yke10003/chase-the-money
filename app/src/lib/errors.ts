export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export function parseApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === 'object') {
    const record = body as { message?: unknown; errors?: unknown };
    const message = typeof record.message === 'string' ? record.message : `Request failed (${status})`;
    const errors: Record<string, string[]> = {};

    if (record.errors && typeof record.errors === 'object') {
      for (const [key, value] of Object.entries(record.errors)) {
        if (Array.isArray(value)) {
          errors[key] = value.map(String);
        }
      }
    }

    return new ApiError(status, message, errors);
  }

  return new ApiError(status, `Request failed (${status})`);
}

export function fieldError(error: unknown, field: string): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const messages = error.errors[field];

  return messages && messages.length > 0 ? messages.join(' ') : null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}
