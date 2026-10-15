const MESSAGE = 'Paste a link to the similar sale.';

/**
 * A link a person can paste. https is added when they leave the protocol off.
 * http and https are kept as typed. Other schemes are rejected.
 */
export function normalizeWebUrl(raw: string): { url: string } | { error: string } {
  const trimmed = raw.trim();

  if (trimmed === '' || /\s/.test(trimmed)) {
    return { error: MESSAGE };
  }

  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  let candidate = trimmed;
  let prefixed = false;

  // A dot in the first token means a host (`vinted.com:8080`), not a scheme.
  if (scheme && !scheme[1].includes('.')) {
    const name = scheme[1].toLowerCase();

    if (name !== 'http' && name !== 'https') {
      return { error: MESSAGE };
    }
  } else if (trimmed.startsWith('//')) {
    candidate = `https:${trimmed}`;
    prefixed = true;
  } else {
    candidate = `https://${trimmed}`;
    prefixed = true;
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    return { error: MESSAGE };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: MESSAGE };
  }

  const host = parsed.hostname.toLowerCase();

  if (host === '' || (!host.includes('.') && host !== 'localhost')) {
    return { error: MESSAGE };
  }

  return { url: prefixed ? candidate : trimmed };
}
