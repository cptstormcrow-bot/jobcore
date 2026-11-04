import test from 'node:test';
import assert from 'node:assert/strict';

import { offlineMissError, skipFetchWhenNoCopy } from './offline-read-policy';
import { isNetKnown, setOnlineNow, whenNetKnown } from './sync-events';

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

test('a launch read waits for the first network report, then stops waiting', async () => {
  assert.equal(isNetKnown(), false);
  const start = Date.now();
  const waiting = whenNetKnown(5000);
  setTimeout(() => setOnlineNow(false), 20);
  await waiting;
  assert.ok(Date.now() - start < 1000);
  assert.equal(isNetKnown(), true);
  const t2 = Date.now();
  await whenNetKnown(5000);
  assert.ok(Date.now() - t2 < 50);
});
