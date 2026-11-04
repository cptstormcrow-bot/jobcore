import test from 'node:test';
import assert from 'node:assert/strict';

import { offlineMissError, skipFetchWhenNoCopy } from './offline-read-policy';

test('offline with no saved copy skips the fetch', () => {
  assert.equal(skipFetchWhenNoCopy(false), true);
});

test('online with no saved copy still fetches', () => {
  assert.equal(skipFetchWhenNoCopy(true), false);
});

test('the skipped read fails like a dropped connection', () => {
  const e = offlineMissError();
  assert.ok(e instanceof TypeError);
  assert.match(e.message, /Network request failed/);
});
