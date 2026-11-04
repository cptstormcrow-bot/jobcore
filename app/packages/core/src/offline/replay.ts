/**
 * Offline queue replay + conflict resolution (02-P2-scheduling-core.md
 * P2d.2c).
 *
 * Zero imports outside `packages/core/src` — this file never imports
 * expo-sqlite, Supabase, or any other transport/database client. The caller
 * supplies both the transport (`ReplayOptions.send`) and the persistence
 * callbacks; `core` only decides ordering, error handling, and which side
 * wins a field-level conflict.
 */

import type { Job } from '../index.js';
import type { QueuedMutation } from './queue.js';

/**
 * Fields on which the SERVER is authoritative during conflict resolution.
 * The dispatcher may have rescheduled a job while the device was offline,
 * so the server's scheduling state always wins over whatever the device
 * last saw (02-P2-scheduling-core.md P2d.2c ledger row: "server wins on
 * scheduling fields, device wins on `occurred_at`").
 */
export const SERVER_WINS_FIELDS = ['requestedWindow', 'scheduledStart', 'scheduledEnd', 'assignedTechId'] as const;

/**
 * Fields on which the DEVICE is authoritative during conflict resolution.
 * These are stamped from the device clock at the moment of the action (see
 * `occurredAt` in `./queue` and `applyOptimistic` in `./apply`) and are the
 * payroll-relevant inputs, so the device wins even when the server row is
 * newer.
 */
export const DEVICE_WINS_FIELDS = ['enRouteAt', 'inProgressAt', 'completedAt'] as const;

/**
 * Merges a local (device) job with the server's copy of the same job.
 *
 * `server` is the base — every field not named in `DEVICE_WINS_FIELDS`
 * (including every field in `SERVER_WINS_FIELDS`) takes the server value.
 * Each `DEVICE_WINS_FIELDS` key is then overwritten with the LOCAL value,
 * but only when the local value is non-null: a null local timestamp means
 * the device never stamped that action, so the server's value (if any) is
 * kept instead of clobbering it with `null`.
 *
 * `status` is a special case: it takes the LOCAL value only when at least
 * one `DEVICE_WINS_FIELDS` key has a non-null local value and a null server
 * value — i.e. the device recorded an action (en route / in progress /
 * completed) that the server hasn't seen yet, so the device's status is
 * ahead of the server's. Otherwise `status` keeps the server's value.
 */
export function resolveConflict(local: Job, server: Job): Job {
  const merged: Job = { ...server };

  let localIsAhead = false;
  for (const field of DEVICE_WINS_FIELDS) {
    const localValue = local[field];
    if (localValue !== null) {
      merged[field] = localValue;
      if (server[field] === null) {
        localIsAhead = true;
      }
    }
  }

  merged.status = localIsAhead ? local.status : server.status;

  return merged;
}

/**
 * Options for `replayQueue`.
 */
export interface ReplayOptions {
  /** Injected transport; `core` never knows what Supabase is. Treat SQLSTATE 42501 (permission denied) as permanent: never re-queue it. */
  send: (mutation: QueuedMutation) => Promise<void>;
  /** Called after a mutation is successfully sent. */
  markDone: (id: string) => void | Promise<void>;
  /** Called when a mutation fails to send; optional-shaped like `ctx.writeAudit?`. */
  markFailed?: (id: string, error: unknown) => void | Promise<void>;
}

/**
 * Result of `replayQueue`: counts of mutations sent and failed.
 */
export interface ReplayResult {
  sent: number;
  failed: number;
}

/**
 * Replays queued mutations SEQUENTIALLY in the order given — the caller is
 * expected to supply rows ordered by the `(status, occurred_at)` index,
 * i.e. device-clock order.
 *
 * Exactly-once replay is guaranteed by the client-generated idempotency key
 * that is each row's primary key (`QueuedMutation.id`, per AC-4 in
 * 02-P2-scheduling-core.md: "A mutation made offline replays exactly once
 * on reconnect — no duplicates") — NOT by anything in this loop. This loop
 * only decides ordering and error isolation.
 *
 * Any row whose `status` is not `'pending'` is skipped: it is neither sent
 * nor counted. For each pending row, `options.send` is awaited and, on
 * success, `options.markDone` is awaited and `sent` is incremented. If
 * `send` throws, the error is caught, `options.markFailed?.` is awaited
 * with the row id and error, `failed` is incremented, and the loop
 * CONTINUES to the next row — one bad mutation must never stall the queue.
 *
 * @deprecated Use `drainQueue`, which classifies errors and backs off.
 */
export async function replayQueue(
  pending: readonly QueuedMutation[],
  options: ReplayOptions
): Promise<ReplayResult> {
  let sent = 0;
  let failed = 0;

  for (const mutation of pending) {
    if (mutation.status !== 'pending') {
      continue;
    }

    try {
      await options.send(mutation);
      await options.markDone(mutation.id);
      sent += 1;
    } catch (err) {
      await options.markFailed?.(mutation.id, err);
      failed += 1;
    }
  }

  return { sent, failed };
}

export type ReplayErrorClass = 'network' | 'auth' | 'permission' | 'permanent' | 'duplicate' | 'unknown';

/** Pure, duck-typed classifier for any thrown value. */
export function classifyReplayError(e: unknown): ReplayErrorClass {
  const o = (e !== null && typeof e === 'object' ? e : {}) as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name : '';
  const message = typeof o.message === 'string' ? o.message : typeof e === 'string' ? e : '';
  const code = o.code === undefined || o.code === null ? '' : String(o.code);
  const rawStatus = o.status;
  const status =
    typeof rawStatus === 'number' ? rawStatus : typeof rawStatus === 'string' && rawStatus.trim() !== '' ? Number(rawStatus) : NaN;

  if (
    (name === 'TypeError' && /fetch|network|failed to fetch|load failed/i.test(message)) ||
    name === 'AuthRetryableFetchError' ||
    // postgrest hands back a dropped request as a plain object ({ message: 'TypeError: Network
    // request failed', code: '' }), so the name and status are lost by the time it is thrown.
    (code === '' && /^(TypeError|AbortError|FetchError): |network request (failed|timed out)|failed to fetch|load failed/i.test(message)) ||
    status === 0 ||
    (status >= 500 && status <= 599) ||
    status === 429
  ) {
    return 'network';
  }
  if (status === 401 || code === 'PGRST301' || /jwt expired|invalid jwt|not authenticated/i.test(message)) {
    return 'auth';
  }
  if (code === '42501' || status === 403) return 'permission';
  // Replay-dedup collisions mean the write already saved: primary keys, the
  // idempotency_key partial unique indexes (0009: audit_log, job_photos) and the
  // job_contact_log client_id index (0079). Other unique violations stay permanent.
  if (code === '23505') {
    return /_pkey|idempotency|job_contact_log_client_id_key/i.test(message) ? 'duplicate' : 'permanent';
  }
  if (
    status === 400 ||
    status === 404 ||
    status === 422 ||
    code.startsWith('22') ||
    code.startsWith('23') ||
    code.startsWith('42') ||
    /^PGRST1\d\d$/.test(code)
  ) {
    return 'permanent';
  }
  return 'unknown';
}

export function computeBackoffMs(
  attempts: number,
  opts?: { baseMs?: number; factor?: number; maxMs?: number }
): number {
  const baseMs = opts?.baseMs ?? 2000;
  const factor = opts?.factor ?? 2;
  const maxMs = opts?.maxMs ?? 300000;
  if (!(attempts > 1)) return baseMs;
  return Math.min(maxMs, baseMs * Math.pow(factor, attempts - 1));
}

export const UNKNOWN_MAX_ATTEMPTS = 8;
/** Network/auth retries before the row is marked failed, so one stuck head row cannot block the queue forever (Jeff 2026-11-02, 141 saves stuck). */
export const RETRY_MAX_ATTEMPTS = 10;

/** A queue row as handed to `drainQueue`; `next_attempt_at` is the v2 column. */
export type DrainRow = QueuedMutation & { next_attempt_at?: string | null };

export interface DrainOptions<M extends DrainRow = DrainRow> {
  send(m: M): Promise<void>;
  markInflight(id: string): Promise<void>;
  markDone(id: string): Promise<void>;
  markRetry(id: string, info: { errorClass: ReplayErrorClass; message: string; nextAttemptAt: string }): Promise<void>;
  markFailed(id: string, info: { errorClass: ReplayErrorClass; message: string }): Promise<void>;
  now(): Date;
  classify?(e: unknown): ReplayErrorClass;
  backoff?(attempts: number): number;
  /** Keys a row touches (e.g. its job id). When given, a row that must wait holds back only later rows sharing a key and the rest still send (Jeff 2026-11-03). No keys = holds back everything after it, as before. */
  groupOf?(m: M): readonly string[];
  /** Rows sent at the same time (default 1). Above 1, rows of different groups overlap while rows sharing a key still go one after another in queue order; a row with no keys waits for everything before it and runs alone. Needs `groupOf`. */
  concurrency?: number;
}

export interface DrainResult {
  sent: number;
  failed: number;
  retried: number;
  skipped: number;
  aborted?: 'network' | 'auth' | 'backoff' | 'unknown' | 'offline';
}

/** FIFO drain over `pending` as given (caller sorts). Network/auth stop the pass; a row that must wait for any other reason sets its `groupOf` keys aside and the pass moves on. */
export async function drainQueue<M extends DrainRow = DrainRow>(
  pending: readonly M[],
  o: DrainOptions<M>
): Promise<DrainResult> {
  const res: DrainResult = { sent: 0, failed: 0, retried: 0, skipped: 0 };
  const held = new Set<string>();
  const keysOf = (row: M): readonly string[] => o.groupOf?.(row) ?? [];
  // Holds the row's keys and returns true when the pass may go on past it.
  const hold = (row: M): boolean => {
    const keys = keysOf(row);
    for (const k of keys) held.add(k);
    return keys.length > 0;
  };

  // One row. 'wait' = not sent now (same job as a waiting row, or backing off);
  // 'retry' = sent and will be tried again; 'stop' = network/auth, stop the pass.
  const step = async (row: M): Promise<'sent' | 'failed' | 'wait' | 'retry' | 'stop'> => {
    if (held.size > 0 && keysOf(row).some((k) => held.has(k))) {
      // Same job as a row that is waiting: keep it behind that row so changes land in order.
      return 'wait';
    }
    if (row.next_attempt_at && row.next_attempt_at > o.now().toISOString()) {
      res.aborted ??= 'backoff';
      return 'wait';
    }
    await o.markInflight(row.id);
    try {
      await o.send(row);
    } catch (e) {
      const cls = (o.classify ?? classifyReplayError)(e);
      const msg = String((e as { message?: unknown } | null | undefined)?.message ?? e);
      if (cls === 'permanent' || cls === 'permission') {
        await o.markFailed(row.id, { errorClass: cls, message: msg });
        res.failed++;
        return 'failed';
      }
      if (cls === 'duplicate') {
        await o.markDone(row.id);
        res.sent++;
        return 'sent';
      }
      const cap = cls === 'unknown' ? UNKNOWN_MAX_ATTEMPTS : RETRY_MAX_ATTEMPTS;
      if ((row.attempts ?? 0) + 1 >= cap) {
        await o.markFailed(row.id, { errorClass: cls, message: msg });
        res.failed++;
        return 'failed';
      }
      const nextAttemptAt = new Date(
        o.now().getTime() + (o.backoff ?? computeBackoffMs)((row.attempts ?? 0) + 1)
      ).toISOString();
      await o.markRetry(row.id, { errorClass: cls, message: msg, nextAttemptAt });
      res.retried++;
      // Network/auth would fail every row, so stop. Anything else is this row's own trouble.
      if (cls === 'network' || cls === 'auth') {
        res.aborted = cls;
        return 'stop';
      }
      if (res.aborted === undefined || res.aborted === 'backoff') res.aborted = 'unknown';
      return 'retry';
    }
    await o.markDone(row.id);
    res.sent++;
    return 'sent';
  };

  const concurrency = Math.max(1, Math.floor(o.concurrency ?? 1));
  if (concurrency === 1 || !o.groupOf) {
    for (let i = 0; i < pending.length; i++) {
      const row = pending[i]!;
      const remaining = pending.length - i;
      const r = await step(row);
      if (r === 'stop') {
        res.skipped += remaining - 1;
        return res;
      }
      if (r === 'wait' || r === 'retry') {
        if (!hold(row)) {
          res.skipped += r === 'wait' ? remaining : remaining - 1;
          return res;
        }
        if (r === 'wait') res.skipped++;
      }
    }
    return res;
  }

  // Batches: up to `concurrency` rows in flight. Each key keeps a tail promise so a
  // job's rows still go one after another; other jobs fill the free slots.
  let stopped = false;
  let active = 0;
  const slotWaiters: (() => void)[] = [];
  const acquire = async (): Promise<void> => {
    if (active < concurrency) {
      active++;
      return;
    }
    await new Promise<void>((resolve) => slotWaiters.push(resolve));
  };
  const release = (): void => {
    const next = slotWaiters.shift();
    if (next) next();
    else active--;
  };
  const tails = new Map<string, Promise<void>>();
  const inflight = new Set<Promise<void>>();
  let firstError: unknown;

  for (let i = 0; i < pending.length; i++) {
    const row = pending[i]!;
    const remaining = pending.length - i;
    if (stopped) {
      res.skipped += remaining;
      break;
    }
    const keys = keysOf(row);
    if (keys.length === 0) {
      // No keys: it could touch anything, so it runs alone after everything before it.
      await Promise.all([...inflight]);
      if (stopped) {
        res.skipped += remaining;
        break;
      }
      const r = await step(row);
      if (r === 'stop' || r === 'retry') {
        stopped = true;
        res.skipped += remaining - 1;
        break;
      }
      if (r === 'wait') {
        stopped = true;
        res.skipped += remaining;
        break;
      }
      continue;
    }
    const before = keys.map((k) => tails.get(k)).filter((t): t is Promise<void> => t !== undefined);
    const task = (async () => {
      await Promise.all(before);
      await acquire();
      try {
        if (stopped) {
          res.skipped++;
          return;
        }
        const r = await step(row);
        if (r === 'stop') stopped = true;
        else if (r === 'wait' || r === 'retry') {
          hold(row);
          if (r === 'wait') res.skipped++;
        }
      } finally {
        release();
      }
    })().catch((e: unknown) => {
      // A mark* write failed: stop starting rows and rethrow once the rest settle.
      firstError ??= e;
      stopped = true;
    });
    for (const k of keys) tails.set(k, task);
    inflight.add(task);
    void task.then(() => inflight.delete(task));
  }
  await Promise.all([...inflight]);
  if (firstError !== undefined) throw firstError;
  return res;
}
