// Device-local persistence adapter for the offline mutation queue.
// packages/core stays zero-dependency and knows nothing about SQLite or
// Expo — it defines the schema/shape and receives persistence as injected
// callbacks (see replayQueue). This module is the one place in the app
// that owns the actual on-device database.

import * as SQLite from 'expo-sqlite';
import {
  OFFLINE_QUEUE_TABLE,
  OFFLINE_QUEUE_SCHEMA,
  replayQueue,
} from '@jobcore/core';
import type {
  QueuedMutation,
  NewQueuedMutation,
  ReplayResult,
} from '@jobcore/core';

export const OFFLINE_DB_NAME = 'jobcore-offline.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(OFFLINE_DB_NAME);
      for (const statement of OFFLINE_QUEUE_SCHEMA) {
        await db.execAsync(statement);
      }
      return db;
    })();
  }
  return dbPromise;
}

export async function countPending(): Promise<number> {
  const db = await getOfflineDb();
  // 'failed' rows are deliberately EXCLUDED from this count — they surface
  // through the indicator's separate error channel, not the pending count.
  const row = await db.getFirstAsync<{ n: number }>(
    `select count(*) as n from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight')`
  );
  return row?.n ?? 0;
}

export async function enqueue(mutation: NewQueuedMutation): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `insert into ${OFFLINE_QUEUE_TABLE} (id, op, payload, occurred_at) values (?, ?, ?, ?)`,
    mutation.id,
    mutation.op,
    mutation.payload,
    mutation.occurredAt
  );
}

interface OfflineQueueRow {
  id: string;
  op: string;
  payload: string;
  occurred_at: string;
  status: QueuedMutation['status'];
  attempts: number;
}

export async function listPending(): Promise<QueuedMutation[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<OfflineQueueRow>(
    `select id, op, payload, occurred_at, status, attempts from ${OFFLINE_QUEUE_TABLE} where status in ('pending', 'inflight') order by occurred_at asc`
  );
  return rows.map((row) => ({
    id: row.id,
    op: row.op,
    payload: row.payload,
    occurredAt: row.occurred_at,
    status: row.status,
    attempts: row.attempts,
  }));
}

export async function markDone(id: string): Promise<void> {
  const db = await getOfflineDb();
  // A delivered mutation is removed rather than tombstoned — the durable
  // record of what happened lives in the server-side audit trail.
  await db.runAsync(`delete from ${OFFLINE_QUEUE_TABLE} where id = ?`, id);
}

export async function markFailed(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `update ${OFFLINE_QUEUE_TABLE} set status = 'failed', attempts = attempts + 1 where id = ?`,
    id
  );
}

export async function replayPending(
  send: (mutation: QueuedMutation) => Promise<void>
): Promise<ReplayResult> {
  const pending = await listPending();
  // No transport is baked in — send is injected by the caller, so this
  // module never imports Supabase.
  return replayQueue(pending, {
    send,
    markDone: (id) => markDone(id),
    markFailed: (id) => markFailed(id),
  });
}
