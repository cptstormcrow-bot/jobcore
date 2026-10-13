import assert from 'node:assert/strict';
import { test } from 'node:test';

import { QBO_JOURNAL_ROW_CAP, toQboJournalCsv } from '../export/qbo-journal-csv.js';
import type { CanonicalPayrollExport, QbAccountMap, RunLine } from '../types.js';

const accounts: QbAccountMap = {
  wages_expense: 'Wages',
  reimbursement_expense: 'Reimbursements',
  payroll_payable: 'Payroll Payable',
};

const HEADER = 'Journal No.,Journal Date,Account Name,Description,Debits,Credits';

const line = (userId: string, name: string, gross: number, reimb: number): RunLine => ({
  userId,
  employeeName: name,
  regularMin: 0,
  otMin: 0,
  dtMin: 0,
  segments: [],
  grossCents: gross,
  reimbursementCents: reimb,
  totalCents: gross + reimb,
});

const exp = (lines: RunLine[]): CanonicalPayrollExport => ({
  batchId: 'abcdef0123456789',
  sourceHash: 'x',
  periodStart: '2026-10-05',
  periodEnd: '2026-10-11',
  lines,
});

const dataRows = (file: string): string[] => file.split('\r\n').slice(1, -1);

const sums = (file: string): { d: number; c: number } => {
  let d = 0;
  let c = 0;
  for (const r of dataRows(file)) {
    const f = r.split(',');
    const cr = f[f.length - 1]!;
    const db = f[f.length - 2]!;
    if (db !== '') d += Math.round(Number(db) * 100);
    if (cr !== '') c += Math.round(Number(cr) * 100);
  }
  return { d, c };
};

test('header exact, CRLF, trailing CRLF', () => {
  const [f] = toQboJournalCsv(exp([line('u1', 'Alice', 1000, 0)]), accounts);
  assert.ok(f!.startsWith(HEADER + '\r\n'));
  assert.ok(f!.endsWith('\r\n'));
});

test('one employee wages + reimbursement balances', () => {
  const files = toQboJournalCsv(exp([line('u1', 'Alice', 28083, 1000)]), accounts);
  assert.equal(files.length, 1);
  assert.deepEqual(dataRows(files[0]!), [
    'abcdef01-1,10/11/2026,Wages,Alice payroll 2026-10-05 to 2026-10-11,280.83,',
    'abcdef01-1,10/11/2026,Reimbursements,Alice reimbursement 2026-10-05 to 2026-10-11,10.00,',
    'abcdef01-1,10/11/2026,Payroll Payable,Alice payroll 2026-10-05 to 2026-10-11,,290.83',
  ]);
  const s = sums(files[0]!);
  assert.equal(s.d, s.c);
});

test('zero reimbursement omits that row', () => {
  const files = toQboJournalCsv(exp([line('u1', 'Alice', 5000, 0)]), accounts);
  assert.equal(dataRows(files[0]!).length, 2);
  assert.ok(!files[0]!.includes('Reimbursements'));
});

test('multi-employee debits equal credits', () => {
  const files = toQboJournalCsv(
    exp([line('u1', 'A', 12345, 99), line('u2', 'B', 0, 700), line('u3', 'C', 1, 0), line('u4', 'D', 0, 0)]),
    accounts,
  );
  const s = sums(files[0]!);
  assert.equal(s.d, s.c);
  assert.equal(s.c, 12345 + 99 + 700 + 1);
  assert.ok(!files[0]!.includes('-4,'));
});

test('journal date is MM/DD/YYYY', () => {
  const [f] = toQboJournalCsv(exp([line('u1', 'A', 100, 0)]), accounts);
  assert.ok(dataRows(f!)[0]!.startsWith('abcdef01-1,10/11/2026,'));
});

test('400 lines chunk without splitting a journal; each file balanced and capped', () => {
  const lines: RunLine[] = [];
  for (let i = 0; i < 400; i++) lines.push(line(`u${i}`, `Emp${i}`, 1000 + i, 50));
  const files = toQboJournalCsv(exp(lines), accounts);
  assert.ok(files.length > 1);
  let total = 0;
  for (const f of files) {
    const rows = dataRows(f);
    assert.ok(rows.length <= QBO_JOURNAL_ROW_CAP);
    assert.ok(f.startsWith(HEADER + '\r\n'));
    const s = sums(f);
    assert.equal(s.d, s.c);
    total += rows.length;
    // every journal in this file has all 3 rows
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const k = r.split(',')[0]!;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const k of Object.keys(counts)) assert.equal(counts[k], 3);
  }
  assert.equal(total, 1200);
});

test('inconsistent line throws RangeError naming userId', () => {
  const bad = line('u-bad', 'Bad', 1000, 0);
  bad.totalCents = 999;
  assert.throws(() => toQboJournalCsv(exp([bad]), accounts), (e: unknown) => {
    return e instanceof RangeError && e.message.includes('u-bad');
  });
});

test('empty export returns one header-only file', () => {
  const files = toQboJournalCsv(exp([]), accounts);
  assert.deepEqual(files, [HEADER + '\r\n']);
  const z = toQboJournalCsv(exp([line('u1', 'Z', 0, 0)]), accounts);
  assert.deepEqual(z, [HEADER + '\r\n']);
});

test('names with commas are quoted; formula guard applied', () => {
  const [f] = toQboJournalCsv(exp([line('u1', 'Smith, Bob', 100, 0), line('u2', '=cmd', 100, 0)]), accounts);
  assert.ok(f!.includes('"Smith, Bob payroll 2026-10-05 to 2026-10-11"'));
  assert.ok(f!.includes("'=cmd payroll"));
});
