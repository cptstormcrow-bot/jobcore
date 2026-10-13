import type { CanonicalPayrollExport } from '../types.js';
import { canonicalTotals, formatCents, formatHours } from './canonical.js';

/**
 * Generic RFC 4180 CSV formatter for the canonical payroll export.
 * Pure string work: no I/O, no Node built-ins (ships to Hermes).
 */

const HEADER = [
  'Employee',
  'User ID',
  'Period Start',
  'Period End',
  'Regular Hours',
  'OT Hours',
  'DT Hours',
  'Gross Wages',
  'Reimbursements',
  'Total',
];

/** Neutralise spreadsheet formulas: = + - @ prefix gets a leading single quote. */
function guardFormula(text: string): string {
  const c = text.charAt(0);
  return c === '=' || c === '+' || c === '-' || c === '@' ? `'${text}` : text;
}

function quote(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

function row(fields: string[]): string {
  return fields.map(quote).join(',') + '\r\n';
}

export function toGenericCsv(exp: CanonicalPayrollExport): string {
  let out = row(HEADER);
  for (const l of exp.lines) {
    out += row([
      guardFormula(l.employeeName),
      guardFormula(l.userId),
      exp.periodStart,
      exp.periodEnd,
      formatHours(l.regularMin),
      formatHours(l.otMin),
      formatHours(l.dtMin),
      formatCents(l.grossCents),
      formatCents(l.reimbursementCents),
      formatCents(l.totalCents),
    ]);
  }
  const t = canonicalTotals(exp);
  out += row([
    'TOTAL',
    '',
    '',
    '',
    formatHours(t.regularMin),
    formatHours(t.otMin),
    formatHours(t.dtMin),
    formatCents(t.grossCents),
    formatCents(t.reimbursementCents),
    formatCents(t.totalCents),
  ]);
  return out;
}
