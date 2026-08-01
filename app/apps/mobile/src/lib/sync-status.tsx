import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ *
 * Sync status
 * ------------------------------------------------------------------ */

/**
 * Read model over the offline queue built in `packages/core`. This is not
 * the queue itself — it's a small, UI-facing summary that a screen can
 * subscribe to without reaching into the queue's storage directly.
 */
export interface SyncStatus {
  pendingCount: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  refresh: () => void;
}

const SyncStatusContext = createContext<SyncStatus | null>(null);

/**
 * `countPending` and `replay` are INJECTED because this file must not import
 * expo-sqlite or Supabase — it mirrors the optional-sink injection idiom
 * used by `ctx.writeAudit?` in @jobcore/core and by `enqueue?`/`markFailed?`
 * in the core offline module. `replay` is optional; when absent, `sync()`
 * (driven from `refresh()`) only recounts rather than attempting to drain
 * the queue.
 */
export interface SyncStatusProviderProps {
  children: React.ReactNode;
  countPending: () => Promise<number>;
  replay?: () => Promise<{ sent: number; failed: number }>;
}

export function SyncStatusProvider({ children, countPending, replay }: SyncStatusProviderProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    runRefresh();

    return () => {
      cancelledRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warm failure (we already have a last-known pending count) retains that
  // count rather than resetting to zero — same rationale as session.tsx's
  // applyOutcome: a transient read error shouldn't make the queue look
  // empty when it isn't.
  function runRefresh() {
    setSyncing(true);
    const replayThenCount = replay
      ? replay().then(() => countPending())
      : countPending();

    void replayThenCount
      .then((count) => {
        if (cancelledRef.current) return;
        setPendingCount(count);
        setLastError(null);
        // `new Date()` is fine here — this is the app, not zero-dependency core.
        setLastSyncAt(new Date().toISOString());
      })
      .catch((err: unknown) => {
        if (cancelledRef.current) return;
        setLastError(err instanceof Error ? err.message : 'Unable to read the offline queue.');
      })
      .finally(() => {
        if (cancelledRef.current) return;
        setSyncing(false);
      });
  }

  const value: SyncStatus = {
    pendingCount,
    syncing,
    lastSyncAt,
    lastError,
    refresh: runRefresh,
  };

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatus {
  const ctx = useContext(SyncStatusContext);
  if (ctx === null) {
    throw new Error('useSyncStatus() must be called inside a <SyncStatusProvider>.');
  }
  return ctx;
}
