import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useSession } from './session';
import { countFailed, countPending, drainOfflineQueue, listFailed } from './offline-db';
import { registerDrainRequester, setOnlineNow, subscribeDrainComplete } from './sync-events';
import type { SyncStatus } from './offline-db.types';

/* ------------------------------------------------------------------ *
 * Sync status: UI read model + the triggers that drive the drain.
 * Triggers: NetInfo change, AppState 'active', session authenticated,
 * refresh(), and requestDrain() from other modules. All funnel into one
 * debounced (500 ms) trigger that runs only when online && authenticated.
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
    }
  }, [recount]);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runDrain();
    }, 500);
  }, [runDrain]);

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
      onlineRef.current = online;
      setOnlineNow(online);
      setIsOnline(online);
      if (online) trigger();
    });
    return unsub;
  }, [trigger]);

  // Foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') trigger();
    });
    return () => sub.remove();
  }, [trigger]);

  // Session: drain when authenticated; otherwise no drain, queue kept.
  useEffect(() => {
    if (authenticated) trigger();
  }, [authenticated, trigger]);

  const refresh = useCallback(() => {
    void recount();
    trigger();
  }, [recount, trigger]);

  const value: SyncStatus = { isOnline, pendingCount, failedCount, isSyncing, lastDrainAt, lastError, refresh };
  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatus {
  const ctx = useContext(SyncStatusContext);
  if (ctx === null) {
    throw new Error('useSyncStatus() must be called inside a <SyncStatusProvider>.');
  }
  return ctx;
}
