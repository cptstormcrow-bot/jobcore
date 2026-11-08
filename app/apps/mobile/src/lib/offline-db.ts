// Device-local persistence adapter for the offline mutation queue (v2).
// packages/core stays zero-dependency and knows nothing about SQLite or
// Expo — it defines the schema/shape and the pure drain loop (drainQueue) and
// receives persistence as injected callbacks. This module is the one place in
// the app that owns the actual on-device database.

import * as SQLite from 'expo-sqlite';
import {
  OFFLINE_QUEUE_TABLE,
  OFFLINE_QUEUE_SCHEMA,
  OFFLINE_QUEUE_SCHEMA_VERSION,
  OFFLINE_QUEUE_MIGRATIONS,
  CREATE_READ_CACHE_TABLE,
  CREATE_SYNC_LOG_TABLE,
  SYNC_LOG_TABLE,
  drainQueue,
  classifyReplayError,
} from '@jobcore/core';
import type { NewQueuedMutation, DrainResult, ReplayErrorClass } from '@jobcore/core';
import { logSyncFailure } from './log';
import { supabase } from './supabase';
import type { QueueRow, QueueStatus, SyncLogKind, SyncLogRow } from './offline-db.types';
import { getOpHandler, UnknownOpError } from './offline-ops';
import type { OpContext } from './offline-ops';
import { emitDrainComplete, isOnlineNow } from './sync-events';
import { makeAuthRetrySend } from './auth-retry';
import { filterRunnable, groupOf } from './queue-order';

export type { QueueRow, QueueStatus, SyncLogKind, SyncLogRow };

export const OFFLINE_DB_NAME = 'jobcore-offline.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(OFFLINE_DB_NAME);
      const ver = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      let current = ver?.user_version ?? 0;
      if (current === 0) {
        const t = await db.getFirstAsync<{ name: string }>(
          `select name from sqlite_master where type = 'table' and name = '${OFFLINE_QUEUE_TABLE}'`
        );
        if (t) current = 1; // pre-versioning (v1) install
      }
      if (current === 0) {
        // Fresh install: current-version DDL, no migrations.
        for (const statement of OFFLINE_QUEUE_SCHEMA) {
          await db.execAsync(statement);
        }
        await db.execAsync(`PRAGMA user_version = ${OFFLINE_QUEUE_SCHEMA_VERSION}`);
      } else if (current < OFFLINE_QUEUE_SCHEMA_VERSION) {
        await db.withTransactionAsync(async () => {
          for (let v = current + 1; v <= OFFLINE_QUEUE_SCHEMA_VERSION; v++) {
            for (const statement of OFFLINE_QUEUE_MIGRATIONS[v] ?? []) {
              await db.execAsync(statement);
            }
          }
          await db.execAsync(`PRAGMA user_version = ${OFFLINE_QUEUE_SCHEMA_VERSION}`);
        });
        // Make sure the status/occurred_at index exists on upgraded installs too.
        for (const statement of OFFLINE_QUEUE_SCHEMA) {
          await db.execAsync(statement);
        }
      }
      // Read cache table + indexes on every open (idempotent) so upgraded v1
      // installs get it; the read-cache store assumes it exists.
      for (const statement of CREATE_READ_CACHE_TABLE) {
        await db.execAsync(statement);
      }
      // Sync history log, also on every open (idempotent).
      for (const statement of CREATE_SYNC_LOG_TABLE) {
        await db.execAsync(statement);
      }
      // Crash-mid-send rows would otherwise be stuck 'inflight' forever.
      await db.runAsync(
        `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', inflight_at = null where status = 'inflight'`
      );
      // Edits failed by the old edit-clash guard (v0.13.10 and earlier) re-send: a clash
      // is now saved and noted, never a failure. The new guard never writes this text.
      await db.runAsync(
        `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = 0, next_attempt_at = null, inflight_at = null, last_error = null, error_class = null where status = 'failed' and last_error like 'Not saved:%changed by someone else%'`
      );
      // Rows failed as an unknown op get another try each start: a later build may
      // handle (or alias) that op. One still unknown just fails again, once.
      await db.runAsync(
        `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = 0, next_attempt_at = null, inflight_at = null, last_error = null, error_class = null where status = 'failed' and last_error like 'Unknown offline op:%'`
      );
      return db;
    })();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function countPending(): Promise<number> {
  const db = await getOfflineDb();
  // 'failed' rows are deliberately EXCLUDED from this count — they surface
  // through the indicator's separate error channel, not the pending count.
  // 'inflight' stays counted so a send in progress still counts as pending.
  const row = await db.getFirstAsync<{ n: number }>(
    `select count(*) as n from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight')`
  );
  return row?.n ?? 0;
}

/** `inflight` inserts the row already claimed, for a send the caller makes itself, so a drain can't pick it up in between. `userId` is who made the change. */
export async function enqueue(
  mutation: NewQueuedMutation,
  opts: { inflight?: boolean; userId?: string | null } = {}
): Promise<void> {
  try {
    const db = await getOfflineDb();
    await db.runAsync(
      `insert into ${OFFLINE_QUEUE_TABLE} (id, op, payload, occurred_at, status, attempts, inflight_at, user_id) values (?, ?, ?, ?, ?, 0, ?, ?)`,
      mutation.id,
      mutation.op,
      mutation.payload,
      mutation.occurredAt,
      opts.inflight ? 'inflight' : 'pending',
      opts.inflight ? new Date().toISOString() : null,
      opts.userId ?? null
    );
  } catch (err) {
    logSyncFailure('offline-db.enqueue', err instanceof Error ? err.message : String(err), { mutation });
    throw err;
  }
}

const QUEUE_COLUMNS =
  'id, op, payload, occurred_at, status, attempts, last_error, error_class, next_attempt_at, inflight_at, user_id';

/** Strict FIFO. NOT filtered by next_attempt_at: the drain inspects the head and aborts 'backoff'. */
export async function listPending(_now?: string): Promise<QueueRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueueRow>(
    `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where status = 'pending' order by occurred_at asc, rowid asc`
  );
}

/** Every unsent row (pending and being sent), in queue order. */
export async function listOpen(): Promise<QueueRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueueRow>(
    `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight') order by occurred_at asc, rowid asc`
  );
}

export async function listFailed(limit: number = 50): Promise<QueueRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueueRow>(
    `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where status = 'failed' order by occurred_at asc, rowid asc limit ?`,
    limit
  );
}

export async function countFailed(): Promise<number> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `select count(*) as n from ${OFFLINE_QUEUE_TABLE} where status = 'failed'`
  );
  return row?.n ?? 0;
}

/** Every permanently failed row, oldest first (no limit) — feeds the Sync issues screen. */
export async function listAllFailed(): Promise<QueueRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueueRow>(
    `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where status = 'failed' order by occurred_at asc, rowid asc`
  );
}

/** Reset one failed row to pending with no backoff so the next drain sends it now. */
export async function retryFailed(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = 0, next_attempt_at = null, inflight_at = null where id = ? and status = 'failed'`,
    id
  );
}

/** Reset every failed row to pending (see retryFailed), and clear backoff on pending rows so a manual retry sends now. */
export async function retryAllFailed(): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = 0, next_attempt_at = null, inflight_at = null where status = 'failed'`
  );
  await db.runAsync(`update ${OFFLINE_QUEUE_TABLE} set next_attempt_at = null where status = 'pending'`);
  // A send that died mid-flight stays 'inflight' and blocks later changes to the same job;
  // anything inflight for over 2 minutes is released so Send now can pick it up.
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', inflight_at = null where status = 'inflight' and (inflight_at is null or inflight_at < ?)`,
    new Date(Date.now() - 120_000).toISOString()
  );
}

/** Changes saved but not yet sent (pending or mid-send), oldest first, with their last error. */
export async function listWaiting(limit: number = 50): Promise<QueueRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueueRow>(
    `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight') order by occurred_at asc, rowid asc limit ?`,
    limit
  );
}

/** A stuck row: failed, or pending and already retried twice or more (one quick retry is normal). Feeds the stuck popup (#0099). */
const STUCK_WHERE = `(status = 'failed' or (status = 'pending' and attempts >= 2))`;

export async function countStuck(): Promise<number> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ n: number }>(
    `select count(*) as n from ${OFFLINE_QUEUE_TABLE} where ${STUCK_WHERE}`
  );
  return row?.n ?? 0;
}

export async function listStuck(limit: number = 5): Promise<QueueRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueueRow>(
    `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where ${STUCK_WHERE} order by occurred_at asc, rowid asc limit ?`,
    limit
  );
}

/** Unstick everything: failed rows back to pending, and every pending row's retry count, backoff and error cleared, so the next drain sends them all now. */
export async function unstickAll(): Promise<void> {
  const db = await getOfflineDb();
  await retryAllFailed();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set attempts = 0, next_attempt_at = null, inflight_at = null, last_error = null, error_class = null where status = 'pending'`
  );
}

/**
 * Delete one failed row. The optimistic read-cache patch has no inverse, so the
 * caller refreshes the read cache (refetchAll) to drop the local-only change.
 */
export async function discardFailed(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(`delete from ${OFFLINE_QUEUE_TABLE} where id = ? and status = 'failed'`, id);
}

/** Retry one stuck change now (failed, or still pending after repeated tries): resets its count and backoff. */
export async function retryStuck(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = 0, next_attempt_at = null, inflight_at = null where id = ? and ${STUCK_WHERE}`,
    id
  );
}

/** Drop one stuck change (failed, or pending after repeated tries). Never a row that is being sent right now. */
export async function discardStuck(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(`delete from ${OFFLINE_QUEUE_TABLE} where id = ? and ${STUCK_WHERE}`, id);
}

/** Drops every failed row. Run on sign-out: the queue is device-wide, so the next login must not inherit them. */
export async function discardAllFailed(): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(`delete from ${OFFLINE_QUEUE_TABLE} where status = 'failed'`);
}

export async function markInflight(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'inflight', inflight_at = ? where id = ?`,
    new Date().toISOString(),
    id
  );
}

export async function markDone(id: string): Promise<void> {
  const db = await getOfflineDb();
  // A delivered mutation is removed rather than tombstoned — the durable
  // record of what happened lives in the server-side audit trail.
  await db.runAsync(`delete from ${OFFLINE_QUEUE_TABLE} where id = ?`, id);
}

export async function markRetry(
  id: string,
  info: { errorClass: ReplayErrorClass | string; message: string; nextAttemptAt: string }
): Promise<void> {
  const db = await getOfflineDb();
  // Uber 225: "no authenticated session" is the phone's missing login, not a failed send, so it
  // must not push the change toward "stuck" on #0100.
  const bump = /no authenticated session/i.test(info.message) ? 0 : 1;
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = attempts + ${bump}, last_error = ?, error_class = ?, next_attempt_at = ?, inflight_at = null where id = ?`,
    info.message,
    info.errorClass,
    info.nextAttemptAt,
    id
  );
}

export async function markFailed(
  id: string,
  info: { errorClass: ReplayErrorClass | string; message: string }
): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'failed', attempts = attempts + 1, last_error = ?, error_class = ?, inflight_at = null where id = ?`,
    info.message,
    info.errorClass,
    id
  );
}

// ---------------------------------------------------------------------------
// Sync history log (#0100): one row per send, retry, failure and drain pass.
// Logging never breaks a drain, so every write swallows its own errors.

const SYNC_LOG_KEEP = 500;

export async function logSync(entry: {
  kind: SyncLogKind;
  op?: string | null;
  rowId?: string | null;
  attempts?: number | null;
  errorClass?: string | null;
  message?: string | null;
}): Promise<void> {
  try {
    const db = await getOfflineDb();
    await db.runAsync(
      `insert into ${SYNC_LOG_TABLE} (at, kind, op, row_id, attempts, error_class, message) values (?, ?, ?, ?, ?, ?, ?)`,
      new Date().toISOString(),
      entry.kind,
      entry.op ?? null,
      entry.rowId ?? null,
      entry.attempts ?? null,
      entry.errorClass ?? null,
      entry.message ?? null
    );
    await db.runAsync(
      `delete from ${SYNC_LOG_TABLE} where id <= (select max(id) - ${SYNC_LOG_KEEP} from ${SYNC_LOG_TABLE})`
    );
  } catch {
    // the log is a diagnostic; losing a line is fine
  }
}

/** Newest first. */
export async function listSyncLog(limit: number = 200): Promise<SyncLogRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<SyncLogRow>(`select * from ${SYNC_LOG_TABLE} order by id desc limit ?`, limit);
}

export async function clearSyncLog(): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(`delete from ${SYNC_LOG_TABLE}`);
}

// ---------------------------------------------------------------------------
// Transport. Every op is a handler in the offline-ops registry; the session
// (org + user) is resolved from the live Supabase auth session so a background
// drain does not depend on a screen having injected a module session.
// ---------------------------------------------------------------------------

let cachedOrg: { userId: string; orgId: string } | null = null;

// The session layer registers a function that restores the live Supabase session from the
// remembered account (PIN/offline sign-in leaves none). Kept as a hook so this file never
// imports session.tsx (which imports this file).
let sessionRecoverer: (() => Promise<boolean>) | null = null;
export function setSessionRecoverer(fn: (() => Promise<boolean>) | null): void {
  sessionRecoverer = fn;
}

/** The current user id, restoring the live session first if it is missing (never throws). */
async function ensureSessionUserId(): Promise<string | null> {
  try {
    const first = await supabase.auth.getSession();
    if (first.data.session?.user?.id) return first.data.session.user.id;
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session?.user?.id) return refreshed.data.session.user.id;
    if (sessionRecoverer && (await sessionRecoverer())) {
      const again = await supabase.auth.getSession();
      return again.data.session?.user?.id ?? null;
    }
  } catch {
    // fall through: still no session
  }
  return null;
}

async function buildContext(): Promise<OpContext> {
  const userId = await ensureSessionUserId();
  if (!userId) {
    const e = new Error('offline drain: no authenticated session');
    (e as Error & { status?: number }).status = 401;
    throw e;
  }
  if (!cachedOrg || cachedOrg.userId !== userId) {
    const { data: prof, error: perr } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();
    if (perr) throw perr;
    const orgId = (prof as { organization_id?: string } | null)?.organization_id;
    if (!orgId) {
      const e = new Error('offline drain: profile has no organization');
      (e as Error & { status?: number }).status = 401;
      throw e;
    }
    cachedOrg = { userId, orgId };
  }
  return { supabase, orgId: cachedOrg.orgId, userId, now: () => new Date() };
}

export async function send(row: Pick<QueueRow, 'op' | 'payload'>): Promise<void> {
  const handler = getOpHandler(row.op); // throws UnknownOpError for stale ops
  const ctx = await buildContext();
  ctx.note = (message) => void logSync({ kind: 'note', op: row.op, message });
  await handler(JSON.parse(row.payload), ctx);
}

function classify(e: unknown): ReplayErrorClass {
  // A stale / unregistered op must be failed, never retried, or it pins the FIFO head.
  if (e instanceof UnknownOpError) return 'permanent';
  return classifyReplayError(e);
}

export { groupOf };

let drainPromise: Promise<DrainResult> | null = null;

export function drainOfflineQueue(): Promise<DrainResult> {
  if (drainPromise) return drainPromise;
  if (!isOnlineNow()) {
    return Promise.resolve({ sent: 0, failed: 0, retried: 0, skipped: 0, aborted: 'offline' });
  }
  drainPromise = (async () => {
    try {
      // One read of pending + inflight: an inflight row (a save being sent from a screen)
      // holds back later changes to its records, and another person's changes wait for them.
      const db = await getOfflineDb();
      const open = await db.getAllAsync<QueueRow>(
        `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight') order by occurred_at asc, rowid asc`
      );
      const pending = filterRunnable(open, open.length > 0 ? await ensureSessionUserId() : null);
      // Core's DrainRow is camelCase (occurredAt) + next_attempt_at; map the SQL rows.
      const rows = pending.map((r) => ({
        id: r.id,
        op: r.op,
        payload: r.payload,
        occurredAt: r.occurred_at,
        status: r.status as 'pending' | 'inflight' | 'failed',
        attempts: r.attempts,
        next_attempt_at: r.next_attempt_at,
      }));
      // Auth/401/JWT-expired: refresh the session once per pass and retry that row
      // once before it counts as an attempt (replay.ts then classifies any repeat as 'auth').
      const sendWithAuthRetry = makeAuthRetrySend<Pick<QueueRow, 'op' | 'payload'>>({
        send,
        isAuthError: (e) => classify(e) === 'auth',
        refresh: async () => {
          const { data, error } = await supabase.auth.refreshSession();
          return !error && !!data.session;
        },
      });
      // Wrap the mark callbacks so every outcome also lands in the sync history log.
      const byId = new Map(pending.map((r) => [r.id, r]));
      const logRow = (kind: SyncLogKind, id: string, info?: { errorClass: string; message: string }) => {
        const r = byId.get(id);
        return logSync({
          kind,
          op: r?.op ?? null,
          rowId: id,
          attempts: (r?.attempts ?? 0) + 1,
          errorClass: info?.errorClass ?? null,
          message: info?.message ?? null,
        });
      };
      const result = await drainQueue(rows, {
        send: sendWithAuthRetry,
        markInflight,
        markDone: async (id) => {
          await markDone(id);
          await logRow('sent', id);
        },
        markRetry: async (id, info) => {
          await markRetry(id, info);
          await logRow('retry', id, info);
        },
        markFailed: async (id, info) => {
          await markFailed(id, info);
          await logRow('failed', id, info);
        },
        now: () => new Date(),
        classify,
        groupOf,
        concurrency: 4,
      });
      if (rows.length > 0 || result.aborted) {
        await logSync({
          kind: 'pass',
          message: `sent ${result.sent}, retried ${result.retried}, failed ${result.failed}, held ${result.skipped}${
            result.aborted ? `, stopped (${result.aborted})` : ''
          }`,
        });
      }
      if (result.aborted !== 'offline') {
        emitDrainComplete({
          sent: result.sent,
          failed: result.failed,
          retried: result.retried,
          pendingAfter: await countPending(),
          at: new Date().toISOString(),
          ops: pending.map((r) => r.op),
        });
      }
      return result;
    } finally {
      drainPromise = null;
    }
  })();
  return drainPromise;
}

/** @deprecated kept for the current `_layout.tsx` caller; use drainOfflineQueue. */
export const replayOfflineQueue = (): Promise<DrainResult> => drainOfflineQueue();
