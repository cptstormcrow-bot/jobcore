/**
 * Optimistic apply — the offline-first entry point for job transitions
 * (Master Spec §10 / 02-P2-scheduling-core.md P2d.2b).
 *
 * `applyOptimistic` is a thin wrapper around `applyTransition`: it decides
 * NOTHING about legality itself. `applyTransition` already calls
 * `canTransition` and throws on an illegal transition — this file lets that
 * throw propagate untouched, so nothing is ever queued for a transition that
 * was rejected. Re-deciding or re-checking legality here would let this file
 * and `state-machine.ts` drift out of sync on what is legal, which is exactly
 * what the single-declarative-transition-table rule in `state-machine.ts`
 * forbids.
 *
 * Persistence is an OPTIONAL INJECTED SEAM, mirroring the `ctx.writeAudit?`
 * pattern in `state-machine.ts`: this file never imports expo-sqlite or any
 * other database client, and never touches a database directly. The caller
 * supplies an `enqueue` callback; when absent, the mutation is computed but
 * nothing is persisted and nothing throws.
 *
 * Zero imports outside `packages/core/src` — `core` stays zero-dependency.
 */

import type { Job, JobStatus, Ctx } from '../index.js';
import { applyTransition } from '../state-machine.js';
import { makeIdempotencyKey } from './queue.js';
import type { NewQueuedMutation } from './queue.js';

/**
 * Options for `applyOptimistic`.
 */
export interface OptimisticApplyOptions {
  /**
   * Caller-supplied nonce used to build the mutation's idempotency key.
   * `packages/core` may not depend on a uuid library and must stay
   * deterministic (see `makeIdempotencyKey` in `./queue`), so the caller —
   * not this file — is responsible for generating a unique nonce.
   */
  nonce: string;
  /**
   * Optional persistence sink, optional-shaped like `ctx.writeAudit?` so
   * existing callers keep compiling. Awaited, so a failing sink rejects the
   * call rather than silently dropping the mutation. When absent, nothing
   * is persisted and nothing throws.
   */
  enqueue?: (mutation: NewQueuedMutation) => void | Promise<void>;
}

/**
 * Result of `applyOptimistic`: the transitioned job plus the queue row
 * describing the mutation that produced it.
 */
export interface OptimisticApplyResult {
  job: Job;
  mutation: NewQueuedMutation;
}

/**
 * Applies a job status transition optimistically and, when an `enqueue`
 * sink is wired up, records it as an offline mutation for later replay.
 *
 * Legality is decided entirely by `applyTransition` (which calls
 * `canTransition` internally) — this function never re-implements or
 * re-calls any precondition check. If the transition is illegal,
 * `applyTransition`'s throw propagates from here before anything is
 * queued.
 *
 * `occurredAt` is captured from the device clock (`ctx.now()`) BEFORE
 * `applyTransition` runs, so the queue row records the device clock at the
 * moment of the action — the payroll-relevant input, matching
 * `occurred_at` in `schema.ts`.
 */
export async function applyOptimistic(
  job: Job,
  to: JobStatus,
  ctx: Ctx,
  options: OptimisticApplyOptions
): Promise<OptimisticApplyResult> {
  const occurredAt = ctx.now();

  // Legality is decided here, and only here, by delegating to
  // `applyTransition`. An illegal transition throws before anything below
  // runs, so nothing is ever queued for a rejected transition.
  const next = await applyTransition(job, to, ctx);

  const op = `job.transition.${to}`;
  const id = makeIdempotencyKey(op, occurredAt, options.nonce);
  // `job.status` captures the PRE-transition state, matching the
  // `fromState` convention in `state-machine.ts`.
  const payload = JSON.stringify({ jobId: job.id, from: job.status, to });

  const mutation: NewQueuedMutation = { id, op, payload, occurredAt };

  if (options.enqueue) {
    await options.enqueue(mutation);
  }

  return { job: next, mutation };
}
