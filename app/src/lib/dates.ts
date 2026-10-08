export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const [year, month, day] = value.slice(0, 10).split('-').map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) {
    return value;
  }

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Calendar dates stay as sent. Timestamps are read in the device's timezone.
 */
function calendarPart(value: string): string {
  if (value.length > 10 && value.includes('T')) {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return toIsoDate(date);
    }
  }

  return value.slice(0, 10);
}

/**
 * "13 Oct", or "13 Oct 2027" when the year is not the current one.
 */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const [year, month, day] = calendarPart(value).split('-').map((part) => Number.parseInt(part, 10));

  if (!year || !month || !day) {
    return value;
  }

  const sameYear = year === new Date().getFullYear();

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
}

export function dateParts(value: string): { day: string; month: string; weekday: string } {
  const [year, month, day] = value.slice(0, 10).split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day));

  return {
    day: String(day),
    month: date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
    weekday: date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }),
  };
}

/**
 * Calendar days from the device's today to the given YYYY-MM-DD date. Negative is in the past.
 */
export function daysUntil(value: string): number {
  const [year, month, day] = value.slice(0, 10).split('-').map((part) => Number.parseInt(part, 10));
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((target - today) / 86_400_000);
}

export function relativeDay(value: string): string {
  const days = daysUntil(value);

  if (days === 0) {
    return 'today';
  }

  if (days === 1) {
    return 'tomorrow';
  }

  if (days === -1) {
    return 'yesterday';
  }

  if (days < 0) {
    return `${Math.abs(days)} days ago`;
  }

  if (days < 7) {
    return `in ${days} days`;
  }

  return `on ${formatShortDate(value)}`;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return toIsoDate(date);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
