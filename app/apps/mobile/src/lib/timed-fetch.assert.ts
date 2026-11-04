import test from 'node:test';
import assert from 'node:assert/strict';

import { makeTimedFetch, timeoutFor, REQUEST_TIMEOUT_MS, STORAGE_TIMEOUT_MS } from './timed-fetch';

// A fetch that never answers on its own, only when its signal aborts (a dead connection).
const hanging = ((_: unknown, init?: RequestInit) =>
  new Promise<Response>((_res, rej) => {
    init?.signal?.addEventListener('abort', () => rej(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
  })) as typeof fetch;

test('photo storage gets the longer timeout, everything else the normal one', () => {
  assert.equal(timeoutFor('https://x.supabase.co/storage/v1/object/job-photos/a.jpg'), STORAGE_TIMEOUT_MS);
  assert.equal(timeoutFor('https://x.supabase.co/rest/v1/jobs?id=eq.1'), REQUEST_TIMEOUT_MS);
});

test('a request that never answers gives up as a network failure', async () => {
  const f = makeTimedFetch(hanging, () => 20);
  await assert.rejects(f('https://x/rest/v1/jobs'), (e: unknown) => e instanceof TypeError && /timed out/.test((e as Error).message));
});

test("a caller's own abort still reports as the caller's abort", async () => {
  const f = makeTimedFetch(hanging, () => 10_000);
  const ctl = new AbortController();
  const p = f('https://x/rest/v1/jobs', { signal: ctl.signal });
  ctl.abort();
  await assert.rejects(p, (e: unknown) => (e as Error).name === 'AbortError');
});

test('a quick answer passes straight through', async () => {
  const ok = (async () => new Response('hi', { status: 200 })) as typeof fetch;
  const r = await makeTimedFetch(ok, () => 20)('https://x/rest/v1/jobs');
  assert.equal(await r.text(), 'hi');
});
