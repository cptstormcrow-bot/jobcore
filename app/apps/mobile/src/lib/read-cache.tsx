// Read-cache layer: cache-first reads, revision-bumping invalidation, op patches.
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { buildReadCacheKey, getOpPatches, registerOpPatches, readCacheRevision, READ_CACHE_FLOOR_MS } from '@jobcore/core';
import { OP_PATCH_SPECS } from './read-cache-patches';
import { summarizeStale, type StaleEntry, type StaleSummary } from './stale-hint';
registerOpPatches(OP_PATCH_SPECS as never);
import { useSession } from './session';
import { isOnlineNow, subscribeDrainComplete } from './sync-events';
import {
  clearStaleFor, deleteKeys, evictAtStart, getCached, isStaleFor, listMeta, markAllStaleFor, putCached, wipeAll, wipeOtherUsers,
} from './read-cache-store';

export { buildReadCacheKey };

const BACKGROUND_STALE_MS = 30_000;
const lastFetchAt = new Map<string, number>();
const inflight = new Map<string, Promise<unknown>>();
const failedKeys = new Set<string>();
let staleEpoch = 0; // cached rows fetched at or before this are stale (bypass the 2 s floor)
let identity: { orgId: string; userId: string } | null = null;

export function getReadCacheIdentity(): { orgId: string; userId: string } | null { return identity; }

export function useReadCacheRevision(): number {
  return useSyncExternalStore(readCacheRevision.subscribe, readCacheRevision.get, readCacheRevision.get);
}

export interface CachedReadResult<T> { data: T; servingStale: boolean; fromCache: boolean; /** epoch ms the served copy was fetched; null when read live */ cachedAt: number | null }

// Stale-serving registry: which cached keys were last served without a confirmed refresh.
const staleByKey = new Map<string, StaleEntry>();
let staleVersion = 0;
const staleListeners = new Set<() => void>();
function setStale(key: string, entry: StaleEntry | null): void {
  const prev = staleByKey.get(key);
  if (entry === null ? !prev : prev && prev.servingStale === entry.servingStale && prev.cachedAt === entry.cachedAt) return;
  if (entry === null) staleByKey.delete(key); else staleByKey.set(key, entry);
  staleVersion += 1;
  staleListeners.forEach((l) => l());
}
function subscribeStale(cb: () => void): () => void { staleListeners.add(cb); return () => { staleListeners.delete(cb); }; }

/**
 * Hint state for a screen: stale=true while any matching cached read (query-name prefixes; none = all)
 * is being served without a confirmed refresh, or the device is offline with cached data in use.
 */
export function useStaleDataSummary(prefixes?: readonly string[]): StaleSummary {
  useSyncExternalStore(subscribeStale, () => staleVersion, () => staleVersion);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  const offline = !isOnlineNow();
  const entries = Array.from(staleByKey.values()).map((e) => (offline ? { ...e, servingStale: true } : e));
  return summarizeStale(entries, prefixes);
}

function fetchAndStore<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = (async () => {
    const data = await fetcher();
    const now = Date.now();
    lastFetchAt.set(key, now);
    failedKeys.delete(key);
    const payload = JSON.stringify(data ?? null);
    const parts = key.split(':');
    await putCached({ key, orgId: parts[0] ?? '', userId: parts[1] ?? '', query: parts[2] ?? '', params: parts.slice(3).join(':'), payload, fetchedAt: now, bytes: payload.length });
    return data;
  })().finally(() => { inflight.delete(key); });
  inflight.set(key, p);
  return p;
}

export async function cachedRead<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { ttlFloorMs?: number },
): Promise<CachedReadResult<T>> {
  const floor = opts?.ttlFloorMs ?? READ_CACHE_FLOOR_MS;
  const cached = await getCached(key);
  const userId = key.split(':')[1] ?? '';
  const query = key.split(':')[2] ?? '';
  const stale = cached ? cached.fetchedAt <= staleEpoch || isStaleFor(userId) : false;
  if (cached) {
    const recent = Date.now() - (lastFetchAt.get(key) ?? 0) < floor;
    if (isOnlineNow() && (!recent || stale)) {
      fetchAndStore(key, fetcher).then(
        (fresh) => { setStale(key, null); if (JSON.stringify(fresh ?? null) !== cached.payload) readCacheRevision.bump(); },
        () => { failedKeys.add(key); setStale(key, { query, servingStale: true, cachedAt: cached.fetchedAt }); },
      );
    }
    const servingStale = !isOnlineNow() || stale || failedKeys.has(key);
    setStale(key, { query, servingStale, cachedAt: cached.fetchedAt });
    return { data: JSON.parse(cached.payload) as T, servingStale, fromCache: true, cachedAt: cached.fetchedAt };
  }
  const data = await fetchAndStore(key, fetcher); // rethrows when no cache + failure
  setStale(key, null);
  return { data, servingStale: false, fromCache: false, cachedAt: null };
}

export function markStale(prefix?: string): void {
  staleEpoch = Date.now();
  if (prefix) {
    for (const k of Array.from(lastFetchAt.keys())) if (k.includes(prefix)) lastFetchAt.delete(k);
  } else lastFetchAt.clear();
  readCacheRevision.bump();
}

export function refetchAll(): void {
  staleEpoch = Date.now();
  lastFetchAt.clear();
  readCacheRevision.bump();
}

export async function patchReadCache(op: string, payload: unknown): Promise<void> {
  const specs = getOpPatches(op);
  if (specs.length === 0) return;
  const meta = await listMeta(identity?.userId);
  for (const m of meta) {
    for (const spec of specs) {
      if (!spec.queries.includes(m.query)) continue;
      const row = await getCached(m.key);
      if (!row) continue;
      try {
        const rows = JSON.parse(row.payload);
        const params = (() => { try { const v = JSON.parse(row.params); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } })();
        const next = JSON.stringify(spec.patch(payload as never, rows, params));
        await putCached({ key: row.key, orgId: row.orgId, userId: row.userId, query: row.query, params: row.params, payload: next, fetchedAt: row.fetchedAt, bytes: next.length });
      } catch {
        await deleteKeys([m.key]);
      }
    }
  }
  readCacheRevision.bump();
}

export function ReadCacheProvider({ children }: { children: ReactNode }): ReactNode {
  const s = useSession();
  const authed = s.status === 'authenticated';
  const userId = authed ? s.session.user.id : null;
  const orgId = authed ? s.organization.id : null;

  useEffect(() => {
    if (userId && orgId) {
      identity = { orgId, userId };
      void evictAtStart(Date.now()).then(() => wipeOtherUsers(userId)).catch(() => {});
    } else if (s.status === 'unauthenticated') {
      identity = null;
      void wipeAll().catch(() => {});
    }
  }, [userId, orgId, s.status]);

  useEffect(() => {
    const invalidate = () => {
      if (userId) markAllStaleFor(userId);
      staleEpoch = Date.now();
      lastFetchAt.clear();
      readCacheRevision.bump();
    };
    const off = subscribeDrainComplete(invalidate);
    let bgAt: number | null = null;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') bgAt = bgAt ?? Date.now();
      else if (st === 'active') {
        if (bgAt !== null && Date.now() - bgAt >= BACKGROUND_STALE_MS) invalidate();
        bgAt = null;
      }
    });
    return () => {
      off();
      sub.remove();
      if (userId) clearStaleFor(userId);
    };
  }, [userId]);

  return children;
}
