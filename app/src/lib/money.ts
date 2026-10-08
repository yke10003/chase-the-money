const SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
};

export function majorToMinor(input: string): number | null {
  const raw = input.trim().replace(/^€\s*/, '');
  const trimmed = /^\d+,\d{1,2}$/.test(raw) ? raw.replace(',', '.') : raw;

  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  const [whole, fraction = ''] = trimmed.split('.');
  const cents = `${fraction}00`.slice(0, 2);

  return Number.parseInt(whole, 10) * 100 + Number.parseInt(cents, 10);
}

export function minorToMajorInput(amountMinor: number | null | undefined): string {
  if (amountMinor == null) {
    return '';
  }

  const abs = Math.abs(Math.trunc(amountMinor));
  const major = Math.floor(abs / 100);
  const cents = abs % 100;

  if (cents === 0) {
    return String(major);
  }

  return `${major}.${cents.toString().padStart(2, '0')}`;
}

export function formatMoney(amountMinor: number | null | undefined, currency: string): string {
  if (amountMinor == null) {
    return '—';
  }

  const negative = amountMinor < 0;
  const abs = Math.abs(Math.trunc(amountMinor));
  const major = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = major.toLocaleString('en-GB');
  const symbol = SYMBOLS[currency] ?? `${currency} `;

  return `${negative ? '-' : ''}${symbol}${grouped}.${cents.toString().padStart(2, '0')}`;
}

/**
 * Display figure: "€2,000" for whole amounts, "€19.99" otherwise.
 */
export function formatAmount(amountMinor: number | null | undefined, currency: string): string {
  if (amountMinor == null) {
    return '—';
  }

  if (Math.trunc(amountMinor) % 100 !== 0) {
    return formatMoney(amountMinor, currency);
  }

  const negative = amountMinor < 0;
  const major = Math.abs(Math.trunc(amountMinor)) / 100;
  const symbol = SYMBOLS[currency] ?? `${currency} `;

  return `${negative ? '-' : ''}${symbol}${major.toLocaleString('en-GB')}`;
}

export function formatAmountRange(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string,
): string | null {
  if (min == null && max == null) {
    return null;
  }

  if (min != null && max != null && min !== max) {
    return `${formatAmount(min, currency)}–${formatAmount(max, currency).replace(/^[^\d-]+/, '')}`;
  }

  return formatAmount(min ?? max, currency);
}

export function formatPotential(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string,
): string {
  if (min == null && max == null) {
    return 'Not valued';
  }

  if (min != null && max != null && min === max) {
    return formatMoney(min, currency);
  }

  if (min != null && max != null) {
    return `${formatMoney(min, currency)}–${formatMoney(max, currency)}`;
  }

  if (min != null) {
    return `from ${formatMoney(min, currency)}`;
  }

  return `up to ${formatMoney(max, currency)}`;
}
