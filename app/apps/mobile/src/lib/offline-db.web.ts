// Web-platform stub for the device-local offline mutation queue.
// expo-sqlite has no web implementation and throws at import time on web,
// so this file (picked automatically by Metro's platform-extension
// resolution on web) provides no-op stand-ins with the same exported
// shape as offline-db.ts. The web build has no offline queue.

import type { NewQueuedMutation, DrainResult, ReplayErrorClass } from '@jobcore/core';
import type { QueueRow, QueueStatus } from './offline-db.types';
import { supabase } from './supabase';
import { getOpHandler } from './offline-ops';
import type { OpContext } from './offline-ops';

export type { QueueRow, QueueStatus };

export const OFFLINE_DB_NAME = 'jobcore-offline.db';

const NOT_ON_WEB = 'Offline database is not available on web';

export async function getOfflineDb(): Promise<never> {
  throw new Error(NOT_ON_WEB);
}

export async function countPending(): Promise<number> {
  return 0;
}

export async function enqueue(_mutation: NewQueuedMutation): Promise<void> {
  // No-op on web: there is no offline queue to persist to.
}

export async function listPending(_now?: string): Promise<QueueRow[]> {
  return [];
}

export async function listFailed(_limit: number = 50): Promise<QueueRow[]> {
  return [];
}

export async function countFailed(): Promise<number> {
  return 0;
}

export async function listAllFailed(): Promise<QueueRow[]> {
  return [];
}

export async function retryFailed(_id: string): Promise<void> {
  // No-op on web.
}

export async function retryAllFailed(): Promise<void> {
  // No-op on web.
}

export async function discardFailed(_id: string): Promise<void> {
  // No-op on web.
}

export async function markInflight(_id: string): Promise<void> {
  // No-op on web.
}

export async function markDone(_id: string): Promise<void> {
  // No-op on web.
}

export async function markRetry(
  _id: string,
  _info: { errorClass: ReplayErrorClass | string; message: string; nextAttemptAt: string }
): Promise<void> {
  // No-op on web.
}

export async function markFailed(
  _id: string,
  _info: { errorClass: ReplayErrorClass | string; message: string }
): Promise<void> {
  // No-op on web.
}

// Web has no queue, but writeThrough's web bypass calls send() directly, so it
// runs the op handler against the live session (same OpContext as native).
let cachedOrg: { userId: string; orgId: string } | null = null;

async function buildContext(): Promise<OpContext> {
  const { data, error } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (error || !userId) {
    const e = new Error('offline send: no authenticated session');
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
      const e = new Error('offline send: profile has no organization');
      (e as Error & { status?: number }).status = 401;
      throw e;
    }
    cachedOrg = { userId, orgId };
  }
  return { supabase, orgId: cachedOrg.orgId, userId, now: () => new Date() };
}

export async function send(row: Pick<QueueRow, 'op' | 'payload'>): Promise<void> {
  const handler = getOpHandler(row.op);
  const ctx = await buildContext();
  await handler(JSON.parse(row.payload), ctx);
}

export async function drainOfflineQueue(): Promise<DrainResult> {
  return { sent: 0, failed: 0, retried: 0, skipped: 0, aborted: 'offline' };
}

/** @deprecated kept for the current `_layout.tsx` caller; use drainOfflineQueue. */
export const replayOfflineQueue = (): Promise<DrainResult> => drainOfflineQueue();
