import assert from 'node:assert/strict';
import { test } from 'node:test';

import { toIifGeneralJournal, toIifTimeact } from '../export/iif.js';
import type { CanonicalPayrollExport, QbAccountMap, RunLine } from '../types.js';

const accounts: QbAccountMap = {
  wages_expense: 'Payroll Expenses:Wages',
  reimbursement_expense: 'Reimbursements',
  payroll_payable: 'Payroll Liabilities',
};

const line = (o: Partial<RunLine>): RunLine => ({
  userId: 'u1',
  employeeName: 'Alice',
  regularMin: 0,
  otMin: 0,
  dtMin: 0,
  segments: [],
  grossCents: 0,
  reimbursementCents: 0,
  totalCents: 0,
  ...o,
});

const doc = (lines: RunLine[]): CanonicalPayrollExport => ({
  batchId: 'b1',
  sourceHash: 'h',
  periodStart: '2026-10-04',
  periodEnd: '2026-10-10',
  lines,
});

const rows = (s: string): string[][] => s.split('\r\n').filter((r) => r !== '').map((r) => r.split('\t'));

const HEAD = [
  '!TRNS\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO',
  '!SPL\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO',
  '!ENDTRNS',
];

test('general journal header exact', () => {
  const out = toIifGeneralJournal(doc([]), accounts);
  assert.deepEqual(out.split('\r\n').slice(0, 3), HEAD);
});

test('one transaction nets to zero', () => {
  const out = toIifGeneralJournal(
    doc([line({ grossCents: 28083, reimbursementCents: 1000, totalCents: 29083 })]),
    accounts,
  );
  const r = rows(out).filter((c) => c[0] === 'TRNS' || c[0] === 'SPL');
  assert.equal(r.length, 3);
  assert.equal(r[0]![0], 'TRNS');
  assert.equal(r[0]![3], accounts.wages_expense);
  assert.equal(r[2]![3], accounts.payroll_payable);
  const sumCents = r.reduce((a, c) => a + Math.round(Number(c[4]) * 100), 0);
  assert.equal(sumCents, 0);
  assert.equal(r[2]![4], '-290.83');
  assert.equal(rows(out).filter((c) => c[0] === 'ENDTRNS').length, 1);
});

test('gross-only omits reimbursement SPL', () => {
  const out = toIifGeneralJournal(doc([line({ grossCents: 5000, totalCents: 5000 })]), accounts);
  assert.equal(rows(out).filter((c) => c[0] === 'SPL').length, 1);
});

test('reimbursement-only line uses reimbursement account on TRNS', () => {
  const out = toIifGeneralJournal(doc([line({ reimbursementCents: 1250, totalCents: 1250 })]), accounts);
  const r = rows(out).filter((c) => c[0] === 'TRNS' || c[0] === 'SPL');
  assert.equal(r.length, 2);
  assert.equal(r[0]![0], 'TRNS');
  assert.equal(r[0]![3], accounts.reimbursement_expense);
  assert.equal(r[0]![4], '12.50');
  assert.equal(r[1]![4], '-12.50');
});

test('zero-total line omitted', () => {
  const out = toIifGeneralJournal(doc([line({})]), accounts);
  assert.deepEqual(out.split('\r\n').filter((x) => x !== ''), HEAD);
});

test('inconsistent line throws RangeError naming the user', () => {
  assert.throws(
    () => toIifGeneralJournal(doc([line({ userId: 'u-bad', grossCents: 100, totalCents: 150 })]), accounts),
    (e: unknown) => e instanceof RangeError && e.message.includes('u-bad'),
  );
});

test('tab and newline in a name are sanitized', () => {
  const l = line({ employeeName: 'Al\tice\r\nSmith', regularMin: 60, grossCents: 2500, totalCents: 2500 });
  const gj = rows(toIifGeneralJournal(doc([l]), accounts)).filter((c) => c[0] === 'TRNS' || c[0] === 'SPL');
  assert.ok(gj.every((c) => c.length === 6));
  assert.ok(gj[0]![5]!.includes('Al ice  Smith'));
  const ta = rows(toIifTimeact(doc([l])));
  assert.ok(ta.every((c) => c.length === 11));
  assert.equal(ta[1]![3], 'Al ice  Smith');
});

test('TIMEACT duration 8:05 and 40:00', () => {
  const out = rows(
    toIifTimeact(
      doc([
        line({ userId: 'a', employeeName: 'A', regularMin: 485 }),
        line({ userId: 'b', employeeName: 'B', regularMin: 2000, otMin: 300, dtMin: 100 }),
      ]),
    ),
  );
  assert.equal(out[1]![6], '8:05');
  assert.equal(out[2]![6], '40:00');
  assert.equal(out[1]![9], 'N');
  assert.equal(out[1]![10], '0');
  assert.equal(out[1]![8], 'Payroll 2026-10-04 to 2026-10-10 (8.08/0.00/0.00)');
});

test('dates are MM/DD/YYYY', () => {
  const l = line({ regularMin: 60, grossCents: 100, totalCents: 100 });
  assert.equal(rows(toIifTimeact(doc([l])))[1]![1], '10/10/2026');
  assert.equal(rows(toIifGeneralJournal(doc([l]), accounts))[3]![2], '10/10/2026');
});

test('empty export is headers only (TIMEACT too)', () => {
  assert.equal(
    toIifTimeact(doc([])),
    '!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tPROJ\tNOTE\tXFERTOPAYROLL\tBILLINGSTATUS\r\n',
  );
  assert.equal(toIifGeneralJournal(doc([]), accounts), HEAD.join('\r\n') + '\r\n');
});

test('CRLF endings only', () => {
  const l = line({ regularMin: 60, grossCents: 100, totalCents: 100 });
  for (const out of [toIifGeneralJournal(doc([l]), accounts), toIifTimeact(doc([l]))]) {
    assert.equal(out.replace(/\r\n/g, '').includes('\n'), false);
    assert.equal(out.replace(/\r\n/g, '').includes('\r'), false);
    assert.ok(out.endsWith('\r\n'));
  }
});
