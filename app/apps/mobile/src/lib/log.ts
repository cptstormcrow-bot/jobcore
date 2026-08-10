/**
 * P7 Slice B: minimal structured logging for sync/offline failures.
 *
 * Deliberately NOT a crash/error-reporting SDK integration (Sentry, etc. —
 * see the P7 plan's deferred list) — this is a console-based seam that logs
 * a scope, a human-readable message, and optional structured detail so
 * failures are visible during development and easy to swap for a real
 * reporting sink later without touching call sites.
 */

export function logSyncFailure(scope: string, message: string, detail?: unknown): void {
  // eslint-disable-next-line no-console
  console.error(`[sync-failure] ${scope}: ${message}`, detail !== undefined ? detail : '');
}
