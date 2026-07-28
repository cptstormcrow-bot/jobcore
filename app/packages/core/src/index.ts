// Re-export the P2c.1 dual-clock/skew types and helpers alongside this package's own exports.
import type { ClockConfig } from './clocks';
export type { ClockPair, ClockConfig, SkewEvaluation } from './clocks';
export { DEFAULT_CLOCK_CONFIG, evaluateSkew } from './clocks';

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

/**
 * Mirrors the Supabase `profiles` table.
 * `organizationId` ↔ `organization_id`, `fullName` ↔ `full_name`, `createdAt` ↔ `created_at`.
 */
export interface Profile {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
}

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
  | 'cancelled';

/**
 * Mirrors the Supabase `jobs` table.
 * TS uses camelCase; the DB is snake_case — a later mapping layer bridges them.
 * `requested_window` (what the customer asked for) stays separate from
 * `scheduled_start`/`scheduled_end` (the business commitment) — collapsing
 * them destroys slot-hit reporting (Master Spec §6.3).
 */
export interface Job {
  id: string;
  organizationId: string;
  status: JobStatus;
  customerId: string | null;
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
}

/**
 * Result of a status-transition precondition check. `reason` is the
 * human-readable string surfaced when an illegal transition is rejected
 * (AC-1: "each illegal transition is rejected with a reason string").
 */
export type PreconditionResult = { ok: true } | { ok: false; reason: string };

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
