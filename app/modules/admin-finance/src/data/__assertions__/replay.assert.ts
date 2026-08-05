/**
 * Assertions for the offline queue replay + conflict contract (P3d.7).
 *
 * Runs under `node --experimental-strip-types --test` — zero new
 * dependencies, zero setup: no DB, no network, no env vars, no faked clock.
 * `replayQueue` is imported from `@jobcore/core` only; this file never
 * imports `offline-db.ts` or `expo-sqlite`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { replayQueue } from '../../../../../packages/core/src/offline/replay';
import type { QueuedMutation, ReplayOptions } from '@jobcore/core';

function makeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: 'mut-1',
    op: 'job.enRoute',
    payload: '{}',
    occurredAt: '2026-08-01T13:00:00.000Z',
    status: 'pending',
    attempts: 0,
    ...overrides,
  };
}

test('all-succeed: 3 queued mutations all send OK -> 3 sent / 0 failed, markDone once per id, markFailed never called', async () => {
  const mutations: QueuedMutation[] = [
    makeMutation({ id: 'm1' }),
    makeMutation({ id: 'm2' }),
    makeMutation({ id: 'm3' }),
  ];

  const doneIds: string[] = [];
  const failedIds: string[] = [];

  const options: ReplayOptions = {
    send: async () => {},
    markDone: (id) => {
      doneIds.push(id);
    },
    markFailed: (id) => {
      failedIds.push(id);
    },
  };

  const result = await replayQueue(mutations, options);

  assert.equal(result.sent, 3);
  assert.equal(result.failed, 0);
  assert.deepEqual(doneIds, ['m1', 'm2', 'm3']);
  assert.deepEqual(failedIds, []);
});

test('all-fail: 2 queued mutations all reject -> 0 sent / 2 failed, markFailed once per id, markDone never called', async () => {
  const mutations: QueuedMutation[] = [
    makeMutation({ id: 'm1' }),
    makeMutation({ id: 'm2' }),
  ];

  const doneIds: string[] = [];
  const failedIds: string[] = [];

  const options: ReplayOptions = {
    send: async () => {
      throw new Error('send failed');
    },
    markDone: (id) => {
      doneIds.push(id);
    },
    markFailed: (id) => {
      failedIds.push(id);
    },
  };

  const result = await replayQueue(mutations, options);

  assert.equal(result.sent, 0);
  assert.equal(result.failed, 2);
  assert.deepEqual(doneIds, []);
  assert.deepEqual(failedIds, ['m1', 'm2']);
});

test('mixed: one succeeds and one rejects -> counts split 1/1 and each id routed to the correct marker', async () => {
  const mutations: QueuedMutation[] = [
    makeMutation({ id: 'ok-1' }),
    makeMutation({ id: 'bad-1' }),
  ];

  const doneIds: string[] = [];
  const failedIds: string[] = [];

  const options: ReplayOptions = {
    send: async (mutation) => {
      if (mutation.id === 'bad-1') {
        throw new Error('send failed');
      }
    },
    markDone: (id) => {
      doneIds.push(id);
    },
    markFailed: (id) => {
      failedIds.push(id);
    },
  };

  const result = await replayQueue(mutations, options);

  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(doneIds, ['ok-1']);
  assert.deepEqual(failedIds, ['bad-1']);
});

test('empty queue: 0 mutations -> 0 sent / 0 failed and neither marker called', async () => {
  const doneIds: string[] = [];
  const failedIds: string[] = [];

  const options: ReplayOptions = {
    send: async () => {},
    markDone: (id) => {
      doneIds.push(id);
    },
    markFailed: (id) => {
      failedIds.push(id);
    },
  };

  const result = await replayQueue([], options);

  assert.equal(result.sent, 0);
  assert.equal(result.failed, 0);
  assert.deepEqual(doneIds, []);
  assert.deepEqual(failedIds, []);
});

test('ordering: mutations are sent SEQUENTIALLY in queue order', async () => {
  const mutations: QueuedMutation[] = [
    makeMutation({ id: 'first' }),
    makeMutation({ id: 'second' }),
    makeMutation({ id: 'third' }),
  ];

  const observedOrder: string[] = [];

  const options: ReplayOptions = {
    send: async (mutation) => {
      observedOrder.push(mutation.id);
    },
    markDone: () => {},
    markFailed: () => {},
  };

  const result = await replayQueue(mutations, options);

  assert.deepEqual(observedOrder, ['first', 'second', 'third']);
  assert.equal(result.sent, 3);
  assert.equal(result.failed, 0);
});
