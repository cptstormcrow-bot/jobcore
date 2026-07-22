# P4 — Handyman/Assembler module: the on-site day

> Paste this together with `00-MASTER-SPEC.md`. Build **only** what is in *Build this*.

## Context

P3 built the admin side: leads become jobs, jobs get assigned, close-out produces commissions.
This phase builds `modules/field-tech` — everything the technician touches, from the morning
greeting through completion — and it is the phase where **offline is not optional**. A tech in a
garage in Chula Vista with no signal must be able to run an entire job.

## What exists already

- Registry-driven shell, module contract, `packages/ui` primitives
- `jobs`, `job_assignments`, `customers`, `services`, `service_areas` under `current_org_id()` RLS,
  with techs restricted to `assigned_tech_id = auth.uid()`
- `canTransition` / `applyTransition` — the only legal way to change status, with the three
  preconditions already declared: `in_progress` needs a submitted start checklist, `completed`
  needs ≥1 after-photo plus quality notes, `paid` needs a payment record or `payer != customer`
- The offline queue with device-wins-on-`occurred_at`, and `useSyncStatus()`
- `commissions`, `reimbursements`, `compensation_policies`, `price_sheets` (admin-owned)

This phase supplies the **real implementations** of the checklist and photo preconditions through
the injected `ctx` that P2 left open. Do not edit the state machine's transition table.

## Build this

### 1. Module registration

`modules/field-tech`, `requiredRoles: ['tech', 'admin', 'owner']` (admins need to see what a tech
sees when troubleshooting). Contributes its nav entries plus `jobActions` — *Start*, *Complete*,
*On my way* — injected into the shared Job Detail screen.

### 2. Migration `0004_fieldwork.sql`

`checklist_templates` · `checklist_instances` · `checklist_items` · `job_photos` ·
`time_off_requests`.

- Templates are **per service** and versioned; an instance snapshots the template version so a
  later template edit cannot rewrite a finished job's checklist.
- `job_photos` carries `kind` (`before|after|receipt|damage`), a Storage path, `occurred_at`, and
  the capture geolocation if permission was granted. A `receipt` photo is what feeds P3's
  reimbursement flow — it is never a commission deduction.

### 3. Morning greeting and accept/decline

On first open each day, a tech sees a greeting listing the jobs offered for that day with time,
service, community, and duration. Accept advances each job `assigned → accepted`; decline advances
it to `declined` **with a required reason**, which returns it to the admin assignment board.

Silence is not acceptance. An unanswered offer stays `assigned` and remains visibly unanswered on
the admin board.

### 4. Day list and job detail

The accepted day, in time order, each row showing status. Opening a job shows the complete
briefing: customer name and phone (tap to call), full address (tap to open maps), the service, the
tight work description from intake, `requested_window` vs the committed
`scheduled_start`/`scheduled_end`, and any admin notes.

Tech-visible fields are **non-financial job data plus their own pay** — a tech never sees the price
sheet or another tech's numbers.

### 5. Start checklist → `in_progress`

*On my way* stamps `en_route_at` and advances to `en_route`. **This timestamp starts the paid
span** — surface that plainly in the UI, because the tech is looking at a wage input, not a status
chip.

The start checklist is instantiated from the service's template. Submitting it satisfies the
`in_progress` precondition. Photos of kind `before` are captured here.

### 6. Completion: photos, quality notes, checklist → `completed`

The completion checklist plus at least one `after` photo plus written quality notes. Submitting
stamps `completed_at`, **ending the paid span**, and advances to `completed`, which puts the job
into the admin's close-out queue from P3.

Photo capture writes locally first and uploads through the offline queue. A job must be completable
with zero connectivity; uploads drain later.

### 7. Days off

A tech submits `time_off_requests` with a date range and a reason; the admin approves or denies.
An approved range shows on the assignment board as unavailable. Requesting time off is never a
status change on any job.

### 8. Earnings view

For the current and previous pay period, read-only, itemized:

- **Derived hours** — the sum of each job's `en_route_at → completed_at` span, with each job's
  contribution listed so the tech can audit the total against their own memory of the day. This is
  the *only* source of hours; there is no clock-in/out UI.
- **Commissions** — one line per closed job, showing the service and the amount.
- **Reimbursements** — each approved receipt.
- **Bonus** — whatever the active `BonusRule` returns, with its reason string. With `NullBonusRule`
  this correctly reads zero; do not hide the line and do not invent a formula.

Show a clear "pending close-out" state for completed-but-unclosed jobs so a tech understands why a
job has hours but no commission yet. **A review has no effect on any number on this screen**
(Master Spec §12).

Disputes are raised as a note to the admin, never as an edit — the timestamps are immutable audit
rows, and admin corrections are appended, not overwritten.

## Do NOT build

- Payment capture, the QR code, the handoff page, or review collection — P5
- Anything social or marketing-facing — P6
- Push notifications and real intake adapters — P7
- Any admin-only screen: price sheet, payout batches, reimbursement approval, reporting — P3
- Any edit to the P2 transition table, or any direct `status` write
- Anything touching sdassemblypro.com, its forms, or its tracking tags

## Acceptance criteria

1. A tech sees only their own jobs — verified by a direct `select * from jobs`, not by the UI.
2. Declining requires a reason and returns the job to the admin board as unassigned.
3. An entire job — accept, en route, start checklist, before photos, completion checklist, after
   photos, quality notes, complete — runs end to end **in airplane mode**.
4. On reconnect, every transition and every photo syncs exactly once, and each `occurred_at`
   matches the device time at capture, not the sync time.
5. Attempting `completed` with no after-photo or empty quality notes is rejected by
   `canTransition` with a readable reason.
6. Derived hours on the earnings screen equal the sum of the day's `en_route_at → completed_at`
   spans, to the minute.
7. A completed-but-unclosed job shows hours and a "pending close-out" commission state.
8. Submitting a five-star review anywhere in the system changes **no** value on the earnings screen.
9. A tech cannot read `price_sheets`, `payout_batches`, or another tech's `commissions`.

## Verification steps

1. Sign in as a tech; run `select count(*) from jobs` and confirm it equals only their assignments.
2. Enable airplane mode and run a full job to `completed`; confirm every screen works from cache.
3. Re-enable networking; confirm the `audit_log` rows carry the offline `occurred_at` values and
   that the photo count in Storage matches the count captured.
4. Replay the sync twice (force a duplicate drain) and confirm no duplicate transitions or photos.
5. Set the device clock 45 minutes ahead mid-job and confirm the P2 skew flag fires while
   `occurred_at` is still the value used for hours.
6. Hand-total one day's spans from `audit_log` and compare against the earnings screen.
7. `select * from price_sheets` as the tech — expect zero rows.
8. `grep -rn "status *=" modules/field-tech` — expect no direct status writes.
9. `grep -rn "sdassemblypro\|GTM-\|G-93R" modules/field-tech` — expect **no matches**.
