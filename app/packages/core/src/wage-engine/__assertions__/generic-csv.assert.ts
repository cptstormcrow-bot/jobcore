import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildCanonicalExport } from '../export/canonical.js';
import { toGenericCsv } from '../export/generic-csv.js';
import type { RunLine } from '../types.js';

const HEADER =
  'Employee,User ID,Period Start,Period End,Regular Hours,OT Hours,DT Hours,Gross Wages,Reimbursements,Total';

const line = (
  userId: string,
  employeeName: string,
  regularMin: number,
  otMin: number,
  grossCents: number,
  reimbursementCents: number,
): RunLine => ({
  userId,
  employeeName,
  regularMin,
  otMin,
  dtMin: 0,
  segments: [{ hourlyRateCents: 2500, regularMin, otMin, dtMin: 0 }],
  grossCents,
  reimbursementCents,
  totalCents: grossCents + reimbursementCents,
});

const make = (lines: RunLine[]) =>
  buildCanonicalExport({ batchId: 'b1', periodStart: '2026-10-01', periodEnd: '2026-10-15', lines });

test('header row exact', () => {
  const rows = toGenericCsv(make([])).split('\r\n');
  assert.equal(rows[0], HEADER);
});

test('one line row values', () => {
  const csv = toGenericCsv(make([line('u1', 'Alice', 480, 90, 20000, 1050)]));
  assert.equal(csv.split('\r\n')[1], 'Alice,u1,2026-10-01,2026-10-15,8.00,1.50,0.00,200.00,10.50,210.50');
});

test('comma, quote and newline in name are quoted and escaped', () => {
  const csv = toGenericCsv(make([line('u1', 'Smith, "Bob"\nJr', 60, 0, 100, 0)]));
  assert.ok(csv.includes('"Smith, ""Bob""\nJr",u1,'));
});

test('formula guard prefixes single quote', () => {
  for (const c of ['=', '+', '-', '@']) {
    const csv = toGenericCsv(make([line('u1', `${c}CMD`, 60, 0, 100, 0)]));
    assert.equal(csv.split('\r\n')[1]!.split(',')[0], `'${c}CMD`);
  }
});

test('TOTAL row equals sum of lines', () => {
  const csv = toGenericCsv(
    make([line('u1', 'Alice', 480, 90, 20000, 1050), line('u2', 'Bob', 120, 30, 5000, 0)]),
  );
  const rows = csv.split('\r\n');
  assert.equal(rows[3], 'TOTAL,,,,10.00,2.00,0.00,250.00,10.50,260.50');
});

test('empty export is header plus zero TOTAL', () => {
  assert.equal(toGenericCsv(make([])), `${HEADER}\r\nTOTAL,,,,0.00,0.00,0.00,0.00,0.00,0.00\r\n`);
});

test('CRLF endings and trailing CRLF, no bare LF', () => {
  const csv = toGenericCsv(make([line('u1', 'Alice', 60, 0, 100, 0)]));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.replace(/\r\n/g, '').includes('\n'), false);
});

test('money under 100 cents formats as 0.05', () => {
  const csv = toGenericCsv(make([line('u1', 'Alice', 0, 0, 5, 0)]));
  assert.equal(csv.split('\r\n')[1], 'Alice,u1,2026-10-01,2026-10-15,0.00,0.00,0.00,0.05,0.00,0.05');
});

test('job pay adds a Job Pay column only when some line has bonusCents; totals tie', () => {
  const l: RunLine = { ...line('u1', 'Alice', 60, 0, 1000, 200), bonusCents: 500, totalCents: 1700 };
  const csv = toGenericCsv(make([l]));
  const r = csv.split('\r\n');
  assert.equal(
    r[0],
    'Employee,User ID,Period Start,Period End,Regular Hours,OT Hours,DT Hours,Gross Wages,Job Pay,Reimbursements,Total',
  );
  assert.equal(r[1], 'Alice,u1,2026-10-01,2026-10-15,1.00,0.00,0.00,10.00,5.00,2.00,17.00');
  assert.equal(r[2], 'TOTAL,,,,1.00,0.00,0.00,10.00,5.00,2.00,17.00');
});

test('zero bonusCents keeps the original header and rows', () => {
  const csv = toGenericCsv(make([{ ...line('u1', 'Alice', 0, 0, 5, 0), bonusCents: 0 }]));
  assert.equal(csv.split('\r\n')[0], HEADER);
});
