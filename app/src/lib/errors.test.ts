import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fieldError, parseApiError } from './errors.ts';

test('reads Laravel validation errors', () => {
  const error = parseApiError(422, {
    message: 'The given data was invalid.',
    errors: { email: ['The email has already been taken.'] },
  });

  assert.equal(error.status, 422);
  assert.equal(fieldError(error, 'email'), 'The email has already been taken.');
  assert.equal(fieldError(error, 'title'), null);
});

test('keeps a message when the body is not JSON', () => {
  const error = parseApiError(500, null);

  assert.equal(error.message, 'Request failed (500)');
});
