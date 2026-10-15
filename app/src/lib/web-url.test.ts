import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWebUrl } from './web-url';

function url(raw: string): string {
  const parsed = normalizeWebUrl(raw);

  if ('error' in parsed) {
    throw new Error(parsed.error);
  }

  return parsed.url;
}

test('a bare web address gets https, and an existing protocol stays', () => {
  assert.equal(url('vinted.com/abc'), 'https://vinted.com/abc');
  assert.equal(url('  www.vinted.com/abc  '), 'https://www.vinted.com/abc');
  assert.equal(url('https://vinted.com/abc'), 'https://vinted.com/abc');
  assert.equal(url('http://example.com/item'), 'http://example.com/item');
  assert.equal(url('vinted.com/abc?id=1&ref=a#photo'), 'https://vinted.com/abc?id=1&ref=a#photo');
  assert.equal(url('vinted.com:8080/abc'), 'https://vinted.com:8080/abc');
  assert.equal(url('//vinted.com/abc'), 'https://vinted.com/abc');
  assert.equal(url('http://localhost/item'), 'http://localhost/item');
});

test('empty values and other schemes are rejected', () => {
  for (const raw of ['', '   ', 'not a url', 'vinted', 'https://', 'javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://files.example.com/a']) {
    assert.equal('error' in normalizeWebUrl(raw), true, raw);
  }
});
