/**
 * Assertions for schedule-items (Calendar Redux slice S5). Timezone-independent:
 * date-only expectations are built with local-time Date constructors.
 * Runs under `node --experimental-strip-types --test`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UNSCHEDULABLE_JOB_STATUSES,
  blackoutScheduleDetail,
  buildScheduleItems,
  isSchedulableJob,
  jobScheduleDetail,
  scheduleItemRef,
} from '../schedule-items';

const job = (over: Record<string, unknown> = {}): any => ({
  id: 'j1',
  jobNumber: 12,
  status: 'scheduled',
  customerName: 'Acme',
  customerPhone: null,
  scheduledStart: '2026-10-22T16:00:00.000Z',
  scheduledEnd: '2026-10-22T17:00:00.000Z',
  address: '1 Main St',
  description: null,
  ...over,
});

const off = (over: Record<string, unknown> = {}): any => ({
  id: 'r1',
  techId: 't1',
  startDate: '2026-10-23',
  endDate: '2026-10-23',
  reason: 'Dentist',
  status: 'approved',
  ...over,
});

test('cancelled, archived and terminal jobs are excluded', () => {
  for (const status of ['cancelled', 'archived', 'closed', 'declined', 'paid', 'completed']) {
    assert.equal(isSchedulableJob(job({ status })), false, status);
    assert.ok(UNSCHEDULABLE_JOB_STATUSES.includes(status as never), status);
  }
  assert.equal(isSchedulableJob(job()), true);
  assert.equal(isSchedulableJob(job({ status: 'needs_reschedule' })), true);
});

test('job with no or invalid scheduledStart is excluded', () => {
  assert.equal(isSchedulableJob(job({ scheduledStart: null })), false);
  assert.equal(isSchedulableJob(job({ scheduledStart: '' })), false);
  assert.equal(isSchedulableJob(job({ scheduledStart: 'nope' })), false);
});

test('currentJobId is marked isCurrent; others are not', () => {
  const items = buildScheduleItems({
    jobs: [job(), job({ id: 'j2', scheduledStart: '2026-10-24T16:00:00.000Z' })],
    timeOff: [],
    employees: [],
    currentJobId: 'j2',
  });
  assert.equal(items.find((i) => i.id === 'job:j1')?.isCurrent, undefined);
  assert.equal(items.find((i) => i.id === 'job:j2')?.isCurrent, true);
  const first = items[0]!;
  assert.equal(first.title, 'Job #12 - Acme');
  assert.equal(first.subtitle, '1 Main St');
});

test('denied and cancelled time off excluded; approved blackout included with title', () => {
  const items = buildScheduleItems({
    jobs: [],
    timeOff: [off({ id: 'a' }), off({ id: 'd', status: 'denied' }), off({ id: 'c', status: 'cancelled' })],
    employees: [{ id: 't1', fullName: 'Pat Tech' }],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]!.id, 'blackout:a');
  assert.equal(items[0]!.kind, 'blackout');
  assert.equal(items[0]!.title, 'Pat Tech - Blackout');
});

test('one-day blackout covers exactly its local day; unknown employee has fallback', () => {
  const [item] = buildScheduleItems({ jobs: [], timeOff: [off()], employees: [] });
  assert.equal(item!.startIso, new Date(2026, 9, 23).toISOString());
  assert.equal(item!.endIso, new Date(2026, 9, 24).toISOString());
  assert.equal(item!.title, 'Unknown tech - Blackout');
});

test('items are ordered by start', () => {
  const items = buildScheduleItems({
    jobs: [job({ id: 'late', scheduledStart: '2030-01-01T10:00:00.000Z' }), job({ id: 'early' })],
    timeOff: [off({ id: 'mid', startDate: '2027-01-01', endDate: '2027-01-02' })],
    employees: [],
  });
  assert.deepEqual(items.map((i) => i.id), ['job:early', 'blackout:mid', 'job:late']);
});

test('job without end keeps endIso null', () => {
  const [item] = buildScheduleItems({ jobs: [job({ scheduledEnd: null })], timeOff: [], employees: [] });
  assert.equal(item!.endIso, null);
});

test('scheduleItemRef round-trips and rejects junk', () => {
  assert.deepEqual(scheduleItemRef('job:abc'), { kind: 'job', ref: 'abc' });
  assert.deepEqual(scheduleItemRef('blackout:x:y'), { kind: 'blackout', ref: 'x:y' });
  assert.equal(scheduleItemRef('other:abc'), null);
  assert.equal(scheduleItemRef('job:'), null);
});

test('jobScheduleDetail keeps address/phone/description keys, null when empty', () => {
  const d = jobScheduleDetail(job(), 'When');
  assert.equal(d.kind, 'job');
  assert.equal(d.title, 'Acme');
  assert.equal(d.phone, null);
  assert.equal(d.description, null);
  assert.equal(d.address, '1 Main St');
  assert.equal(d.openJobId, 'j1');
  assert.ok('phone' in d && 'description' in d && 'address' in d);
  assert.equal(jobScheduleDetail(job({ customerName: null }), 'W').title, 'Job #12');
});

test('blackoutScheduleDetail omits address/phone/openJobId', () => {
  const d = blackoutScheduleDetail(off(), 'Pat Tech', 'When');
  assert.equal(d.kind, 'blackout');
  assert.equal(d.title, 'Pat Tech');
  assert.equal(d.description, 'Dentist');
  assert.equal('address' in d, false);
  assert.equal('phone' in d, false);
  assert.equal('openJobId' in d, false);
  assert.equal(blackoutScheduleDetail(off(), null, 'W').title, 'Unknown');
});
