/**
 * Stale-write guard for queued edits to records other than jobs (Jeff 2026-11-03):
 * leads, estimates, estimate line items, payroll time entries and photo notes.
 *
 * Same idea as `job-edit-guard`: at enqueue the repo captures a `RecordEditBase`
 * (the values the edit was based on, plus `updated_at` when the table has one);
 * at replay the handler pre-reads the server row and asks `decideRecordEdit`
 * what may be written. Each column has a policy:
 *  - 'ask'         important field: a same-field clash still writes our value and
 *                  is reported, so it is noted in the sync log.
 *  - 'merge-notes' free text: both versions are kept (see `mergeNotes`).
 *  - 'last-wins'   simple field: our value is always written.
 *  - 'derived'     recomputed by the server (e.g. estimate totals from line items):
 *                  written only while the server still holds the base value,
 *                  otherwise silently left to the server. Never a conflict.
 * A column with no policy is treated as 'ask'.
 *
 * Zero imports outside `packages/core/src` and no transport; the handler in
 * `apps/mobile/src/lib/offline-ops/record-edit-guard.ts` does the I/O.
 */

import { sameJobValue } from './job-edit-guard.js';

export type EditPolicy = 'ask' | 'merge-notes' | 'last-wins' | 'derived';

/** Captured at enqueue: the values (and row version, when known) the edit was based on. */
export interface RecordEditBase {
  /** `updated_at` when the editor last saw the row; absent for tables without one. */
  updatedAt?: string;
  /** Column name -> value seen, for every column the edit writes. */
  values: Record<string, unknown>;
}

export interface RecordEditDecision {
  /** Columns safe to write now (merged notes included). */
  apply: Record<string, unknown>;
  /** 'ask' columns where the server changed the same field too; our value was still applied. */
  conflicts: string[];
  /** 'merge-notes' columns written as a merge of both versions. */
  merged: string[];
}

export const LEAD_EDIT_POLICY: Readonly<Record<string, EditPolicy>> = {
  name: 'ask',
  phone: 'ask',
  email: 'ask',
  address: 'ask',
  service: 'ask',
  preferred_date: 'ask',
  preferred_time: 'ask',
  payer: 'ask',
  project_details: 'merge-notes',
  source: 'last-wins',
  source_form: 'last-wins',
  attach_timing: 'last-wins',
};

export const ESTIMATE_EDIT_POLICY: Readonly<Record<string, EditPolicy>> = {
  status: 'ask',
  materials_cost: 'derived',
  labor_cost: 'derived',
  other_cost: 'derived',
  total_cost: 'derived',
  deposit_amount: 'ask',
  scheduled_start: 'ask',
  scheduled_end: 'ask',
  payment_terms: 'ask',
  summary: 'merge-notes',
  materials_notes: 'merge-notes',
  labor_notes: 'merge-notes',
  customer_notes: 'merge-notes',
  internal_notes: 'merge-notes',
  contingencies: 'ask',
  fine_print: 'merge-notes',
  materials_onsite: 'last-wins',
  tracking_number: 'last-wins',
  tracking_status: 'last-wins',
  tracking_checked_at: 'last-wins',
  pdf_delivery: 'last-wins',
  updated_by: 'last-wins',
};

export const ESTIMATE_LINE_EDIT_POLICY: Readonly<Record<string, EditPolicy>> = {
  kind: 'ask',
  description: 'ask',
  quantity: 'ask',
  unit_cost: 'ask',
  line_total: 'derived',
  service_task_id: 'ask',
  materials_note: 'merge-notes',
  unit: 'last-wins',
  area: 'last-wins',
  task_snapshot_at: 'last-wins',
};

export const PAYROLL_TIME_EDIT_POLICY: Readonly<Record<string, EditPolicy>> = {
  work_date: 'ask',
  minutes: 'ask',
  clock_in_at: 'ask',
  clock_out_at: 'ask',
  notes: 'merge-notes',
  source: 'last-wins',
};

/** The photo note is free text kept in the JPEG; both versions are kept. */
export const PHOTO_NOTE_EDIT_POLICY: Readonly<Record<string, EditPolicy>> = {
  description: 'merge-notes',
};

/** Plain-language names used in the conflict message. */
const COLUMN_LABEL: Readonly<Record<string, string>> = {
  preferred_date: 'preferred date',
  preferred_time: 'preferred time',
  materials_cost: 'materials cost',
  labor_cost: 'labor cost',
  other_cost: 'other cost',
  total_cost: 'total',
  deposit_amount: 'deposit',
  scheduled_start: 'start date',
  scheduled_end: 'end date',
  payment_terms: 'payment terms',
  unit_cost: 'unit cost',
  line_total: 'line total',
  service_task_id: 'task',
  work_date: 'work date',
  minutes: 'hours',
  clock_in_at: 'clock-in time',
  clock_out_at: 'clock-out time',
};

/** sameJobValue, plus a number and its numeric string (Postgres numeric) count as equal. */
function same(a: unknown, b: unknown): boolean {
  if (sameJobValue(a, b)) return true;
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  const x = num(a);
  const y = num(b);
  return (typeof a === 'number' || typeof b === 'number') && !Number.isNaN(x) && x === y;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
}

/**
 * Keeps both versions of a note. `server` is what the server holds now, `want`
 * is our text, `base` is what we saw when we edited.
 *  - server empty -> ours.
 *  - server already contains ours -> server (nothing lost).
 *  - ours only appended to the base -> server plus what we appended.
 *  - otherwise -> server, a blank line, then ours.
 */
export function mergeNotes(server: unknown, want: unknown, base: unknown): string {
  const s = text(server);
  const w = text(want);
  const b = text(base);
  if (s.trim() === '') return w;
  if (w.trim() === '' || s.includes(w)) return s;
  if (b !== '' && w.startsWith(b)) {
    const added = w.slice(b.length);
    return s.includes(added.trim()) ? s : `${s}${added}`;
  }
  return `${s}\n\n${w}`;
}

/** Builds the base from the last-seen row values (snake_case columns). */
export function captureRecordEditBase(
  row: Record<string, unknown> | null | undefined,
  columns: readonly string[],
  updatedAt?: string | null,
): RecordEditBase | undefined {
  if (!row) return undefined;
  const values: Record<string, unknown> = {};
  for (const col of columns) {
    if (!(col in row)) continue;
    const v = row[col];
    values[col] = v === undefined ? null : v;
  }
  return typeof updatedAt === 'string' && updatedAt !== '' ? { updatedAt, values } : { values };
}

/** Estimate field (camelCase, as on JobEstimate / JobEstimateInput) -> column. */
export const ESTIMATE_FIELD_TO_COLUMN: Readonly<Record<string, string>> = {
  status: 'status',
  summary: 'summary',
  materialsNotes: 'materials_notes',
  laborNotes: 'labor_notes',
  materialsCost: 'materials_cost',
  laborCost: 'labor_cost',
  otherCost: 'other_cost',
  totalCost: 'total_cost',
  scheduledStart: 'scheduled_start',
  scheduledEnd: 'scheduled_end',
  paymentTerms: 'payment_terms',
  depositAmount: 'deposit_amount',
  customerNotes: 'customer_notes',
  internalNotes: 'internal_notes',
  materialsOnsite: 'materials_onsite',
  trackingNumber: 'tracking_number',
  trackingStatus: 'tracking_status',
  trackingCheckedAt: 'tracking_checked_at',
  finePrint: 'fine_print',
  pdfDelivery: 'pdf_delivery',
  contingencies: 'contingencies',
};

/**
 * Base from a camelCase record the editor saw (e.g. a cached JobEstimate), for the
 * camelCase `fields` the edit writes. Fields the record does not carry are left out,
 * so they are written as if new.
 */
export function captureCamelEditBase(
  record: Record<string, unknown> | null | undefined,
  fields: readonly string[],
  fieldToColumn: Readonly<Record<string, string>>,
): RecordEditBase | undefined {
  if (!record) return undefined;
  const row: Record<string, unknown> = {};
  const columns: string[] = [];
  for (const f of fields) {
    const col = fieldToColumn[f];
    if (!col || !(f in record)) continue;
    row[col] = record[f];
    columns.push(col);
  }
  return captureRecordEditBase(row, columns);
}

/**
 * @param intended the column -> value update the queued op wants to write
 * @param base     captured at enqueue; `undefined` for old queued rows
 * @param server   the server's current values for those columns (plus `updated_at` when the table has one)
 * @param policy   column -> policy; a missing column is 'ask'
 */
export function decideRecordEdit(
  intended: Record<string, unknown>,
  base: RecordEditBase | undefined,
  server: Record<string, unknown>,
  policy: Readonly<Record<string, EditPolicy>>,
): RecordEditDecision {
  if (!base || (base.updatedAt !== undefined && sameJobValue(server.updated_at, base.updatedAt))) {
    return { apply: { ...intended }, conflicts: [], merged: [] };
  }

  const apply: Record<string, unknown> = {};
  const conflicts: string[] = [];
  const merged: string[] = [];

  for (const col of Object.keys(intended)) {
    const want = intended[col];
    const cur = server[col];
    const rule = policy[col] ?? 'ask';

    if (rule === 'last-wins') {
      apply[col] = want;
      continue;
    }
    if (same(cur, want)) continue;
    if (!(col in base.values) || same(cur, base.values[col])) {
      apply[col] = want;
      continue;
    }
    if (rule === 'derived') continue;
    if (rule === 'merge-notes') {
      const next = mergeNotes(cur, want, base.values[col]);
      if (!same(next, cur)) apply[col] = next;
      merged.push(col);
      continue;
    }
    apply[col] = want;
    conflicts.push(col);
  }
  return { apply, conflicts, merged };
}

/** Note written to the sync log when `conflicts` is non-empty. */
export function describeRecordEditConflict(
  conflicts: readonly string[],
  appliedCount: number,
  record = 'record',
): string {
  const names = conflicts.map((c) => COLUMN_LABEL[c] ?? c.replace(/_/g, ' '));
  const list = names.length <= 1 ? (names[0] ?? 'a field') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verb = names.length > 1 ? 'were' : 'was';
  return `Saved your version: the ${record}'s ${list} ${verb} also changed by someone else while you were offline.`;
}
