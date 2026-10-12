// Web: in-memory read cache store (no SQLite on web).
import { selectEvictions } from '@jobcore/core';
import type { CachedRow, PutCachedInput, CacheMeta } from './read-cache-store';

export type { CachedRow, PutCachedInput, CacheMeta };

const map = new Map<string, CachedRow>();
const staleUsers = new Set<string>();
export function markAllStaleFor(userId: string): void { staleUsers.add(userId); }
export function isStaleFor(userId: string): boolean { return staleUsers.has(userId); }
export function clearStaleFor(userId: string): void { staleUsers.delete(userId); }

export async function getCached(key: string): Promise<CachedRow | null> { return map.get(key) ?? null; }
export async function putCached(i: PutCachedInput): Promise<void> {
  map.set(i.key, { key: i.key, orgId: i.orgId, userId: i.userId, query: i.query, params: JSON.stringify(i.params ?? null), payload: i.payload, fetchedAt: i.fetchedAt, bytes: i.bytes });
}
export async function listMeta(userId?: string): Promise<CacheMeta[]> {
  return Array.from(map.values()).filter((r) => !userId || r.userId === userId)
    .map((r) => ({ key: r.key, query: r.query, user_id: r.userId, fetched_at: r.fetchedAt, bytes: r.bytes }));
}
export async function deleteKeys(keys: string[]): Promise<void> { for (const k of keys) map.delete(k); }
export async function wipeOtherUsers(userId: string): Promise<void> {
  for (const [k, r] of Array.from(map)) if (r.userId !== userId) map.delete(k);
}
export async function wipeAll(): Promise<void> { map.clear(); staleUsers.clear(); }
export async function evictAtStart(now: number): Promise<void> {
  await deleteKeys(selectEvictions(await listMeta(), now));
}
