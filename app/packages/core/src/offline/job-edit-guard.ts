/**
 * Stale-write guard for queued job edits.
 *
 * A queued edit used to overwrite whatever the server held when it finally
 * replayed (last write wins). This module is the pure decision half of the
 * fix: at enqueue time the repo captures a `JobEditBase` (the row's
 * `updated_at` plus the value of every column the edit touches); at replay the
 * handler pre-reads the server row and asks `decideJobEdit` which columns may
 * be written.
 *
 * Zero imports outside `packages/core/src` and no transport; the handler in
 * `apps/mobile/src/lib/offline-ops/job-edit-guard.ts` does the I/O.
 *
 * Conflict rule (mirrors `resolveConflict` in `./replay`):
 *  - No base on the payload (rows queued before this shipped) or the server
 *    `updated_at` still equals the base -> write everything, as before.
 *  - Otherwise, per column the edit touches:
 *      * lifecycle timestamps (DEVICE_WINS_FIELDS: en_route_at, in_progress_at,
 *        completed_at) are tech-owned and always written when non-null; a null
 *        never clobbers a server value.
 *      * server already holds the value we want -> nothing to do.
 *      * server still holds the value we saw when we edited -> the server did not
 *        touch this field, so our change merges in.
 *      * `status` where the device stamped a lifecycle timestamp the server has
 *        not seen -> the device is ahead (resolveConflict's "localIsAhead"), our
 *        status merges in.
 *      * anything else is a true clash on the same field: the server wins
 *        (resolveConflict takes the server value for every non-lifecycle
 *        field), our value is dropped and the column is reported in `conflicts`.
 */

import type { Job } from '../index.js';
import { resolveConflict } from './replay.js';

/** Captured at enqueue: the row version and the values the edit was based on. */
export interface JobEditBase {
  /** `jobs.updated_at` when the editor last saw the row. */
  updatedAt: string;
  /** Column name -> value seen, for every column the edit writes. */
  values: Record<string, unknown>;
}

/** `jobs` column -> `Job` field, for the columns the guarded ops write. */
export const JOB_COLUMN_TO_FIELD: Readonly<Record<string, keyof Job>> = {
  status: 'status',
  assigned_tech_id: 'assignedTechId',
  scheduled_start: 'scheduledStart',
  scheduled_end: 'scheduledEnd',
  requested_window: 'requestedWindow',
  address: 'address',
  description: 'description',
  house_age_years: 'houseAgeYears',
  ingress_instructions: 'ingressInstructions',
  service_area_id: 'service_area_id',
  permit_status: 'permitStatus',
  parking_available: 'parkingAvailable',
  rooms: 'rooms',
  panel_info: 'panelInfo',
  considerations: 'considerations',
  customer_id: 'customerId',
  en_route_at: 'enRouteAt',
  in_progress_at: 'inProgressAt',
  completed_at: 'completedAt',
};

/** Plain-language names used in the conflict message. */
const COLUMN_LABEL: Readonly<Record<string, string>> = {
  status: 'status',
  assigned_tech_id: 'assigned tech',
  scheduled_start: 'start time',
  scheduled_end: 'end time',
  requested_window: 'requested window',
  address: 'address',
  description: 'description',
  house_age_years: 'house age',
  ingress_instructions: 'ingress instructions',
  service_area_id: 'service area',
  permit_status: 'permit status',
  parking_available: 'parking',
  rooms: 'rooms',
  panel_info: 'panel info',
  considerations: 'considerations',
  customer_id: 'customer',
};

const LIFECYCLE_COLUMNS = ['en_route_at', 'in_progress_at', 'completed_at'] as const;

const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;

/** Value equality tolerant of timestamp spellings ("Z" vs "+00:00") and arrays. */
export function sameJobValue(a: unknown, b: unknown): boolean {
  const an = a === undefined ? null : a;
  const bn = b === undefined ? null : b;
  if (an === bn) return true;
  if (typeof an === 'string' && typeof bn === 'string' && ISO_RE.test(an) && ISO_RE.test(bn)) {
    const x = Date.parse(an);
    const y = Date.parse(bn);
    return !Number.isNaN(x) && x === y;
  }
  if (typeof an === 'object' && typeof bn === 'object' && an !== null && bn !== null) {
    return JSON.stringify(an) === JSON.stringify(bn);
  }
  return false;
}

/**
 * Builds the base for an edit from the last-seen job. Returns `undefined`
 * (-> old last-write-wins behavior) when the job or its `updatedAt` is unknown.
 */
export function captureJobEditBase(
  job: Partial<Job> | null | undefined,
  columns: readonly string[]
): JobEditBase | undefined {
  if (!job || typeof job.updatedAt !== 'string' || job.updatedAt === '') return undefined;
  const values: Record<string, unknown> = {};
  for (const col of columns) {
    const field = JOB_COLUMN_TO_FIELD[col];
    if (!field) continue;
    const v = job[field];
    values[col] = v === undefined ? null : v;
  }
  return { updatedAt: job.updatedAt, values };
}

export interface JobEditDecision {
  /** Columns safe to write now. */
  apply: Record<string, unknown>;
  /** Columns where the server changed the same field; our value was dropped. */
  conflicts: string[];
}

/**
 * @param intended the column -> value update the queued op wants to write
 * @param base     captured at enqueue; `undefined` for old queued rows
 * @param server   the server's current values for those columns plus `updated_at`
 */
export function decideJobEdit(
  intended: Record<string, unknown>,
  base: JobEditBase | undefined,
  server: Record<string, unknown>
): JobEditDecision {
  if (!base || sameJobValue(server.updated_at, base.updatedAt)) {
    return { apply: { ...intended }, conflicts: [] };
  }

  const apply: Record<string, unknown> = {};
  const conflicts: string[] = [];

  // Did the device stamp a lifecycle timestamp the server has not seen yet?
  // (the device-ahead condition that lets a status through in resolveConflict)
  const localJob = {} as Record<string, unknown>;
  const serverJob = {} as Record<string, unknown>;
  for (const col of LIFECYCLE_COLUMNS) {
    const field = JOB_COLUMN_TO_FIELD[col]!;
    localJob[field] = intended[col] === undefined ? null : intended[col];
    serverJob[field] = server[col] === undefined ? null : server[col];
  }
  localJob.status = 'device';
  serverJob.status = 'server';
  const deviceAhead =
    (resolveConflict(localJob as unknown as Job, serverJob as unknown as Job).status as string) === 'device';

  for (const col of Object.keys(intended)) {
    const want = intended[col];
    const cur = server[col];

    if ((LIFECYCLE_COLUMNS as readonly string[]).includes(col)) {
      if (want !== null && want !== undefined) apply[col] = want;
      continue;
    }
    if (sameJobValue(cur, want)) continue;
    if (col in base.values && sameJobValue(cur, base.values[col])) {
      apply[col] = want;
      continue;
    }
    if (col === 'status' && deviceAhead) {
      apply[col] = want;
      continue;
    }
    conflicts.push(col);
  }
  return { apply, conflicts };
}

/** Message shown on the Sync issues screen when `conflicts` is non-empty. */
export function describeJobEditConflict(conflicts: readonly string[], appliedCount: number): string {
  const names = conflicts.map((c) => COLUMN_LABEL[c] ?? c.replace(/_/g, ' '));
  const list = names.length <= 1 ? (names[0] ?? 'a field') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verb = names.length > 1 ? 'were' : 'was';
  const tail = appliedCount > 0 ? ' The rest of your edit was saved.' : '';
  return `Not saved: the ${list} ${verb} changed by someone else while you were offline, so their version was kept.${tail}`;
}
