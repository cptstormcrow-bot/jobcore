// Pure queue-ordering rules for the offline queue: which records a change touches,
// which waiting changes may be sent this pass, and a one-at-a-time lock.
// No Expo or React Native imports, so the node test runner can load it.

import type { QueueRow } from './offline-db.types';

/** The records a queued change touches, so a stuck change holds back only that job's later changes (Jeff 2026-11-03). Empty = unknown, holds back everything. */
export function groupOf(row: Pick<QueueRow, 'op' | 'payload'> & { user_id?: string | null }): string[] {
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    return [];
  }
  if (p === null || typeof p !== 'object') return [];
  const draft = (p.draft ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);
  const keys: string[] = [];
  const add = (kind: string, v: unknown): void => {
    const id = str(v);
    if (id !== undefined) keys.push(`${kind}:${id}`);
  };
  add('job', p.jobId ?? p.job_id ?? draft.jobId ?? draft.job_id);
  if (row.op.startsWith('job.')) add('job', p.id);
  if (row.op.startsWith('lead.')) add('lead', p.leadId ?? p.id);
  if (row.op.startsWith('job_photo.')) add('photo', p.id);
  add('employee', p.profileId);
  add('payout_batch', p.batchId);
  if (row.op.startsWith('time_off_request.')) add('time_off', p.requestId ?? p.id);
  // A week's entries and its submit share one key, so a submit never lands before its
  // entries, and one stuck time entry no longer stops every other change from sending.
  if (row.op.startsWith('payroll_time.') || row.op.startsWith('payroll_timesheet.')) keys.push(`payroll:${row.user_id || 'me'}`);
  return keys;
}

type OrderRow = Pick<QueueRow, 'op' | 'payload' | 'status'> & { user_id?: string | null };

/**
 * The waiting rows this pass may send, in queue order. `rows` is every pending and
 * inflight row in queue order. A row being sent right now (inflight: a save on screen,
 * or a slow upload) holds back later changes to the same records, so a quick second
 * change can't overtake it. A change someone else made on this phone waits for that
 * person's own sign-in, and holds back later changes to its records too. Rows from
 * before v3 have no owner and send for anyone.
 */
export function filterRunnable<R extends OrderRow>(rows: readonly R[], currentUserId: string | null): R[] {
  const held = new Set<string>();
  let holdAll = false;
  let anyHeld = false;
  const out: R[] = [];
  for (const row of rows) {
    const keys = groupOf(row);
    const hold = (all: boolean): void => {
      for (const k of keys) held.add(k);
      if (all) holdAll = true;
      anyHeld = true;
    };
    if (row.status === 'inflight') {
      hold(keys.length === 0);
      continue;
    }
    if (row.status !== 'pending') continue;
    if (row.user_id && currentUserId && row.user_id !== currentUserId) {
      // Only its records wait: never let one person's leftovers block another's whole queue.
      for (const k of keys) held.add(k);
      continue;
    }
    if (holdAll || (keys.length === 0 && anyHeld) || keys.some((k) => held.has(k))) {
      hold(keys.length === 0);
      continue;
    }
    out.push(row);
  }
  return out;
}

/**
 * May a new change be sent straight away (inline) while other changes wait? Only when nothing
 * open touches its records. `open` is every pending and inflight row. A stuck or slow change
 * on another job must not make this save say "Saved on this device" while fully online
 * (Jeff 2026-11-06). A change with unknown records waits for everything, and a row being sent
 * with unknown records holds everything, same as filterRunnable.
 */
export function canSendInline(
  open: readonly (Pick<QueueRow, 'op' | 'payload' | 'status'> & { user_id?: string | null })[],
  next: Pick<QueueRow, 'op' | 'payload'> & { user_id?: string | null }
): boolean {
  if (open.length === 0) return true;
  const keys = groupOf(next);
  if (keys.length === 0) return false;
  for (const row of open) {
    const rk = groupOf(row);
    if (rk.length === 0) {
      if (row.status === 'inflight') return false;
      continue;
    }
    if (rk.some((k) => keys.includes(k))) return false;
  }
  return true;
}

/** Runs the given jobs one after another, in call order, even when one throws. */
export function makeLock(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}

const STAGE_OPS = new Set(['job.update_status', 'job.patch_lifecycle']);

/**
 * How a one-step stage save (Complete Job #0018) treats this job's unsent changes.
 * `rows` is every pending and inflight row. Older pending stage changes the save fully
 * replaces are dropped. Anything else on this job (a change being sent right now, an
 * unsent create, a note) means the save must queue behind it, or the older change
 * would land after the save and undo it, or the save would hit a job not on the server yet.
 */
export function planStageSave(
  rows: readonly Pick<QueueRow, 'id' | 'op' | 'payload' | 'status'>[],
  jobId: string,
  fields: readonly string[]
): { mustQueue: boolean; dropIds: string[] } {
  const dropIds: string[] = [];
  for (const row of rows) {
    if (row.status !== 'pending' && row.status !== 'inflight') continue;
    if (!groupOf(row).includes(`job:${jobId}`)) continue;
    if (row.status === 'pending' && STAGE_OPS.has(row.op)) {
      let patch: Record<string, unknown> = {};
      try {
        patch = ((JSON.parse(row.payload) as { patch?: Record<string, unknown> }).patch ?? {});
      } catch {
        return { mustQueue: true, dropIds: [] };
      }
      if (row.op === 'job.update_status' || Object.keys(patch).every((k) => fields.includes(k))) {
        dropIds.push(row.id);
        continue;
      }
    }
    return { mustQueue: true, dropIds: [] };
  }
  return { mustQueue: false, dropIds };
}
