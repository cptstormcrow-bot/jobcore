import test from 'node:test';
import assert from 'node:assert/strict';

import { canSendInline, filterRunnable, groupOf, makeLock, planStageSave } from './queue-order';
import type { QueueStatus } from './offline-db.types';

type Row = { id: string; op: string; payload: string; status: QueueStatus; user_id?: string | null };
const row = (id: string, op: string, p: Record<string, unknown>, status: QueueStatus = 'pending', user_id: string | null = null): Row => ({
  id, op, payload: JSON.stringify(p), status, user_id,
});
const ids = (rows: Row[]) => rows.map((r) => r.id);

test('groupOf reads job, lead, photo, employee and batch keys', () => {
  assert.deepEqual(groupOf(row('a', 'job.assign', { id: 'j1' })), ['job:j1']);
  assert.deepEqual(groupOf(row('a', 'job_note.add', { jobId: 'j1' })), ['job:j1']);
  assert.deepEqual(groupOf(row('a', 'estimate.save', { draft: { job_id: 'j2' } })), ['job:j2']);
  assert.deepEqual(groupOf(row('a', 'lead.update', { id: 'l1' })), ['lead:l1']);
  assert.deepEqual(groupOf(row('a', 'job_photo.add', { id: 'p1', jobId: 'j1' })), ['job:j1', 'photo:p1']);
  assert.deepEqual(groupOf(row('a', 'payout.mark', { profileId: 'e1', batchId: 'b1' })), ['employee:e1', 'payout_batch:b1']);
  assert.deepEqual(groupOf({ op: 'x', payload: 'not json' }), []);
});

test('time entries, timesheet submits and time off get their own keys', () => {
  assert.deepEqual(groupOf(row('a', 'payroll_time.upsert', { id: 't1', userId: 'u1' }, 'pending', 'u1')), ['payroll:u1']);
  assert.deepEqual(groupOf(row('a', 'payroll_time.delete', { id: 't1' }, 'pending', 'u1')), ['payroll:u1']);
  assert.deepEqual(groupOf(row('a', 'payroll_timesheet.submit', { id: 'u1:w' }, 'pending', 'u1')), ['payroll:u1']);
  assert.deepEqual(groupOf(row('a', 'time_off_request.create', { id: 'r1', techId: 'u1' })), ['time_off:r1']);
  assert.deepEqual(groupOf(row('a', 'time_off_request.cancel', { requestId: 'r1' })), ['time_off:r1']);
});

test("a submit waits behind its week's time entry, and a job change does not", () => {
  const rows = [
    row('1', 'payroll_time.upsert', { id: 't1' }, 'inflight', 'u1'),
    row('2', 'payroll_timesheet.submit', { id: 'u1:w' }, 'pending', 'u1'),
    row('3', 'job.assign', { id: 'j1' }, 'pending', 'u1'),
  ];
  assert.deepEqual(ids(filterRunnable(rows, 'u1')), ['3']);
});

test('a change being sent holds later changes to the same job only', () => {
  const rows = [
    row('1', 'job.assign', { id: 'j1' }, 'inflight'),
    row('2', 'job_note.add', { jobId: 'j1' }),
    row('3', 'job_note.add', { jobId: 'j2' }),
  ];
  assert.deepEqual(ids(filterRunnable(rows, 'u1')), ['3']);
});

test('a change being sent with no known records holds everything after it', () => {
  const rows = [row('1', 'misc.op', {}, 'inflight'), row('2', 'job_note.add', { jobId: 'j2' })];
  assert.deepEqual(ids(filterRunnable(rows, 'u1')), []);
});

test("another person's change waits and holds only its own records", () => {
  const rows = [
    row('1', 'job.assign', { id: 'j1' }, 'pending', 'other'),
    row('2', 'job_note.add', { jobId: 'j1' }, 'pending', 'u1'),
    row('3', 'job_note.add', { jobId: 'j2' }, 'pending', 'u1'),
  ];
  assert.deepEqual(ids(filterRunnable(rows, 'u1')), ['3']);
  // On its own, another person's change never blocks the whole queue.
  const alone = [row('1', 'job.assign', { id: 'j1' }, 'pending', 'other'), row('4', 'misc.op', {}, 'pending', 'u1')];
  assert.deepEqual(ids(filterRunnable(alone, 'u1')), ['4']);
});

test('rows from before owners were recorded send for anyone', () => {
  assert.deepEqual(ids(filterRunnable([row('1', 'job.assign', { id: 'j1' })], 'u1')), ['1']);
  assert.deepEqual(ids(filterRunnable([row('1', 'job.assign', { id: 'j1' }, 'pending', 'u2')], null)), ['1']);
});

test('a change with no known records waits behind a held change', () => {
  const rows = [
    row('1', 'job.assign', { id: 'j1' }, 'inflight'),
    row('2', 'misc.op', {}),
    row('3', 'job_note.add', { jobId: 'j2' }),
  ];
  assert.deepEqual(ids(filterRunnable(rows, 'u1')), []);
});

test('failed and done rows are ignored', () => {
  const rows = [row('1', 'job.assign', { id: 'j1' }, 'failed'), row('2', 'job_note.add', { jobId: 'j1' })];
  assert.deepEqual(ids(filterRunnable(rows, 'u1')), ['2']);
});

test('the lock runs jobs one at a time in call order, even after a throw', async () => {
  const lock = makeLock();
  const order: string[] = [];
  const slow = lock(async () => { await new Promise((r) => setTimeout(r, 20)); order.push('a'); });
  const bad = lock(async () => { order.push('b'); throw new Error('x'); });
  const fast = lock(async () => { order.push('c'); return 7; });
  await slow;
  await assert.rejects(bad);
  assert.equal(await fast, 7);
  assert.deepEqual(order, ['a', 'b', 'c']);
});

test('stage save drops older pending stage changes it replaces', () => {
  const rows = [
    row('1', 'job.update_status', { jobId: 'j1', status: 'en_route' }),
    row('2', 'job.patch_lifecycle', { jobId: 'j1', patch: { completedAt: 'x' } }),
    row('3', 'job.update_status', { jobId: 'j2', status: 'en_route' }),
  ];
  assert.deepEqual(planStageSave(rows, 'j1', ['completedAt']), { mustQueue: false, dropIds: ['1', '2'] });
});

test('stage save queues behind a change to the same job that is being sent right now', () => {
  const rows = [row('1', 'job.update_status', { jobId: 'j1', status: 'en_route' }, 'inflight')];
  assert.deepEqual(planStageSave(rows, 'j1', ['completedAt']), { mustQueue: true, dropIds: [] });
});

test('stage save queues behind an unsent create, a note, or a lifecycle change it does not cover', () => {
  assert.equal(planStageSave([row('1', 'job.create', { id: 'j1' })], 'j1', []).mustQueue, true);
  assert.equal(planStageSave([row('1', 'job_note.add', { jobId: 'j1' })], 'j1', []).mustQueue, true);
  const life = [row('1', 'job.patch_lifecycle', { jobId: 'j1', patch: { enRouteAt: 'x' } })];
  assert.equal(planStageSave(life, 'j1', ['completedAt']).mustQueue, true);
});

test('stage save ignores failed rows and other jobs', () => {
  const rows = [row('1', 'job.update_status', { jobId: 'j1' }, 'failed'), row('2', 'job_note.add', { jobId: 'j2' }, 'inflight')];
  assert.deepEqual(planStageSave(rows, 'j1', []), { mustQueue: false, dropIds: [] });
});

test('canSendInline: a stuck row on another job does not make an online save queue', () => {
  const stuck = [row('1', 'job.assign', { id: 'j1' }, 'pending', 'u1')];
  assert.equal(canSendInline([], { op: 'job_note.add', payload: JSON.stringify({ jobId: 'j2' }) }), true);
  assert.equal(canSendInline(stuck, { op: 'job_note.add', payload: JSON.stringify({ jobId: 'j2' }) }), true);
  // same job waits, so order holds
  assert.equal(canSendInline(stuck, { op: 'job_note.add', payload: JSON.stringify({ jobId: 'j1' }) }), false);
  // unknown records wait for everything
  assert.equal(canSendInline(stuck, { op: 'x', payload: 'not json' }), false);
  // an unknown row being sent holds everything; one only waiting does not
  const unknownInflight = [row('2', 'x', {}, 'inflight')];
  assert.equal(canSendInline(unknownInflight, { op: 'job_note.add', payload: JSON.stringify({ jobId: 'j2' }) }), false);
  const unknownPending = [row('3', 'x', {}, 'pending')];
  assert.equal(canSendInline(unknownPending, { op: 'job_note.add', payload: JSON.stringify({ jobId: 'j2' }) }), true);
});
