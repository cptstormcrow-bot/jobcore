/**
 * Dual-clock support for job lifecycle stamps (P2c.1).
 *
 * A device-clock timestamp (`occurredAt`) and a server-clock timestamp
 * (`syncedAt`) are recorded for the same event so a later step can detect
 * clock skew between a field device and the server. This file explicitly
 * does NOT write any `audit_log` row and does NOT create an audit_log
 * table — that is P2c.2.
 */

/**
 * A single event's two clock readings. `occurredAt` is the device clock
 * (the payroll-relevant input); `syncedAt` is the server clock at the
 * moment the event was synced.
 */
export interface ClockPair {
  occurredAt: string;
  syncedAt: string;
}

/** Configurable skew tolerance. */
export interface ClockConfig {
  skewThresholdMs: number;
}

/** Default skew threshold: 5 minutes. Callers may override via `ClockConfig`. */
export const DEFAULT_CLOCK_CONFIG: ClockConfig = {
  skewThresholdMs: 5 * 60 * 1000,
};

/** Result of comparing a `ClockPair` against a `ClockConfig`. */
export interface SkewEvaluation {
  skewMs: number;
  skewed: boolean;
}

/**
 * Computes the absolute skew (in ms) between `occurredAt` and `syncedAt`
 * and flags it against `config.skewThresholdMs` (default: `DEFAULT_CLOCK_CONFIG`).
 *
 * If either timestamp fails to parse, this fails LOUDLY-but-safely: rather
 * than silently treating an unparseable date as "no skew", it returns
 * `{ skewMs: NaN, skewed: true }` so the caller is forced to notice and
 * handle the bad input instead of the discrepancy being swallowed.
 */
export function evaluateSkew(pair: ClockPair, config: ClockConfig = DEFAULT_CLOCK_CONFIG): SkewEvaluation {
  const occurredAtMs = Date.parse(pair.occurredAt);
  const syncedAtMs = Date.parse(pair.syncedAt);
  if (Number.isNaN(occurredAtMs) || Number.isNaN(syncedAtMs)) {
    return { skewMs: Number.NaN, skewed: true };
  }
  const skewMs = Math.abs(syncedAtMs - occurredAtMs);
  return { skewMs, skewed: skewMs > config.skewThresholdMs };
}
