import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildCanonicalExport,
  canonicalTotals,
  formatCents,
  formatHours,
} from '../export/canonical.js';
import type { RunLine } from '../types.js';

const seg = (hourlyRateCents: number, regularMin: number, otMin = 0, dtMin = 0) => ({
  hourlyRateCents,
  regularMin,
  otMin,
  dtMin,
});

const fixture = (): RunLine[] => [
  {
    userId: 'u-b',
    employeeName: 'Bob',
    regularMin: 2400,
    otMin: 120,
    dtMin: 30,
    segments: [seg(3000, 2400, 120, 30)],
    grossCents: 150000,
    reimbursementCents: 0,
    totalCents: 150000,
  },
  {
    userId: 'u-a',
    employeeName: 'Alice',
    regularMin: 580,
    otMin: 60,
    dtMin: 0,
    segments: [seg(2500, 480, 60), seg(2600, 100)],
    grossCents: 28083,
    reimbursementCents: 1000,
    totalCents: 29083,
  },
];

const base = (lines: RunLine[] = fixture()) => ({
  batchId: 'batch-1',
  periodStart: '2026-10-04',
  periodEnd: '2026-10-10',
  lines,
});

test('hash is deterministic and 14 lowercase hex chars', () => {
  const a = buildCanonicalExport(base());
  const b = buildCanonicalExport(base());
  assert.equal(a.sourceHash, b.sourceHash);
  assert.match(a.sourceHash, /^[0-9a-f]{14}$/);
});

test('reversing input order gives same hash and same output order', () => {
  const a = buildCanonicalExport(base());
  const b = buildCanonicalExport(base(fixture().reverse()));
  assert.equal(a.sourceHash, b.sourceHash);
  assert.deepEqual(a.lines, b.lines);
});

test('one consistent cent change changes the hash', () => {
  const lines = fixture();
  lines[0]!.grossCents += 1;
  lines[0]!.totalCents += 1;
  assert.notEqual(buildCanonicalExport(base(lines)).sourceHash, buildCanonicalExport(base()).sourceHash);
});

test('batchId does not affect the hash', () => {
  const a = buildCanonicalExport(base());
  const b = buildCanonicalExport({ ...base(), batchId: 'batch-2' });
  assert.equal(a.sourceHash, b.sourceHash);
  assert.equal(b.batchId, 'batch-2');
});

test('sorted by name then userId; deep-copied; input unchanged', () => {
  const lines = fixture();
  const snapshot = JSON.stringify(lines);
  const out = buildCanonicalExport(base(lines));
  assert.deepEqual(out.lines.map((l) => l.employeeName), ['Alice', 'Bob']);
  assert.equal(JSON.stringify(lines), snapshot);
  assert.equal(lines[0]!.employeeName, 'Bob');
  for (const o of out.lines) {
    assert.ok(!lines.includes(o));
    const src = lines.find((l) => l.userId === o.userId)!;
    assert.notEqual(o.segments, src.segments);
    assert.notEqual(o.segments[0], src.segments[0]);
  }
  // tie on name sorts by userId
  const tie = fixture();
  tie[0]!.employeeName = 'Alice';
  assert.deepEqual(buildCanonicalExport(base(tie)).lines.map((l) => l.userId), ['u-a', 'u-b']);
  // segment order preserved
  assert.deepEqual(out.lines[0]!.segments.map((s) => s.hourlyRateCents), [2500, 2600]);
});

test('empty lines is a valid export', () => {
  const out = buildCanonicalExport(base([]));
  assert.match(out.sourceHash, /^[0-9a-f]{14}$/);
  assert.deepEqual(canonicalTotals(out), {
    regularMin: 0,
    otMin: 0,
    dtMin: 0,
    grossCents: 0,
    reimbursementCents: 0,
    totalCents: 0,
  });
});

test('validation throws RangeError', () => {
  assert.throws(() => buildCanonicalExport({ ...base(), batchId: '' }), RangeError);
  assert.throws(() => buildCanonicalExport({ ...base(), periodStart: '2026-10-11' }), RangeError);
  assert.throws(() => buildCanonicalExport({ ...base(), periodEnd: '2026-13-40' }), RangeError);
  assert.throws(() => buildCanonicalExport({ ...base(), periodStart: 'nope' }), RangeError);

  const dup = fixture();
  dup[1]!.userId = 'u-b';
  assert.throws(() => buildCanonicalExport(base(dup)), /duplicate userId: u-b/);

  const emptyId = fixture();
  emptyId[0]!.userId = '';
  assert.throws(() => buildCanonicalExport(base(emptyId)), RangeError);

  const negMin = fixture();
  negMin[0]!.otMin = -1;
  assert.throws(() => buildCanonicalExport(base(negMin)), RangeError);

  const fracCents = fixture();
  fracCents[0]!.grossCents = 1.5;
  assert.throws(() => buildCanonicalExport(base(fracCents)), RangeError);

  const badTotal = fixture();
  badTotal[1]!.totalCents += 1;
  assert.throws(() => buildCanonicalExport(base(badTotal)), /totalCents/);

  const badSum = fixture();
  badSum[1]!.regularMin += 1;
  assert.throws(() => buildCanonicalExport(base(badSum)), /regularMin/);

  const badSeg = fixture();
  badSeg[1]!.segments[0]!.hourlyRateCents = -5;
  assert.throws(() => buildCanonicalExport(base(badSeg)), RangeError);
});

test('formatCents', () => {
  assert.equal(formatCents(0), '0.00');
  assert.equal(formatCents(5), '0.05');
  assert.equal(formatCents(123456), '1234.56');
  assert.equal(formatCents(-250), '-2.50');
  assert.throws(() => formatCents(1.5), RangeError);
});

test('formatHours', () => {
  assert.equal(formatHours(0), '0.00');
  assert.equal(formatHours(90), '1.50');
  assert.equal(formatHours(100), '1.67');
  assert.equal(formatHours(2700), '45.00');
  assert.throws(() => formatHours(-1), RangeError);
  assert.throws(() => formatHours(1.5), RangeError);
});

test('canonicalTotals on fixture', () => {
  assert.deepEqual(canonicalTotals(buildCanonicalExport(base())), {
    regularMin: 2980,
    otMin: 180,
    dtMin: 30,
    grossCents: 178083,
    reimbursementCents: 1000,
    totalCents: 179083,
  });
});
