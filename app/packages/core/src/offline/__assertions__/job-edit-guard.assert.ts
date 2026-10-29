import test from 'node:test';
import assert from 'node:assert/strict';

import { captureJobEditBase, decideJobEdit, describeJobEditConflict, sameJobValue } from '../job-edit-guard.js';

const T0 = '2026-10-01T10:00:00+00:00';
const T1 = '2026-10-02T10:00:00+00:00';

const base = { updatedAt: T0, values: { scheduled_start: 'A', address: '1 Main', status: 'assigned' } };

test('no base (old queued row) writes everything as before', () => {
  const d = decideJobEdit({ address: 'X' }, undefined, { updated_at: T1, address: 'server' });
  assert.deepEqual(d, { apply: { address: 'X' }, conflicts: [] });
});

test('server updated_at unchanged writes everything', () => {
  const d = decideJobEdit({ address: 'X' }, base, { updated_at: T0, address: '1 Main' });
  assert.deepEqual(d, { apply: { address: 'X' }, conflicts: [] });
});

test('same instant spelled differently still counts as unchanged', () => {
  const d = decideJobEdit({ address: 'X' }, base, { updated_at: '2026-10-01T10:00:00Z', address: '1 Main' });
  assert.deepEqual(d.apply, { address: 'X' });
});

test('server changed a different field: our edit merges', () => {
  const d = decideJobEdit({ address: 'X' }, base, { updated_at: T1, address: '1 Main', scheduled_start: 'B' });
  assert.deepEqual(d, { apply: { address: 'X' }, conflicts: [] });
});

test('same field changed by the server: server wins, reported', () => {
  const d = decideJobEdit({ address: 'X', scheduled_start: 'C' }, base, { updated_at: T1, address: '1 Main', scheduled_start: 'B' });
  assert.deepEqual(d.apply, { address: 'X' });
  assert.deepEqual(d.conflicts, ['scheduled_start']);
});

test('server already holds our value: no write, no conflict', () => {
  const d = decideJobEdit({ address: 'X' }, base, { updated_at: T1, address: 'X' });
  assert.deepEqual(d, { apply: {}, conflicts: [] });
});

test('lifecycle timestamps are tech-owned and never blocked', () => {
  const d = decideJobEdit(
    { en_route_at: '2026-10-02T09:00:00Z', completed_at: null },
    { updatedAt: T0, values: {} },
    { updated_at: T1, en_route_at: '2026-10-01T09:00:00Z', completed_at: '2026-10-02T12:00:00Z' }
  );
  assert.deepEqual(d, { apply: { en_route_at: '2026-10-02T09:00:00Z' }, conflicts: [] });
});

test('status clash: server wins unless the device stamped a lifecycle time the server lacks', () => {
  const server = { updated_at: T1, status: 'cancelled', en_route_at: null };
  const lose = decideJobEdit({ status: 'en_route' }, base, server);
  assert.deepEqual(lose, { apply: {}, conflicts: ['status'] });
  const win = decideJobEdit({ status: 'en_route', en_route_at: '2026-10-02T09:00:00Z' }, base, server);
  assert.equal(win.apply.status, 'en_route');
  assert.deepEqual(win.conflicts, []);
});

test('column missing from base is treated as a clash when the server differs', () => {
  const d = decideJobEdit({ description: 'X' }, base, { updated_at: T1, description: 'other' });
  assert.deepEqual(d.conflicts, ['description']);
});

test('captureJobEditBase needs updatedAt and records seen values', () => {
  assert.equal(captureJobEditBase(undefined, ['status']), undefined);
  assert.equal(captureJobEditBase({ status: 'new' }, ['status']), undefined);
  assert.deepEqual(captureJobEditBase({ updatedAt: T0, status: 'new', address: null } as never, ['status', 'address', 'bogus']), {
    updatedAt: T0,
    values: { status: 'new', address: null },
  });
});

test('sameJobValue handles timestamps, arrays, null/undefined', () => {
  assert.ok(sameJobValue('2026-10-01T10:00:00Z', '2026-10-01T10:00:00+00:00'));
  assert.ok(sameJobValue(['a'], ['a']));
  assert.ok(sameJobValue(undefined, null));
  assert.ok(!sameJobValue('a', 'b'));
});

test('conflict message is plain language', () => {
  assert.match(describeJobEditConflict(['scheduled_start'], 0), /start time was changed by someone else/);
  assert.match(describeJobEditConflict(['scheduled_start', 'address'], 1), /start time and address were changed.*rest of your edit was saved/);
});
