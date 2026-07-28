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
  hasSubmittedStartChecklist?: (job: Job) => boolean | Promise<boolean>;
  hasAfterPhotos?: (job: Job) => boolean | Promise<boolean>;
  hasQualityNotes?: (job: Job) => boolean | Promise<boolean>;
  hasPaymentRecord?: (job: Job) => boolean | Promise<boolean>;
}
