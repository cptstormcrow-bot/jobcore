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
  drainQueue,
  classifyReplayError,
} from '@jobcore/core';
import type { NewQueuedMutation, DrainResult, ReplayErrorClass } from '@jobcore/core';
import { logSyncFailure } from './log';
import { supabase } from './supabase';
import type { QueueRow, QueueStatus } from './offline-db.types';
import { getOpHandler, UnknownOpError } from './offline-ops';
import type { OpContext } from './offline-ops';
import { emitDrainComplete, isOnlineNow } from './sync-events';
import { makeAuthRetrySend } from './auth-retry';

export type { QueueRow, QueueStatus };

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
      // Crash-mid-send rows would otherwise be stuck 'inflight' forever.
      await db.runAsync(
        `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', inflight_at = null where status = 'inflight'`
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

export async function enqueue(mutation: NewQueuedMutation): Promise<void> {
  try {
    const db = await getOfflineDb();
    await db.runAsync(
      `insert into ${OFFLINE_QUEUE_TABLE} (id, op, payload, occurred_at, status, attempts) values (?, ?, ?, ?, 'pending', 0)`,
      mutation.id,
      mutation.op,
      mutation.payload,
      mutation.occurredAt
    );
  } catch (err) {
    logSyncFailure('offline-db.enqueue', err instanceof Error ? err.message : String(err), { mutation });
    throw err;
  }
}

const QUEUE_COLUMNS =
  'id, op, payload, occurred_at, status, attempts, last_error, error_class, next_attempt_at, inflight_at';

/** Strict FIFO. NOT filtered by next_attempt_at: the drain inspects the head and aborts 'backoff'. */
export async function listPending(_now?: string): Promise<QueueRow[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueueRow>(
    `select ${QUEUE_COLUMNS} from ${OFFLINE_QUEUE_TABLE} where status = 'pending' order by occurred_at asc, rowid asc`
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

/** Reset every failed row to pending (see retryFailed). */
export async function retryAllFailed(): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = 0, next_attempt_at = null, inflight_at = null where status = 'failed'`
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
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'pending', attempts = attempts + 1, last_error = ?, error_class = ?, next_attempt_at = ?, inflight_at = null where id = ?`,
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
// Transport. Every op is a handler in the offline-ops registry; the session
// (org + user) is resolved from the live Supabase auth session so a background
// drain does not depend on a screen having injected a module session.
// ---------------------------------------------------------------------------

let cachedOrg: { userId: string; orgId: string } | null = null;

async function buildContext(): Promise<OpContext> {
  const { data, error } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (error || !userId) {
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
  await handler(JSON.parse(row.payload), ctx);
}

function classify(e: unknown): ReplayErrorClass {
  // A stale / unregistered op must be failed, never retried, or it pins the FIFO head.
  if (e instanceof UnknownOpError) return 'permanent';
  return classifyReplayError(e);
}

let drainPromise: Promise<DrainResult> | null = null;

export function drainOfflineQueue(): Promise<DrainResult> {
  if (drainPromise) return drainPromise;
  if (!isOnlineNow()) {
    return Promise.resolve({ sent: 0, failed: 0, retried: 0, skipped: 0, aborted: 'offline' });
  }
  drainPromise = (async () => {
    try {
      const pending = await listPending(new Date().toISOString());
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
      const result = await drainQueue(rows, {
        send: sendWithAuthRetry,
        markInflight,
        markDone,
        markRetry,
        markFailed,
        now: () => new Date(),
        classify,
      });
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
