import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useSession } from './session';
import { countFailed, countPending, drainOfflineQueue, listFailed, retryAllFailed } from './offline-db';
import { registerDrainRequester, setOnlineNow, subscribeDrainComplete } from './sync-events';
import type { SyncStatus } from './offline-db.types';

/* ------------------------------------------------------------------ *
 * Sync status: UI read model + the triggers that drive the drain.
 * Triggers: NetInfo change, AppState 'active', session authenticated,
 * refresh(), and requestDrain() from other modules. All funnel into one
 * debounced (500 ms) trigger that runs only when online && authenticated.
 * Failed rows are put back to pending automatically on each reconnect
 * (offline -> online edge, first reading, sign-in), at most once per 30 s.
 * ------------------------------------------------------------------ */

const SyncStatusContext = createContext<SyncStatus | null>(null);

export function SyncStatusProvider({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const authenticated = session.status === 'authenticated';

  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastDrainAt, setLastDrainAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const onlineRef = useRef(true);
  const authRef = useRef(false);
  const runningRef = useRef(false);
  const aliveRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryOnNextRef = useRef(false);
  const seenNetRef = useRef(false);
  const lastAutoRetryRef = useRef(0);

  authRef.current = authenticated;

  const recount = useCallback(async () => {
    try {
      const n = await countPending();
      if (aliveRef.current) setPendingCount(n);
      const f = await countFailed();
      if (aliveRef.current) setFailedCount(f);
    } catch {
      // keep last-known count
    }
  }, []);

  const runDrain = useCallback(async () => {
    if (Platform.OS === 'web') return; // web is always online; drain is a no-op
    if (!onlineRef.current || !authRef.current || runningRef.current) return;
    runningRef.current = true;
    setIsSyncing(true);
    try {
      if (retryOnNextRef.current) {
        retryOnNextRef.current = false;
        try {
          await retryAllFailed();
        } catch {
          // a failed reset just leaves the rows failed until the next connect
        }
      }
      const result = await drainOfflineQueue();
      if (!aliveRef.current) return;
      let err: string | null = result.aborted ? `Sync paused (${result.aborted})` : null;
      if (!err && result.failed > 0) {
        const rows = await listFailed(1);
        err = rows[0]?.last_error ?? null;
      }
      setLastError(err);
      setLastDrainAt(new Date().toISOString());
    } catch (e) {
      if (aliveRef.current) setLastError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      runningRef.current = false;
      if (aliveRef.current) setIsSyncing(false);
      await recount();
      // A reconnect that landed mid-drain still owes its retry pass.
      if (retryOnNextRef.current && aliveRef.current) triggerRef.current?.();
    }
  }, [recount]);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runDrain();
    }, 500);
  }, [runDrain]);
  const triggerRef = useRef<(() => void) | null>(null);
  triggerRef.current = trigger;

  const armAutoRetry = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoRetryRef.current < 30_000) return;
    lastAutoRetryRef.current = now;
    retryOnNextRef.current = true;
  }, []);

  // Register so other modules can call requestDrain().
  useEffect(() => {
    aliveRef.current = true;
    registerDrainRequester(trigger);
    void recount();
    const unsub = subscribeDrainComplete((e) => {
      if (aliveRef.current) setPendingCount(e.pendingAfter);
    });
    return () => {
      aliveRef.current = false;
      registerDrainRequester(null);
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trigger, recount]);

  // Connectivity: online = isConnected && isInternetReachable !== false (null = online).
  useEffect(() => {
    if (Platform.OS === 'web') {
      setOnlineNow(true);
      return;
    }
    const unsub = NetInfo.addEventListener((s) => {
      const online = !!s.isConnected && s.isInternetReachable !== false;
      const wasOnline = onlineRef.current;
      if (online && (!seenNetRef.current || !wasOnline)) armAutoRetry();
      seenNetRef.current = true;
      onlineRef.current = online;
      setOnlineNow(online);
      setIsOnline(online);
      if (online) trigger();
    });
    return unsub;
  }, [trigger, armAutoRetry]);

  // Foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') trigger();
    });
    return () => sub.remove();
  }, [trigger]);

  // Session: drain when authenticated; otherwise no drain, queue kept.
  useEffect(() => {
    if (authenticated) {
      armAutoRetry();
      trigger();
    }
  }, [authenticated, trigger, armAutoRetry]);

  const refresh = useCallback(() => {
    void recount();
    trigger();
  }, [recount, trigger]);

  const retryAll = useCallback(async () => {
    try {
      await retryAllFailed();
    } catch {
      // keep rows as they are; the next connect retries again
    }
    if (aliveRef.current) setLastError(null);
    await recount();
    trigger();
  }, [recount, trigger]);

  const value: SyncStatus = { isOnline, pendingCount, failedCount, isSyncing, lastDrainAt, lastError, refresh, retryAll };
  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatus {
  const ctx = useContext(SyncStatusContext);
  if (ctx === null) {
    throw new Error('useSyncStatus() must be called inside a <SyncStatusProvider>.');
  }
  return ctx;
}
