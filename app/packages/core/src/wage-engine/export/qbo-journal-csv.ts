import type { CanonicalPayrollExport, QbAccountMap } from '../types.js';
import { formatCents } from './canonical.js';

/**
 * QuickBooks Online journal-entry CSV formatter. Pure: no I/O, no clock, no
 * Node built-ins. One balanced journal per run line; whole journals are packed
 * into files of at most QBO_JOURNAL_ROW_CAP data rows.
 */

export const QBO_JOURNAL_ROW_CAP = 1000;

const HEADER = 'Journal No.,Journal Date,Account Name,Description,Debits,Credits';

function cell(value: string): string {
  let v = value;
  if (v !== '' && (v[0] === '=' || v[0] === '+' || v[0] === '-' || v[0] === '@')) v = `'${v}`;
  if (/[",\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

function usDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`date must be YYYY-MM-DD, got '${iso}'`);
  return `${m[2]}/${m[3]}/${m[1]}`;
}

export function toQboJournalCsv(exp: CanonicalPayrollExport, accounts: QbAccountMap): string[] {
  const date = usDate(exp.periodEnd);
  const prefix = exp.batchId.slice(0, 8);
  const journals: string[][] = [];
  let n = 0;
  for (const l of exp.lines) {
    const bonus = l.bonusCents ?? 0;
    if (l.grossCents + bonus + l.reimbursementCents !== l.totalCents) {
      throw new RangeError(
        `line ${l.userId} grossCents ${l.grossCents} + bonusCents ${bonus} + reimbursementCents ${l.reimbursementCents} != totalCents ${l.totalCents}`,
      );
    }
    n += 1;
    if (l.totalCents === 0) continue;
    const no = `${prefix}-${n}`;
    const row = (account: string, desc: string, debit: string, credit: string): string =>
      [cell(no), cell(date), cell(account), cell(desc), debit, credit].join(',');
    const rows: string[] = [];
    const base = `${l.employeeName} payroll ${exp.periodStart} to ${exp.periodEnd}`;
    if (l.grossCents > 0) rows.push(row(accounts.wages_expense, base, formatCents(l.grossCents), ''));
    if (bonus > 0) {
      rows.push(
        row(
          accounts.wages_expense,
          `${l.employeeName} job pay ${exp.periodStart} to ${exp.periodEnd}`,
          formatCents(bonus),
          '',
        ),
      );
    }
    if (l.reimbursementCents > 0) {
      rows.push(
        row(
          accounts.reimbursement_expense,
          `${l.employeeName} reimbursement ${exp.periodStart} to ${exp.periodEnd}`,
          formatCents(l.reimbursementCents),
          '',
        ),
      );
    }
    rows.push(row(accounts.payroll_payable, base, '', formatCents(l.totalCents)));
    journals.push(rows);
  }

  const files: string[][] = [[]];
  for (const j of journals) {
    let cur = files[files.length - 1]!;
    if (cur.length > 0 && cur.length + j.length > QBO_JOURNAL_ROW_CAP) {
      cur = [];
      files.push(cur);
    }
    for (const r of j) cur.push(r);
  }
  return files.map((rows) => [HEADER, ...rows].join('\r\n') + '\r\n');
}
