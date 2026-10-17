/**
 * Assertions for buildJobTimeline. Runs under
 * `node --experimental-strip-types --test` — no DB, network, env or clock.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildJobTimeline } from '../job-timeline';

const empty = (over: Record<string, unknown> = {}) =>
  ({
    jobCreatedAt: null,
    audit: [],
    contacts: [],
    notes: [],
    segments: [],
    payments: [],
    calendar: [],
    failures: [],
    ...over,
  }) as any;

test('empty sources with null jobCreatedAt returns []', () => {
  assert.deepEqual(buildJobTimeline(empty()), []);
});

test('first item is the created entry with null actor', () => {
  const out = buildJobTimeline(
    empty({
      jobCreatedAt: '2026-01-01T10:00:00Z',
      audit: [{ action: 'status_change', actorId: 'u1', createdAt: '2026-01-02T10:00:00Z' }],
    }),
  );
  const first = out[0];
  assert.ok(first !== undefined, 'expected a first timeline item');
  assert.equal(first.kind, 'created');
  assert.equal(first.label, 'Job created (first contact)');
  assert.equal(first.actor, null);
});

test('items are sorted ascending by time', () => {
  const out = buildJobTimeline(
    empty({
      jobCreatedAt: '2026-01-01T10:00:00Z',
      audit: [{ action: 'late', actorId: 'u1', createdAt: '2026-03-01T10:00:00Z' }],
      notes: [{ kind: 'note', body: 'mid', techId: 't1', occurredAt: '2026-02-01T10:00:00Z' }],
      payments: [{ amount: 5, status: 'confirmed', method: 'cash', createdAt: '2026-01-15T10:00:00Z' }],
    }),
  );
  const times = out.map((i: any) => new Date(i.at).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.equal(out.length, 4);
});

test('voided segments are dropped', () => {
  const out = buildJobTimeline(
    empty({
      segments: [
        { reasonCode: 'work', startedAt: '2026-01-02T10:00:00Z', endedAt: '2026-01-02T11:00:00Z', techId: 't1', voidedAt: '2026-01-03T00:00:00Z' },
        { reasonCode: 'work', startedAt: '2026-01-04T10:00:00Z', endedAt: '2026-01-04T11:00:00Z', techId: 't1', voidedAt: null },
      ],
    }),
  );
  assert.equal(out.length, 1);
  const first = out[0];
  assert.ok(first !== undefined, 'expected a first timeline item');
  assert.ok(new Date(first.at).getTime() === new Date('2026-01-04T10:00:00Z').getTime());
});

test('rows with unparsable timestamps are dropped', () => {
  const out = buildJobTimeline(
    empty({
      audit: [
        { action: 'bad', actorId: 'u1', createdAt: 'not-a-date' },
        { action: 'good', actorId: 'u1', createdAt: '2026-01-02T10:00:00Z' },
      ],
      contacts: [{ contactType: 'call', note: 'x', contactedBy: 'u1', createdAt: 'garbage' }],
    }),
  );
  assert.equal(out.length, 1);
});

test('long note labels are truncated with an ellipsis', () => {
  const body = 'a'.repeat(300);
  const out = buildJobTimeline(
    empty({ notes: [{ kind: 'note', body, techId: 't1', occurredAt: '2026-01-02T10:00:00Z' }] }),
  );
  assert.equal(out.length, 1);
  const first = out[0];
  assert.ok(first !== undefined, 'expected a first timeline item');
  assert.ok(first.label.length <= 125, `label too long: ${first.label.length}`);
  assert.ok(/(…|\.\.\.)$/.test(first.label));
});

test('payment label shows amount, status and method', () => {
  const out = buildJobTimeline(
    empty({ payments: [{ amount: 12.5, status: 'confirmed', method: 'cash', createdAt: '2026-01-02T10:00:00Z' }] }),
  );
  const first = out[0];
  assert.ok(first !== undefined, 'expected a first timeline item');
  assert.equal(first.label, 'Payment $12.50 (confirmed, cash)');
});

test('inputs are not mutated', () => {
  const src = empty({
    jobCreatedAt: '2026-01-01T10:00:00Z',
    audit: [
      { action: 'b', actorId: 'u1', createdAt: '2026-02-01T10:00:00Z' },
      { action: 'a', actorId: 'u1', createdAt: '2026-01-02T10:00:00Z' },
    ],
  });
  const before = JSON.stringify(src);
  buildJobTimeline(src);
  assert.equal(JSON.stringify(src), before);
});
