import assert from 'node:assert/strict';
import { test } from 'node:test';

import { drainQueue, RETRY_MAX_ATTEMPTS, UNKNOWN_MAX_ATTEMPTS, type DrainRow } from '../replay.js';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function row(id: string, extra: Partial<DrainRow> = {}): DrainRow {
  return { id, op: 'x', payload: '{}', occurredAt: NOW.toISOString(), status: 'pending', attempts: 0, ...extra };
}

function harness(fail: Record<string, unknown> = {}) {
  const log: string[] = [];
  const o = {
    send: async (m: DrainRow) => {
      log.push(`send:${m.id}`);
      if (m.id in fail) throw fail[m.id];
    },
    markInflight: async (id: string) => void log.push(`inflight:${id}`),
    markDone: async (id: string) => void log.push(`done:${id}`),
    markRetry: async (id: string, i: { errorClass: string; nextAttemptAt: string }) =>
      void log.push(`retry:${id}:${i.errorClass}:${i.nextAttemptAt}`),
    markFailed: async (id: string, i: { errorClass: string }) => void log.push(`failed:${id}:${i.errorClass}`),
    now: () => NOW,
  };
  return { log, o };
}

test('drainQueue: preserves FIFO order', async () => {
  const { log, o } = harness();
  const r = await drainQueue([row('a'), row('b'), row('c')], o);
  assert.deepEqual(r, { sent: 3, failed: 0, retried: 0, skipped: 0 });
  assert.deepEqual(log.filter((l) => l.startsWith('send:')), ['send:a', 'send:b', 'send:c']);
});

test('drainQueue: permanent -> markFailed and continues', async () => {
  const { log, o } = harness({ a: { status: 400, message: 'bad' } });
  const r = await drainQueue([row('a'), row('b')], o);
  assert.equal(r.failed, 1);
  assert.equal(r.sent, 1);
  assert.ok(log.includes('failed:a:permanent'));
  assert.ok(log.includes('done:b'));
});

test('drainQueue: network -> markRetry, aborted network, stops', async () => {
  const { log, o } = harness({ a: { status: 503, message: 'down' } });
  const r = await drainQueue([row('a', { attempts: 1 }), row('b'), row('c')], o);
  assert.equal(r.aborted, 'network');
  assert.equal(r.retried, 1);
  assert.equal(r.skipped, 2);
  assert.equal(r.sent, 0);
  assert.ok(log.includes('retry:a:network:2026-01-01T00:00:04.000Z'));
  assert.ok(!log.includes('send:b'));
});

test('drainQueue: head not yet due -> aborted backoff, nothing sent', async () => {
  const { log, o } = harness();
  const r = await drainQueue([row('a', { next_attempt_at: '2026-01-01T00:00:05.000Z' }), row('b')], o);
  assert.equal(r.aborted, 'backoff');
  assert.equal(r.skipped, 2);
  assert.equal(r.sent, 0);
  assert.deepEqual(log, []);
});

test('drainQueue: _pkey 23505 is treated as applied', async () => {
  const { log, o } = harness({ a: { code: '23505', message: 'violates "offline_pkey"' } });
  const r = await drainQueue([row('a')], o);
  assert.equal(r.sent, 1);
  assert.equal(r.failed, 0);
  assert.ok(log.includes('done:a'));
});

test('drainQueue: unknown at the 8th attempt -> markFailed', async () => {
  const { log, o } = harness({ a: new Error('weird') });
  const r = await drainQueue([row('a', { attempts: UNKNOWN_MAX_ATTEMPTS - 1 })], o);
  assert.equal(r.failed, 1);
  assert.equal(r.aborted, undefined);
  assert.ok(log.includes('failed:a:unknown'));
});

test('drainQueue: unknown before the cap retries and aborts unknown', async () => {
  const { o } = harness({ a: new Error('weird') });
  const r = await drainQueue([row('a', { attempts: 2 })], o);
  assert.equal(r.aborted, 'unknown');
  assert.equal(r.retried, 1);
});

test('drainQueue: network at RETRY_MAX_ATTEMPTS -> markFailed and continues', async () => {
  const { log, o } = harness({ a: { status: 503, message: 'down' } });
  const r = await drainQueue([row('a', { attempts: RETRY_MAX_ATTEMPTS - 1 }), row('b')], o);
  assert.equal(r.aborted, undefined);
  assert.equal(r.failed, 1);
  assert.equal(r.sent, 1);
  assert.ok(log.includes('failed:a:network'));
  assert.ok(log.includes('done:b'));
});

// Per-job holding (Jeff 2026-11-03): a stuck change waits, other jobs keep sending, its own job's later changes wait behind it.
const byJob = (m: DrainRow): string[] => {
  const j = (JSON.parse(m.payload) as { jobId?: string }).jobId;
  return j ? [`job:${j}`] : [];
};
const jrow = (id: string, jobId: string | null, extra: Partial<DrainRow> = {}): DrainRow =>
  row(id, { payload: JSON.stringify(jobId ? { jobId } : {}), ...extra });

test('drainQueue: unknown error holds that job only, other jobs still send', async () => {
  const { log, o } = harness({ a: { status: 409, message: 'stuck' } });
  const r = await drainQueue([jrow('a', 'J1'), jrow('b', 'J1'), jrow('c', 'J2')], { ...o, groupOf: byJob });
  assert.deepEqual(r, { sent: 1, failed: 0, retried: 1, skipped: 1, aborted: 'unknown' });
  assert.deepEqual(log.filter((l) => l.startsWith('send:')), ['send:a', 'send:c']);
});

test('drainQueue: a not-yet-due row holds its job, other jobs still send', async () => {
  const { log, o } = harness();
  const later = new Date(NOW.getTime() + 60_000).toISOString();
  const r = await drainQueue(
    [jrow('a', 'J1', { next_attempt_at: later }), jrow('b', 'J1'), jrow('c', 'J2')],
    { ...o, groupOf: byJob }
  );
  assert.deepEqual(r, { sent: 1, failed: 0, retried: 0, skipped: 2, aborted: 'backoff' });
  assert.deepEqual(log.filter((l) => l.startsWith('send:')), ['send:c']);
});

test('drainQueue: a stuck row with no job key still holds everything after it', async () => {
  const { log, o } = harness({ a: { status: 409, message: 'stuck' } });
  const r = await drainQueue([jrow('a', null), jrow('b', 'J2')], { ...o, groupOf: byJob });
  assert.equal(r.aborted, 'unknown');
  assert.equal(r.skipped, 1);
  assert.deepEqual(log.filter((l) => l.startsWith('send:')), ['send:a']);
});

test('drainQueue: network still stops the whole pass with groupOf', async () => {
  const { log, o } = harness({ a: { status: 503, message: 'down' } });
  const r = await drainQueue([jrow('a', 'J1'), jrow('b', 'J2')], { ...o, groupOf: byJob });
  assert.equal(r.aborted, 'network');
  assert.deepEqual(log.filter((l) => l.startsWith('send:')), ['send:a']);
});

// Batches (Jeff 2026-11-03): different jobs send at the same time, a job's own changes stay in order.
function slowHarness(fail: Record<string, unknown> = {}, ms: Record<string, number> = {}) {
  const h = harness(fail);
  let live = 0;
  let peak = 0;
  const send = h.o.send;
  h.o.send = async (m: DrainRow) => {
    live++;
    peak = Math.max(peak, live);
    h.log.push(`start:${m.id}`);
    await new Promise((r) => setTimeout(r, ms[m.id] ?? 5));
    live--;
    try {
      await send(m);
    } finally {
      h.log.push(`end:${m.id}`);
    }
  };
  return { ...h, peak: () => peak };
}
const counted = (r: { sent: number; failed: number; retried: number; skipped: number }) =>
  r.sent + r.failed + r.retried + r.skipped;

test('drainQueue batches: different jobs overlap, capped at concurrency', async () => {
  const h = slowHarness();
  const rows = [jrow('a', 'J1'), jrow('b', 'J2'), jrow('c', 'J3'), jrow('d', 'J4'), jrow('e', 'J5')];
  const r = await drainQueue(rows, { ...h.o, groupOf: byJob, concurrency: 3 });
  assert.deepEqual(r, { sent: 5, failed: 0, retried: 0, skipped: 0 });
  assert.equal(h.peak(), 3);
});

test('drainQueue batches: one job stays in queue order', async () => {
  const h = slowHarness({}, { a: 30, b: 1 });
  const r = await drainQueue([jrow('a', 'J1'), jrow('b', 'J1'), jrow('c', 'J2')], { ...h.o, groupOf: byJob, concurrency: 4 });
  assert.equal(r.sent, 3);
  assert.ok(h.log.indexOf('end:a') < h.log.indexOf('start:b'), h.log.join(' '));
  assert.ok(h.log.indexOf('start:c') < h.log.indexOf('end:a'), 'other job does not wait');
});

test('drainQueue batches: a stuck job holds only itself', async () => {
  const h = slowHarness({ a: { status: 409, message: 'stuck' } });
  const r = await drainQueue([jrow('a', 'J1'), jrow('b', 'J1'), jrow('c', 'J2'), jrow('d', 'J2')], {
    ...h.o,
    groupOf: byJob,
    concurrency: 4,
  });
  assert.deepEqual(r, { sent: 2, failed: 0, retried: 1, skipped: 1, aborted: 'unknown' });
  assert.ok(!h.log.includes('send:b'));
});

test('drainQueue batches: network stops new sends, every row counted once', async () => {
  const h = slowHarness({ a: { status: 503, message: 'down' } }, { a: 1, b: 20 });
  const rows = [jrow('a', 'J1'), jrow('b', 'J2'), jrow('c', 'J3'), jrow('d', 'J4'), jrow('e', 'J5')];
  const r = await drainQueue(rows, { ...h.o, groupOf: byJob, concurrency: 2 });
  assert.equal(r.aborted, 'network');
  assert.equal(r.retried, 1);
  assert.equal(r.sent, 1, 'b was already sending and finishes');
  assert.equal(counted(r), rows.length);
  assert.ok(!h.log.includes('send:e'));
});

test('drainQueue batches: a row with no key waits for everything before it', async () => {
  const h = slowHarness({}, { a: 20 });
  const r = await drainQueue([jrow('a', 'J1'), jrow('x', null), jrow('b', 'J2')], { ...h.o, groupOf: byJob, concurrency: 4 });
  assert.equal(r.sent, 3);
  assert.ok(h.log.indexOf('end:a') < h.log.indexOf('start:x'));
  assert.ok(h.log.indexOf('end:x') < h.log.indexOf('start:b'));
});
