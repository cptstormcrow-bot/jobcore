import assert from 'node:assert/strict';
import { test } from 'node:test';

import { makeIdempotencyKey } from '../queue';

test('makeIdempotencyKey: builds a deterministic key from op/occurredAt/nonce', () => {
  const key = makeIdempotencyKey('job.transition.en_route', '2026-01-01T00:00:00.000Z', 'nonce-1');
  assert.equal(key, 'job.transition.en_route:2026-01-01T00:00:00.000Z:nonce-1');
});

test('makeIdempotencyKey: is stable across repeated calls with identical inputs', () => {
  const a = makeIdempotencyKey('job.transition.completed', '2026-02-02T00:00:00.000Z', 'abc');
  const b = makeIdempotencyKey('job.transition.completed', '2026-02-02T00:00:00.000Z', 'abc');
  assert.equal(a, b);
});

test('makeIdempotencyKey: differs when any one input differs', () => {
  const base = makeIdempotencyKey('job.transition.paid', '2026-03-03T00:00:00.000Z', 'nonce-a');
  const diffOp = makeIdempotencyKey('job.transition.closed', '2026-03-03T00:00:00.000Z', 'nonce-a');
  const diffTime = makeIdempotencyKey('job.transition.paid', '2026-03-03T00:00:01.000Z', 'nonce-a');
  const diffNonce = makeIdempotencyKey('job.transition.paid', '2026-03-03T00:00:00.000Z', 'nonce-b');

  assert.notEqual(base, diffOp);
  assert.notEqual(base, diffTime);
  assert.notEqual(base, diffNonce);
});
