import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  stableStringify, buildReadCacheKey, readCacheRevision, selectEvictions,
  registerOpPatches, getOpPatches, READ_CACHE_FLOOR_MS,
} from '../read-cache.js';

test('stableStringify sorts keys', () => {
  assert.equal(stableStringify({ b: 1, a: { d: 2, c: [1, { z: 1, y: 2 }] } }), '{"a":{"c":[1,{"y":2,"z":1}],"d":2},"b":1}');
  assert.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }));
});

test('buildReadCacheKey format', () => {
  assert.equal(buildReadCacheKey('o', 'u', 'q', { b: 1, a: 2 }), 'o:u:q:{"a":2,"b":1}');
});

test('revision subscribe/bump/unsubscribe', () => {
  let n = 0;
  const off = readCacheRevision.subscribe(() => { n += 1; });
  const r0 = readCacheRevision.get();
  readCacheRevision.bump();
  assert.equal(readCacheRevision.get(), r0 + 1);
  assert.equal(n, 1);
  off();
  readCacheRevision.bump();
  assert.equal(n, 1);
});

test('selectEvictions: age first, then LRU to maxBytes', () => {
  const now = 1_000_000;
  const rows = [
    { key: 'old', fetched_at: 0, bytes: 10 },
    { key: 'a', fetched_at: 900_000, bytes: 60 },
    { key: 'b', fetched_at: 950_000, bytes: 60 },
    { key: 'c', fetched_at: 990_000, bytes: 60 },
  ];
  assert.deepEqual(selectEvictions(rows, now, { maxAgeMs: 500_000, maxBytes: 130 }), ['old', 'a']);
  assert.deepEqual(selectEvictions(rows, now, { maxAgeMs: 500_000, maxBytes: 1000 }), ['old']);
});

test('op patches registry', () => {
  registerOpPatches([{ op: 'x.op', queries: ['q1'], patch: (p: number, rows: number[]) => [...rows, p] }]);
  const got = getOpPatches('x.op');
  assert.equal(got.length, 1);
  assert.deepEqual(got[0]!.patch(3, [1]), [1, 3]);
  assert.deepEqual(getOpPatches('none'), []);
  assert.equal(READ_CACHE_FLOOR_MS, 2000);
});
