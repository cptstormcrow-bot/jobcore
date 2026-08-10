import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveConflict, replayQueue, SERVER_WINS_FIELDS, DEVICE_WINS_FIELDS } from '../replay';
import type { Job } from '../../index';
import type { QueuedMutation } from '../queue';

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    organizationId: 'org-1',
    status: 'assigned',
    customerId: null,
    serviceId: null,
    source: null,
    payer: null,
    attachTiming: null,
    requestedWindow: null,
    scheduledStart: null,
    scheduledEnd: null,
    address: null,
    description: null,
    assignedTechId: null,
    enRouteAt: null,
    inProgressAt: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('resolveConflict: server wins on scheduling fields even when device values differ', () => {
  const local = makeJob({
    requestedWindow: 'device-window',
    scheduledStart: 'device-start',
    scheduledEnd: 'device-end',
    assignedTechId: 'device-tech',
  });
  const server = makeJob({
    requestedWindow: 'server-window',
    scheduledStart: 'server-start',
    scheduledEnd: 'server-end',
    assignedTechId: 'server-tech',
  });

  const merged = resolveConflict(local, server);

  for (const field of SERVER_WINS_FIELDS) {
    assert.equal(merged[field], server[field]);
  }
});

test('resolveConflict: device wins on lifecycle timestamps when the device stamped a non-null value', () => {
  const local = makeJob({ enRouteAt: '2026-01-01T10:00:00.000Z', inProgressAt: null, completedAt: null });
  const server = makeJob({ enRouteAt: null, inProgressAt: null, completedAt: null });

  const merged = resolveConflict(local, server);

  assert.equal(merged.enRouteAt, '2026-01-01T10:00:00.000Z');
  for (const field of DEVICE_WINS_FIELDS) {
    if (field !== 'enRouteAt') {
      assert.equal(merged[field], server[field]);
    }
  }
});

test('resolveConflict: a null local timestamp keeps the server value instead of clobbering it with null', () => {
  const local = makeJob({ enRouteAt: null });
  const server = makeJob({ enRouteAt: '2026-01-01T09:00:00.000Z' });

  const merged = resolveConflict(local, server);

  assert.equal(merged.enRouteAt, '2026-01-01T09:00:00.000Z');
});

test('resolveConflict: status takes the local value when the device is ahead of the server', () => {
  const local = makeJob({ status: 'en_route', enRouteAt: '2026-01-01T10:00:00.000Z' });
  const server = makeJob({ status: 'accepted', enRouteAt: null });

  const merged = resolveConflict(local, server);

  assert.equal(merged.status, 'en_route');
});

test('resolveConflict: status keeps the server value when the device has not recorded a newer action', () => {
  const local = makeJob({ status: 'assigned', enRouteAt: null, inProgressAt: null, completedAt: null });
  const server = makeJob({ status: 'accepted', enRouteAt: null, inProgressAt: null, completedAt: null });

  const merged = resolveConflict(local, server);

  assert.equal(merged.status, 'accepted');
});

function makeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: 'mut-1',
    op: 'job.transition.en_route',
    payload: '{}',
    occurredAt: '2026-01-01T00:00:00.000Z',
    status: 'pending',
    attempts: 0,
    ...overrides,
  };
}

test('replayQueue: sends pending rows in order, marks them done, and counts sent', async () => {
  const sent: string[] = [];
  const done: string[] = [];
  const pending = [makeMutation({ id: 'a' }), makeMutation({ id: 'b' })];

  const result = await replayQueue(pending, {
    send: async (mutation) => {
      sent.push(mutation.id);
    },
    markDone: (id) => {
      done.push(id);
    },
  });

  assert.deepEqual(sent, ['a', 'b']);
  assert.deepEqual(done, ['a', 'b']);
  assert.deepEqual(result, { sent: 2, failed: 0 });
});

test('replayQueue: skips rows whose status is not pending, without sending or counting them', async () => {
  const sent: string[] = [];
  const pending = [makeMutation({ id: 'a', status: 'inflight' }), makeMutation({ id: 'b', status: 'pending' })];

  const result = await replayQueue(pending, {
    send: async (mutation) => {
      sent.push(mutation.id);
    },
    markDone: () => {},
  });

  assert.deepEqual(sent, ['b']);
  assert.deepEqual(result, { sent: 1, failed: 0 });
});

test('replayQueue: a failing send is caught, calls markFailed, counts failed, and continues to the next row', async () => {
  const sent: string[] = [];
  const failed: Array<{ id: string; error: unknown }> = [];
  const pending = [makeMutation({ id: 'bad' }), makeMutation({ id: 'good' })];

  const result = await replayQueue(pending, {
    send: async (mutation) => {
      sent.push(mutation.id);
      if (mutation.id === 'bad') {
        throw new Error('send failed');
      }
    },
    markDone: () => {},
    markFailed: (id, error) => {
      failed.push({ id, error });
    },
  });

  assert.deepEqual(sent, ['bad', 'good']);
  assert.equal(failed.length, 1);
  assert.equal(failed[0]?.id, 'bad');
  assert.deepEqual(result, { sent: 1, failed: 1 });
});

test('replayQueue: markFailed is optional-shaped — a failing send with no markFailed does not throw', async () => {
  const pending = [makeMutation({ id: 'bad' })];

  const result = await replayQueue(pending, {
    send: async () => {
      throw new Error('send failed');
    },
    markDone: () => {},
  });

  assert.deepEqual(result, { sent: 0, failed: 1 });
});
