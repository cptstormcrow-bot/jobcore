import test from 'node:test';
import assert from 'node:assert/strict';

import { makeAuthRetrySend } from './auth-retry';

const authErr = new Error('JWT expired');
const isAuthError = (e: unknown) => e === authErr;

test('success passes through without refresh', async () => {
  let refreshes = 0;
  const s = makeAuthRetrySend<string>({ send: async () => {}, isAuthError, refresh: async () => (refreshes++, true) });
  await s('a');
  assert.equal(refreshes, 0);
});

test('auth error refreshes once and retries the row once', async () => {
  let calls = 0;
  let refreshes = 0;
  const s = makeAuthRetrySend<string>({
    send: async () => { if (calls++ === 0) throw authErr; },
    isAuthError,
    refresh: async () => (refreshes++, true),
  });
  await s('a');
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
});

test('refresh happens once per pass; later auth errors propagate', async () => {
  let refreshes = 0;
  const s = makeAuthRetrySend<string>({ send: async () => { throw authErr; }, isAuthError, refresh: async () => (refreshes++, true) });
  await assert.rejects(s('a'), authErr); // retry also fails
  await assert.rejects(s('b'), authErr); // no second refresh
  assert.equal(refreshes, 1);
});

test('failed or throwing refresh rethrows the original error', async () => {
  const s1 = makeAuthRetrySend<string>({ send: async () => { throw authErr; }, isAuthError, refresh: async () => false });
  await assert.rejects(s1('a'), authErr);
  const s2 = makeAuthRetrySend<string>({ send: async () => { throw authErr; }, isAuthError, refresh: async () => { throw new Error('x'); } });
  await assert.rejects(s2('a'), authErr);
});

test('non-auth errors are not retried', async () => {
  let calls = 0;
  let refreshes = 0;
  const boom = new Error('boom');
  const s = makeAuthRetrySend<string>({ send: async () => { calls++; throw boom; }, isAuthError, refresh: async () => (refreshes++, true) });
  await assert.rejects(s('a'), boom);
  assert.equal(calls, 1);
  assert.equal(refreshes, 0);
});

test('rows failing auth at the same time share one refresh and each retry once', async () => {
  let refreshes = 0;
  const sent: string[] = [];
  let fresh = false;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const s = makeAuthRetrySend<string>({
    send: async (row) => {
      if (!fresh) throw authErr;
      sent.push(row);
    },
    isAuthError,
    refresh: async () => {
      refreshes++;
      await gate;
      fresh = true;
      return true;
    },
  });
  const all = Promise.all([s('a'), s('b'), s('c')]);
  release();
  await all;
  assert.equal(refreshes, 1);
  assert.deepEqual(sent.sort(), ['a', 'b', 'c']);
});
