/**
 * Pure offline-fallback helpers (no DB, network or React), so airplane-mode
 * behaviour can be checked under `node --test`.
 */

/** Runs `run`; when it fails because the device is offline, gives `empty` instead. */
export async function orWhenOffline<T>(run: () => Promise<T>, empty: T, isOffline: (e: unknown) => boolean): Promise<T> {
  try { return await run(); } catch (e) { if (isOffline(e)) return empty; throw e; }
}

/** Finds the record with this id inside one saved payload (a single record or a list). */
export function findRecordInPayload<T>(payload: unknown, id: string, isMatch?: (rec: Record<string, unknown>) => boolean): T | null {
  for (const rec of Array.isArray(payload) ? payload : [payload]) {
    if (rec && typeof rec === 'object' && (rec as { id?: unknown }).id === id && (!isMatch || isMatch(rec as Record<string, unknown>))) return rec as T;
  }
  return null;
}
