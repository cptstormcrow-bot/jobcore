/**
 * Airplane-mode assertions for offline-fallback helpers. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { orWhenOffline, findRecordInPayload } from './offline-fallback';

class Offline extends Error {}
const isOffline = (e: unknown) => e instanceof Offline;

test('offline miss gives the blank value instead of an error', async () => {
  assert.deepEqual(await orWhenOffline(async () => { throw new Offline('no copy'); }, [], isOffline), []);
  assert.equal(await orWhenOffline(async () => { throw new Offline('no copy'); }, null, isOffline), null);
  assert.equal(await orWhenOffline(async () => { throw new Offline('no copy'); }, '', isOffline), '');
});

test('online answer passes through untouched', async () => {
  assert.deepEqual(await orWhenOffline(async () => [1, 2], [], isOffline), [1, 2]);
});

test('a real (non-offline) failure still surfaces', async () => {
  await assert.rejects(orWhenOffline(async () => { throw new Error('bad row'); }, [], isOffline), /bad row/);
});

test('finds a saved job by id in a saved list or single record', () => {
  const list = [{ id: 'a', n: 1 }, { id: 'b', n: 2 }];
  assert.deepEqual(findRecordInPayload(list, 'b'), { id: 'b', n: 2 });
  assert.deepEqual(findRecordInPayload({ id: 'c' }, 'c'), { id: 'c' });
  assert.equal(findRecordInPayload(list, 'z'), null);
  assert.equal(findRecordInPayload(null, 'a'), null);
});

test('extra match check narrows the saved record', () => {
  const list = [{ id: 'a', techId: 't1' }, { id: 'a', techId: 't2' }];
  assert.deepEqual(findRecordInPayload(list, 'a', (r) => r.techId === 't2'), { id: 'a', techId: 't2' });
});
