/**
 * Offline mutation queue — device-local types mirroring `schema.ts`.
 *
 * TS is camelCase; the SQLite columns are snake_case — the bridge is noted
 * per-field below (e.g. `occurredAt` ⇄ `occurred_at`).
 */

/**
 * Mirrors the lifecycle of the `status` column in `schema.ts`
 * (`'pending' | 'inflight' | 'failed'`).
 */
export type QueuedMutationStatus = 'pending' | 'inflight' | 'failed';

/**
 * Mirrors one row of the `offline_queue` table (see `schema.ts`).
 */
export interface QueuedMutation {
  /**
   * Client-generated idempotency key; NEVER server-assigned. It is the
   * primary key of `offline_queue` and is what makes replay exactly-once
   * (02-P2-scheduling-core.md AC-4: "A mutation made offline replays
   * exactly once on reconnect — no duplicates").
   */
  id: string;
  /** Mutation discriminator (e.g. a job transition name). */
  op: string;
  /** JSON-encoded mutation body; TEXT in SQLite. */
  payload: string;
  /**
   * ISO-8601 DEVICE clock at the moment of the action. `occurredAt` ⇄
   * `occurred_at`. This is the payroll-relevant input, and the device wins
   * on this field during conflict resolution.
   */
  occurredAt: string;
  status: QueuedMutationStatus;
  /** Replay attempts made so far; INTEGER in SQLite. */
  attempts: number;
}

/**
 * The caller-supplied subset of `QueuedMutation` used at enqueue time.
 * `status` and `attempts` are supplied by the `offline_queue` column
 * defaults (`'pending'` / `0`), so callers never set them.
 */
export interface NewQueuedMutation {
  id: string;
  op: string;
  payload: string;
  occurredAt: string;
}

/**
 * Builds a deterministic idempotency key from CLIENT-side inputs only, so
 * the key is stable across retries of the same logical action. The caller
 * supplies `nonce` (e.g. a uuid) because `packages/core` may not depend on
 * a uuid library and must not call `Math.random()` or `Date.now()` —
 * determinism is what makes the key an idempotency key.
 */
export function makeIdempotencyKey(op: string, occurredAt: string, nonce: string): string {
  return `${op}:${occurredAt}:${nonce}`;
}
