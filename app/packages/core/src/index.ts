// Re-export the P2c.1 dual-clock/skew types and helpers alongside this package's own exports.
import type { ClockConfig } from './clocks.js';
export type { ClockPair, ClockConfig, SkewEvaluation } from './clocks.js';
export { DEFAULT_CLOCK_CONFIG, evaluateSkew } from './clocks.js';
// P2d.2a: re-export the offline queue schema constants and types.
export { OFFLINE_QUEUE_TABLE, CREATE_OFFLINE_QUEUE_TABLE, CREATE_OFFLINE_QUEUE_INDEX, OFFLINE_QUEUE_SCHEMA } from './offline/schema.js';
export type { QueuedMutationStatus, QueuedMutation, NewQueuedMutation } from './offline/queue.js';
export { makeIdempotencyKey } from './offline/queue.js';
// P2d.2b: re-export the optimistic-apply helper.
export type { OptimisticApplyOptions, OptimisticApplyResult } from './offline/apply.js';
export { applyOptimistic } from './offline/apply.js';
// P2d.2c: re-export the replay + conflict-resolution helpers.
export type { ReplayOptions, ReplayResult } from './offline/replay.js';
export { SERVER_WINS_FIELDS, DEVICE_WINS_FIELDS, resolveConflict, replayQueue } from './offline/replay.js';
// P3f.1: re-export the state-machine surface. Previously `state-machine.ts`
// was only reachable inside `packages/core` itself (e.g. `offline/apply.ts`'s
// relative import) — nothing outside this package could import
// `applyTransition`/`canTransition` at all, and `package.json`'s `exports`
// map only opens the `.` subpath, so a deep `@jobcore/core/state-machine`
// import is not resolvable. This re-export is what lets
// `modules/admin-finance/src/domain/transition.ts` be the module's sole
// `applyTransition` call site via a plain `@jobcore/core` import.
export { canTransition, applyTransition } from './state-machine.js';
// S3.7-prereq: re-export the payroll/earnings types.
export type { PayPeriod, BonusRule, Commission, Reimbursement, DerivedHours, CloseOut } from './payroll.js';
export { NullBonusRule } from './payroll.js';

export type Role = 'owner' | 'admin' | 'tech' | 'sales';

/**
 * Mirrors the Supabase `organizations` table.
 * TS uses camelCase; the DB is snake_case — a later mapping layer bridges them.
 * `enabledModules` ↔ `enabled_modules`.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  enabledModules: string[];
  createdAt: string;
}

export type VehicleStatus = 'assigned' | 'unassigned' | 'in_maintenance';
export type ToolStatus = 'issued' | 'not_issued' | 'needs_replacement';

/**
 * Mirrors the Supabase `profiles` table.
 * `organizationId` ↔ `organization_id`, `fullName` ↔ `full_name`, `createdAt` ↔ `created_at`.
 */
export interface Profile {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: Role;
  active: boolean;
  isTest: boolean;
  createdAt: string;
  address: string | null;
  driversLicenseNumber: string | null;
  vehicleStatus: VehicleStatus | null;
  toolStatus: ToolStatus | null;
  paidTravel: boolean;
  paidTravelPolicyMessage: string | null;
  defaultHourlyRateCents?: number;
  testJobsOnly?: boolean;
}
export const DEFAULT_PAID_TRAVEL_POLICY_MESSAGE =
  'Paid travel time is allowable if a vehicle is assigned to tech.';
export const DEFAULT_HOURLY_RATE_CENTS = 2500;

/**
 * Mirrors the Postgres `job_status` enum (supabase/0004_scheduling.sql).
 * Order matches the SQL `create type` exactly — a later ALTER TYPE migration
 * is the only sanctioned way to add a member.
 */
export type JobStatus =
  | 'new'
  | 'qualified'
  | 'scheduled'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | 'closed'
  | 'declined'
  | 'needs_reschedule'
  | 'cancelled'
  | 'archived';

/**
 * Mirrors the Supabase `jobs` table.
 * TS uses camelCase; the DB is snake_case — a later mapping layer bridges them.
 * `requested_window` (what the customer asked for) stays separate from
 * `scheduled_start`/`scheduled_end` (the business commitment) — collapsing
 * them destroys slot-hit reporting (Master Spec §6.3).
 */
export interface Job {
  id: string;
  // sequential display number (jobs.job_number)
  jobNumber?: number | null;
  organizationId: string;
  status: JobStatus;
  customerId: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  serviceId: string | null;
  source: string | null;
  payer: string | null;
  attachTiming: string | null;
  requestedWindow: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  address: string | null;
  description: string | null;
  assignedTechId: string | null;
  enRouteAt: string | null;
  inProgressAt: string | null;
  completedAt: string | null;
  createdAt: string;
  service_area_id?: string | null;
  /**
   * Workstream K (beta-test jobs): mirrors `jobs.is_beta`
   * (`supabase/0018_beta_test_jobs.sql`). Marks rows spawned by the
   * sales-marketing "Spawn Test Jobs" flow so every job-list site can hide
   * them unless the viewer opts in via `isBetaVisible`/"Show Test Jobs".
   */
  isBeta: boolean;
  houseAgeYears?: number | null;
  permitStatus?: string | null;
  parkingAvailable?: string | null;
  rooms?: string[] | null;
  panelInfo?: string | null;
  considerations?: string | null;
  ingressInstructions?: string | null;
  totalLaborSeconds: number;
  needsPremAt?: string | null;
}

/**
 * Workstream K: shared job-list visibility filter for beta/test jobs.
 * A job spawned by "Spawn Test Jobs" (`jobs.is_beta = true`) is hidden from
 * every job-list site unless the viewer has switched on "Show Test Jobs"
 * (`showBeta`), which defaults to `false`. Non-beta jobs are always visible.
 * Apply as `jobs.filter((job) => isBetaVisible(job, showBeta))`.
 */
export function isBetaVisible(job: Pick<Job, 'isBeta'>, showBeta: boolean): boolean {
  return showBeta || !job.isBeta;
}

/**
 * Shared profile-list visibility filter for test profiles.
 * A profile flagged `isTest` (`profiles.is_test = true`) is hidden from
 * every profile-list site unless the viewer has switched on "Show Test"
 * (`showTest`), which defaults to `false`. Non-test profiles are always visible.
 * Apply as `profiles.filter((profile) => isTestVisible(profile, showTest))`.
 */
export function isTestVisible(profile: Pick<Profile, 'isTest'>, showTest: boolean): boolean {
  return showTest || !profile.isTest;
}

/**
 * Result of a status-transition precondition check. `reason` is the
 * human-readable string surfaced when an illegal transition is rejected
 * (AC-1: "each illegal transition is rejected with a reason string").
 */
export type PreconditionResult = { ok: true } | { ok: false; reason: string };

/**
 * P7 Slice B: a general-purpose success/failure result envelope for
 * operations that need to carry a typed success value alongside a
 * human-readable failure reason and an optional underlying cause — the
 * `logSyncFailure` call sites in `apps/mobile/src/lib/log.ts` are the
 * primary consumer, wrapping sync/write failures without throwing across
 * the offline-queue boundary.
 */
export type OperationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string; cause?: unknown };

/**
 * P2c.2b: the `metadata` jsonb payload of a job-transition audit row.
 *
 * The P2 spec (02-P2-scheduling-core.md §3) requires every transition to record
 * `from_state`/`to_state` and the dual `occurred_at`/`synced_at` clocks, but NO
 * column exists for any of them: `0001_foundation.sql` declares none and
 * `0004_scheduling.sql` adds none. They therefore ride inside the shipped
 * `metadata jsonb not null default '{}'` column rather than in a new migration.
 */
export interface JobTransitionAudit {
  fromState: JobStatus;
  toState: JobStatus;
  /** Device clock — the payroll-relevant input. */
  occurredAt: string;
  /** Server clock; falls back to `occurredAt` when no server clock is wired up. */
  syncedAt: string;
  skewMs: number;
  skewed: boolean;
}

/**
 * P2c.2a: the payload of one immutable `audit_log` row.
 *
 * Mirrors the SHIPPED `audit_log` table (supabase/0001_foundation.sql L45-56),
 * whose columns are `id, organization_id, actor_id, action, entity, entity_id,
 * metadata, created_at`. Three are deliberately absent here: `id` is
 * server-assigned (`bigint generated always as identity`), `created_at` is
 * server-defaulted (`default now()`), and `actorId` is optional because `Ctx`
 * carries a `role` but no actor identity — the sink implementation is expected
 * to fill it from the authenticated session.
 *
 * TS is camelCase, the DB is snake_case (`entityId` ⇄ `entity_id`); the
 * mapping layer that bridges them is a later slice.
 *
 * Audit rows are INSERT-ONLY and are never UPDATEd (02-P2-scheduling-core.md §3),
 * enforced by policy omission: 0001_foundation.sql grants audit_log a select
 * policy and an insert policy and nothing else — no update, no delete, no trigger.
 */
export interface AuditEntry {
  organizationId: string;
  actorId?: string;
  entity: 'job';
  entityId: string;
  action: string;
  metadata: JobTransitionAudit;
}

/**
 * Injection seam for the async/sync precondition probes that arrive in
 * P4/P5. Kept optional-shaped so `core` never depends on those packages —
 * a transition check simply treats a missing hook as "not satisfied".
 * Per 02-P2-scheduling-core.md §2, the P2b.2 preconditions are:
 *   - `in_progress` requires a submitted start checklist
 *   - `completed` requires >=1 after-photo and quality notes
 *   - `paid` requires a payment record OR `payer !== 'customer'`
 */
export interface Ctx {
  role: Role;
  now: () => string;
  /**
   * P2c.1: optional server clock. When absent, `now()` is used for both
   * `occurredAt` and `syncedAt` and skew is 0 — existing callers keep compiling.
   */
  serverNow?: () => string;
  /** P2c.1: optional skew-threshold override; defaults to `DEFAULT_CLOCK_CONFIG`. */
  clockConfig?: ClockConfig;
  /**
   * P2c.2a: optional audit sink. Optional-shaped like `serverNow?` so existing
   * callers keep compiling; when absent, `applyTransition` writes no audit row.
   * `void | Promise<void>` because `applyTransition` is already async and awaits it.
   */
  writeAudit?: (entry: AuditEntry) => void | Promise<void>;
  hasSubmittedStartChecklist?: (job: Job) => boolean | Promise<boolean>;
  hasAfterPhotos?: (job: Job) => boolean | Promise<boolean>;
  hasQualityNotes?: (job: Job) => boolean | Promise<boolean>;
  hasPaymentRecord?: (job: Job) => boolean | Promise<boolean>;
}
// Job Details 15-stage progress bar derivation.
export type { StageKey, StageState, StageInput, StageInputs, StageResult } from './jobStages.js';
export { STAGE_KEYS, STAGE_LABELS, deriveStageStates, leadingIndex, deriveNextStep } from './jobStages.js';
