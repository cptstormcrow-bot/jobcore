// SQLite-backed read cache store. The read_cache table is created by getOfflineDb() (S4), not here.
// Staleness is NOT persisted: it is an in-memory Set per user (plus an epoch in read-cache.tsx).
import { selectEvictions } from '@jobcore/core';
import { getOfflineDb } from './offline-db';

export interface CachedRow {
  key: string;
  orgId: string;
  userId: string;
  query: string;
  params: string;
  payload: string;
  fetchedAt: number;
  bytes: number;
}
export interface PutCachedInput {
  key: string;
  orgId: string;
  userId: string;
  query: string;
  params: unknown;
  payload: string;
  fetchedAt: number;
  bytes: number;
}
export interface CacheMeta { key: string; query: string; user_id: string; fetched_at: number; bytes: number }

const staleUsers = new Set<string>();
export function markAllStaleFor(userId: string): void { staleUsers.add(userId); }
export function isStaleFor(userId: string): boolean { return staleUsers.has(userId); }
export function clearStaleFor(userId: string): void { staleUsers.delete(userId); }

export async function getCached(key: string): Promise<CachedRow | null> {
  const db = await getOfflineDb();
  const r = await db.getFirstAsync<{ key: string; org_id: string; user_id: string; query: string; params: string; payload: string; fetched_at: number; bytes: number }>(
    'select key, org_id, user_id, query, params, payload, fetched_at, bytes from read_cache where key = ?', key);
  return r ? { key: r.key, orgId: r.org_id, userId: r.user_id, query: r.query, params: r.params, payload: r.payload, fetchedAt: r.fetched_at, bytes: r.bytes } : null;
}

export async function putCached(i: PutCachedInput): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    'insert or replace into read_cache (key, org_id, user_id, query, params, payload, fetched_at, bytes) values (?,?,?,?,?,?,?,?)',
    i.key, i.orgId, i.userId, i.query, JSON.stringify(i.params ?? null), i.payload, i.fetchedAt, i.bytes);
}

export async function listMeta(userId?: string): Promise<CacheMeta[]> {
  const db = await getOfflineDb();
  if (userId) return db.getAllAsync<CacheMeta>('select key, query, user_id, fetched_at, bytes from read_cache where user_id = ?', userId);
  return db.getAllAsync<CacheMeta>('select key, query, user_id, fetched_at, bytes from read_cache');
}

export async function deleteKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await getOfflineDb();
  for (const k of keys) await db.runAsync('delete from read_cache where key = ?', k);
}

export async function wipeOtherUsers(userId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync('delete from read_cache where user_id <> ?', userId);
}

export async function wipeAll(): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync('delete from read_cache');
  staleUsers.clear();
}

export async function evictAtStart(now: number): Promise<void> {
  const meta = await listMeta();
  await deleteKeys(selectEvictions(meta, now));
}
