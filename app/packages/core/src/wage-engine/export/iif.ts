import type { CanonicalPayrollExport, IsoDate, QbAccountMap, RunLine } from '../types.js';
import { formatCents, formatHours } from './canonical.js';

/**
 * QuickBooks Desktop IIF formatters. TAB-separated, CRLF line endings.
 * Pure data: no I/O, no clock, no Node built-ins.
 *
 * UNCONFIRMED: the DURATION (H:MM) and DATE (MM/DD/YYYY) formats have NOT been
 * checked against a real QuickBooks import. Jeff must do a manual first-import
 * check before relying on either format.
 */

const EOL = '\r\n';

/** Replace tab, CR and LF with a single space so a value can never shift columns. */
function clean(text: string): string {
  return text.replace(/[\t\r\n]/g, ' ');
}

function row(cols: string[]): string {
  return cols.map(clean).join('\t');
}

/** 'YYYY-MM-DD' -> 'MM/DD/YYYY'. */
function qbDate(d: IsoDate): string {
  return `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`;
}

function memoFor(l: RunLine): string {
  return `Payroll ${l.employeeName}`;
}

export function toIifGeneralJournal(exp: CanonicalPayrollExport, accounts: QbAccountMap): string {
  const out: string[] = [
    '!TRNS\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO',
    '!SPL\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tMEMO',
    '!ENDTRNS',
  ];
  const date = qbDate(exp.periodEnd);
  for (const l of exp.lines) {
    if (l.totalCents <= 0) continue;
    if (l.grossCents + l.reimbursementCents !== l.totalCents) {
      throw new RangeError(
        `line ${l.userId} totalCents ${l.totalCents} != grossCents ${l.grossCents} + reimbursementCents ${l.reimbursementCents}`,
      );
    }
    const memo = memoFor(l);
    const type = 'GENERAL JOURNAL';
    const debits: { account: string; cents: number }[] = [];
    if (l.grossCents > 0) debits.push({ account: accounts.wages_expense, cents: l.grossCents });
    if (l.reimbursementCents > 0) {
      debits.push({ account: accounts.reimbursement_expense, cents: l.reimbursementCents });
    }
    debits.forEach((d, i) => {
      out.push(row([i === 0 ? 'TRNS' : 'SPL', type, date, d.account, formatCents(d.cents), memo]));
    });
    out.push(row(['SPL', type, date, accounts.payroll_payable, formatCents(-l.totalCents), memo]));
    out.push('ENDTRNS');
  }
  return out.join(EOL) + EOL;
}

function duration(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin - h * 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function toIifTimeact(exp: CanonicalPayrollExport): string {
  const out: string[] = [
    '!TIMEACT\tDATE\tJOB\tEMP\tITEM\tPITEM\tDURATION\tPROJ\tNOTE\tXFERTOPAYROLL\tBILLINGSTATUS',
  ];
  const date = qbDate(exp.periodEnd);
  for (const l of exp.lines) {
    const total = l.regularMin + l.otMin + l.dtMin;
    if (total <= 0) continue;
    const note = `Payroll ${exp.periodStart} to ${exp.periodEnd} (${formatHours(l.regularMin)}/${formatHours(l.otMin)}/${formatHours(l.dtMin)})`;
    out.push(row(['TIMEACT', date, '', l.employeeName, '', '', duration(total), '', note, 'N', '0']));
  }
  return out.join(EOL) + EOL;
}
