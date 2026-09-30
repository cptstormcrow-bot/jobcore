/**
 * Offline queue replay + conflict resolution (02-P2-scheduling-core.md
 * P2d.2c).
 *
 * Zero imports outside `packages/core/src` — this file never imports
 * expo-sqlite, Supabase, or any other transport/database client. The caller
 * supplies both the transport (`ReplayOptions.send`) and the persistence
 * callbacks; `core` only decides ordering, error handling, and which side
 * wins a field-level conflict.
 */

import type { Job } from '../index.js';
import type { QueuedMutation } from './queue.js';

/**
 * Fields on which the SERVER is authoritative during conflict resolution.
 * The dispatcher may have rescheduled a job while the device was offline,
 * so the server's scheduling state always wins over whatever the device
 * last saw (02-P2-scheduling-core.md P2d.2c ledger row: "server wins on
 * scheduling fields, device wins on `occurred_at`").
 */
export const SERVER_WINS_FIELDS = ['requestedWindow', 'scheduledStart', 'scheduledEnd', 'assignedTechId'] as const;

/**
 * Fields on which the DEVICE is authoritative during conflict resolution.
 * These are stamped from the device clock at the moment of the action (see
 * `occurredAt` in `./queue` and `applyOptimistic` in `./apply`) and are the
 * payroll-relevant inputs, so the device wins even when the server row is
 * newer.
 */
export const DEVICE_WINS_FIELDS = ['enRouteAt', 'inProgressAt', 'completedAt'] as const;

/**
 * Merges a local (device) job with the server's copy of the same job.
 *
 * `server` is the base — every field not named in `DEVICE_WINS_FIELDS`
 * (including every field in `SERVER_WINS_FIELDS`) takes the server value.
 * Each `DEVICE_WINS_FIELDS` key is then overwritten with the LOCAL value,
 * but only when the local value is non-null: a null local timestamp means
 * the device never stamped that action, so the server's value (if any) is
 * kept instead of clobbering it with `null`.
 *
 * `status` is a special case: it takes the LOCAL value only when at least
 * one `DEVICE_WINS_FIELDS` key has a non-null local value and a null server
 * value — i.e. the device recorded an action (en route / in progress /
 * completed) that the server hasn't seen yet, so the device's status is
 * ahead of the server's. Otherwise `status` keeps the server's value.
 */
export function resolveConflict(local: Job, server: Job): Job {
  const merged: Job = { ...server };

  let localIsAhead = false;
  for (const field of DEVICE_WINS_FIELDS) {
    const localValue = local[field];
    if (localValue !== null) {
      merged[field] = localValue;
      if (server[field] === null) {
        localIsAhead = true;
      }
    }
  }

  merged.status = localIsAhead ? local.status : server.status;

  return merged;
}

/**
 * Options for `replayQueue`.
 */
export interface ReplayOptions {
  /** Injected transport; `core` never knows what Supabase is. Treat SQLSTATE 42501 (permission denied) as permanent: never re-queue it. */
  send: (mutation: QueuedMutation) => Promise<void>;
  /** Called after a mutation is successfully sent. */
  markDone: (id: string) => void | Promise<void>;
  /** Called when a mutation fails to send; optional-shaped like `ctx.writeAudit?`. */
  markFailed?: (id: string, error: unknown) => void | Promise<void>;
}

/**
 * Result of `replayQueue`: counts of mutations sent and failed.
 */
export interface ReplayResult {
  sent: number;
  failed: number;
}

/**
 * Replays queued mutations SEQUENTIALLY in the order given — the caller is
 * expected to supply rows ordered by the `(status, occurred_at)` index,
 * i.e. device-clock order.
 *
 * Exactly-once replay is guaranteed by the client-generated idempotency key
 * that is each row's primary key (`QueuedMutation.id`, per AC-4 in
 * 02-P2-scheduling-core.md: "A mutation made offline replays exactly once
 * on reconnect — no duplicates") — NOT by anything in this loop. This loop
 * only decides ordering and error isolation.
 *
 * Any row whose `status` is not `'pending'` is skipped: it is neither sent
 * nor counted. For each pending row, `options.send` is awaited and, on
 * success, `options.markDone` is awaited and `sent` is incremented. If
 * `send` throws, the error is caught, `options.markFailed?.` is awaited
 * with the row id and error, `failed` is incremented, and the loop
 * CONTINUES to the next row — one bad mutation must never stall the queue.
 */
export async function replayQueue(
  pending: readonly QueuedMutation[],
  options: ReplayOptions
): Promise<ReplayResult> {
  let sent = 0;
  let failed = 0;

  for (const mutation of pending) {
    if (mutation.status !== 'pending') {
      continue;
    }

    try {
      await options.send(mutation);
      await options.markDone(mutation.id);
      sent += 1;
    } catch (err) {
      await options.markFailed?.(mutation.id, err);
      failed += 1;
    }
  }

  return { sent, failed };
}
