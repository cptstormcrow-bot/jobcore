# P2 — Scheduling core: schema, state machine, calendar, offline

> Paste this together with `00-MASTER-SPEC.md`. Build **only** what is in *Build this*.

## Context

P1 produced a working shell with auth, roles, and a module registry. This phase builds the
**scheduling core** that every module depends on: the domain schema, the job state machine, the
shared calendar and job-detail screens, and the offline queue. Still no module-specific features.

## What exists already

- Monorepo with `apps/mobile`, `packages/core`, `packages/module-sdk`, `packages/ui`, three module stubs
- Supabase `organizations`, `profiles`, `audit_log` with RLS keyed on `current_org_id()`
- A registry-driven nav shell with no hardcoded module references

## Build this

### 1. Domain schema — `0004_scheduling.sql`

`customers` · `services` · `service_areas` · `leads` · `jobs` · `job_assignments`.

Seed `services` with the nine services and `service_areas` with the 26 communities from Master
Spec §4 — as **data rows**, never as literals in components.

**`leads`** mirrors the website's nine columns exactly (`source_form, name, phone, email, service,
preferred_date, preferred_time, address, project_details`) **plus** `source`, `payer`,
`attach_timing`, `qualified_at`, `converted_job_id`. Mirroring the wire shape means the future
intake adapter is a straight copy with no lossy translation.

**`jobs`** carries `status`, `customer_id`, `service_id`, `source`, `payer`, `attach_timing`,
`requested_window`, `scheduled_start`, `scheduled_end`, `address`, `description`, `assigned_tech_id`,
and the lifecycle timestamps `en_route_at`, `in_progress_at`, `completed_at`.

**Keep requested and committed time separate** (Master Spec §6.3): the customer's
`preferred_date`/`preferred_time` become `requested_window`; `scheduled_start`/`scheduled_end` are
what the business commits to. Collapsing them destroys the ability to ever report on how often you
actually hit the requested slot.

### 2. The job state machine — `packages/core/src/state-machine.ts`

Implement Master Spec §10 as **one declarative transition table**. The canonical status list and
transition table live in `00-MASTER-SPEC.md` §10 — **not in this file**; read them there.

```ts
type Transition = {
  from: JobStatus; to: JobStatus;
  roles: Role[];
  precondition?: (job: Job, ctx: Ctx) => PreconditionResult;
};
export function canTransition(job, to, ctx): PreconditionResult;
export function applyTransition(job, to, ctx): Promise<Job>;
```

Every UI affordance in every later phase asks `canTransition` whether it is legal. Scattering this
logic into screens is the failure mode this phase exists to prevent.

Encode the three notable preconditions now, even though the features they guard arrive later:
`in_progress` requires a submitted start checklist; `completed` requires ≥1 after-photo and quality
notes; `paid` requires a payment record **or** `payer != customer`. Preconditions read through an
injected `ctx` so P4/P5 can supply real implementations without touching this file.

### 3. Payroll-grade timestamps

Implement Master Spec §10's timestamp rules **now**, not later — retrofitting an audit trail onto
wage data is far harder than building it in.

- Every transition records both `occurred_at` (device clock) and `synced_at` (server clock).
- Every transition writes an immutable `audit_log` row. Never `UPDATE` one.
- Flag rows where `|occurred_at - synced_at|` exceeds a configurable threshold.

### 4. Offline queue — `packages/core/src/offline/`

A durable local queue (SQLite or MMKV) of pending mutations with optimistic local application,
replay on reconnect, and a **deterministic** conflict rule: server wins on scheduling fields, device
wins on `occurred_at`. A tech's device clock is the payroll input; a sync-time server clock would
silently rewrite hours worked.

Expose a `useSyncStatus()` hook and a persistent "N pending" indicator.

### 5. Shared screens

- **Calendar / day view** — day and week, jobs by time, color-coded by status. Role-aware: an admin
  sees all techs, a tech sees only their own.
- **Job Detail** — the shared canvas. Renders core job data plus any `jobActions` contributed by
  enabled modules through the registry. Job Detail must have **zero** module imports.

### 6. RLS for the new tables

Mirror the role model: `admin`/`owner` full org access; `tech` reads only jobs where
`assigned_tech_id = auth.uid()` and may write only lifecycle-timestamp columns; `sales` reads
non-financial job fields. Write RLS tests as SQL assertions in `supabase/tests/`.

## Do NOT build

- Lead inbox, qualify flow, assignment UI, commission or price sheets — P3
- Checklists, photo capture, tech greeting — P4
- Payment, QR handoff, reviews — P5
- Social posting — P6
- Real website intake — P7 (and the website side is permanently out of scope)

## Acceptance criteria

1. A job can be moved through the full happy path via the state machine API in a test, and each
   illegal transition is rejected with a reason string.
2. `canTransition` is the **only** place transition legality is decided —
   `grep -rn "status ===" apps modules` finds no ad-hoc gating.
3. The day view renders correctly in **airplane mode** from cached data.
4. A mutation made offline replays exactly once on reconnect — no duplicates.
5. `occurred_at` survives sync unchanged; only `synced_at` is server-assigned.
6. Every transition produces exactly one `audit_log` row.
7. A tech querying `jobs` directly sees only their own assigned jobs.

## Verification steps

1. Run the state-machine unit suite — full happy path plus every branch (`declined`,
   `needs_reschedule`, `cancelled`).
2. Enable airplane mode, advance a job `accepted → en_route → in_progress`, re-enable networking,
   and confirm the server shows three audit rows with the offline `occurred_at` values intact.
3. Set the device clock 45 minutes ahead, transition a job, and confirm the skew flag fires.
4. `select count(*) from audit_log where entity_id = '<job>'` matches the number of transitions.
5. Run `supabase/tests/` RLS assertions — all pass.
6. Confirm `JobDetail.tsx` imports nothing from `modules/`.
