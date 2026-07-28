/**
 * Job state machine — the spine of the app (Master Spec §10).
 *
 * A single declarative transition table is the ONLY place transition legality
 * is decided. No screen, module, or hook may reimplement this logic with a
 * scattered `if` — every UI affordance asks `canTransition` instead.
 *
 * Scope note (Master Spec §10 / 02-P2-scheduling-core.md §2 and §3): this file
 * covers the P2b.2 transition table plus the three named preconditions and the
 * three lifecycle-timestamp stamps. It deliberately does NOT write `audit_log`
 * rows or the dual `occurred_at`/`synced_at` clocks — that is P2c and out of
 * scope here.
 *
 * Zero imports outside `packages/core/src` — `core` never depends on the P4
 * (checklists) or P5 (payments) packages. The `Ctx` probes below are the
 * injection seam those later phases fill in.
 */

import type { Ctx, Job, JobStatus, PreconditionResult, Role } from './index';

/**
 * Role table caveat: Master Spec §10 gives the status graph and the three
 * preconditions verbatim, but does not publish a from→to→roles table. The
 * role assignments below are a reasonable inference from Master Spec §1
 * (who performs which lifecycle step) and are called out here rather than
 * silently presented as spec text:
 *   - `owner`/`admin` perform the office-side steps (qualify, schedule,
 *     assign, mark paid, close, cancel).
 *   - `tech` performs the field-side steps (accept/decline an assignment,
 *     en route, in progress, completed) alongside `owner`/`admin` oversight.
 *   - `sales` has no job-transition authority in this table.
 * If this inference is wrong, the fix is additive: adjust the `roles` array
 * on the relevant `Transition` row — the table stays the single source of
 * legality.
 */
const OFFICE: Role[] = ['owner', 'admin'];
const FIELD: Role[] = ['owner', 'admin', 'tech'];

type Transition = {
  from: JobStatus;
  to: JobStatus;
  roles: Role[];
  precondition?: (job: Job, ctx: Ctx) => PreconditionResult;
};

/**
 * `canTransition` is declared synchronous per the 02-P2 §2 signature. `Ctx`'s
 * probes are typed `boolean | Promise<boolean>` because P4/P5 may eventually
 * supply async implementations, but the sync contract here is exact and is
 * kept exact rather than widened: a probe that returns a `Promise` is treated
 * as "not satisfied" (fail closed) with a reason explaining why, the same as
 * an undefined probe. Callers needing a real async check should await the
 * probe themselves before calling `canTransition`, or `core` grows a
 * dedicated async variant later — not a silent signature change here.
 */
function readSyncProbe(
  probe: ((job: Job) => boolean | Promise<boolean>) | undefined,
  job: Job
): boolean {
  if (probe === undefined) {
    return false;
  }
  const result = probe(job);
  if (typeof result === 'boolean') {
    return result;
  }
  // A Promise-returning probe is unsupported in this synchronous path —
  // fail closed rather than silently treat it as satisfied.
  return false;
}

function requireStartChecklist(job: Job, ctx: Ctx): PreconditionResult {
  if (!readSyncProbe(ctx.hasSubmittedStartChecklist, job)) {
    return { ok: false, reason: 'in_progress requires a submitted start checklist' };
  }
  return { ok: true };
}

function requireCompletionEvidence(job: Job, ctx: Ctx): PreconditionResult {
  if (!readSyncProbe(ctx.hasAfterPhotos, job)) {
    return { ok: false, reason: 'completed requires at least one after-photo' };
  }
  if (!readSyncProbe(ctx.hasQualityNotes, job)) {
    return { ok: false, reason: 'completed requires quality notes' };
  }
  return { ok: true };
}

function requirePaymentSettled(job: Job, ctx: Ctx): PreconditionResult {
  if (job.payer !== 'customer') {
    return { ok: true };
  }
  if (!readSyncProbe(ctx.hasPaymentRecord, job)) {
    return {
      ok: false,
      reason: 'paid requires a payment record when payer is the customer',
    };
  }
  return { ok: true };
}

/**
 * The single source of legality. Master Spec §10:
 *   new → qualified → scheduled → assigned → accepted → en_route → in_progress
 *       → completed → paid → closed
 *           ↘ declined   ↘ needs_reschedule   ↘ cancelled
 */
export const TRANSITIONS: readonly Transition[] = [
  { from: 'new', to: 'qualified', roles: OFFICE },
  { from: 'qualified', to: 'scheduled', roles: OFFICE },
  { from: 'scheduled', to: 'assigned', roles: OFFICE },
  { from: 'assigned', to: 'accepted', roles: FIELD },
  { from: 'assigned', to: 'declined', roles: FIELD },
  { from: 'accepted', to: 'en_route', roles: FIELD },
  {
    from: 'en_route',
    to: 'in_progress',
    roles: FIELD,
    precondition: requireStartChecklist,
  },
  {
    from: 'in_progress',
    to: 'completed',
    roles: FIELD,
    precondition: requireCompletionEvidence,
  },
  {
    from: 'completed',
    to: 'paid',
    roles: OFFICE,
    precondition: requirePaymentSettled,
  },
  { from: 'paid', to: 'closed', roles: OFFICE },

  // ↘ declined — a rejected assignment goes back to the office for reassignment.
  { from: 'declined', to: 'scheduled', roles: OFFICE },

  // ↘ needs_reschedule — raised from any pre-field state, resolved back to scheduled.
  { from: 'scheduled', to: 'needs_reschedule', roles: FIELD },
  { from: 'assigned', to: 'needs_reschedule', roles: FIELD },
  { from: 'accepted', to: 'needs_reschedule', roles: FIELD },
  { from: 'needs_reschedule', to: 'scheduled', roles: OFFICE },

  // ↘ cancelled — office-only, from any state prior to field work starting.
  { from: 'new', to: 'cancelled', roles: OFFICE },
  { from: 'qualified', to: 'cancelled', roles: OFFICE },
  { from: 'scheduled', to: 'cancelled', roles: OFFICE },
  { from: 'assigned', to: 'cancelled', roles: OFFICE },
  { from: 'accepted', to: 'cancelled', roles: OFFICE },
];

function findTransition(from: JobStatus, to: JobStatus): Transition | undefined {
  for (const candidate of TRANSITIONS) {
    if (candidate.from === from && candidate.to === to) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * The only place transition legality is decided. Returns a distinct
 * human-readable `reason` (AC-1) for each of: no such edge, role not
 * permitted, precondition unmet.
 */
export function canTransition(job: Job, to: JobStatus, ctx: Ctx): PreconditionResult {
  const transition = findTransition(job.status, to);
  if (transition === undefined) {
    return { ok: false, reason: `no transition from '${job.status}' to '${to}'` };
  }
  if (!transition.roles.includes(ctx.role)) {
    return {
      ok: false,
      reason: `role '${ctx.role}' is not permitted to transition '${job.status}' to '${to}'`,
    };
  }
  if (transition.precondition !== undefined) {
    const result = transition.precondition(job, ctx);
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true };
}

/**
 * Applies a transition after checking `canTransition`. Rejects with the
 * exact reason string on failure. Never mutates the input `job`; returns a
 * new object with `status` updated and the matching lifecycle timestamp
 * stamped from `ctx.now()`. Does not write audit rows or dual clocks — P2c.
 */
export async function applyTransition(job: Job, to: JobStatus, ctx: Ctx): Promise<Job> {
  const result = canTransition(job, to, ctx);
  if (!result.ok) {
    throw new Error(result.reason);
  }

  const timestamp = ctx.now();
  const next: Job = { ...job, status: to };

  if (to === 'en_route') {
    next.enRouteAt = timestamp;
  } else if (to === 'in_progress') {
    next.inProgressAt = timestamp;
  } else if (to === 'completed') {
    next.completedAt = timestamp;
  }

  return next;
}
