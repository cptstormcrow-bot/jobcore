# P3 — Admin/Finance module: intake, dispatch, money

> Paste this together with `00-MASTER-SPEC.md`. Build **only** what is in *Build this*.

## Context

P1 gave you the shell and the module contract. P2 gave you the scheduling schema, the job state
machine, the offline queue, and the shared Calendar / Job Detail screens. This phase builds the
**chief module** — `modules/admin-finance` — which is where a lead becomes a scheduled job, a job
becomes an assignment, and a completed job becomes money.

Everything here ships as a `JobcoreModule` (Master Spec §11). The app shell must remain unaware
that this module exists beyond the one `registerModule` line in `apps/mobile/src/modules.ts`.

## What exists already

- Registry-driven nav shell; `getEnabledModules(org, role)` filtering on `enabled_modules` +
  `requiredRoles`; `packages/ui` primitives
- Supabase: `organizations`, `profiles`, `audit_log`, `customers`, `services`, `service_areas`,
  `leads`, `jobs`, `job_assignments` — all under `current_org_id()` RLS
- `canTransition` / `applyTransition` in `packages/core` — the **only** legal way to change status
- Payroll-grade timestamps (`occurred_at` device / `synced_at` server) and the offline queue
- Shared Calendar / day view and Job Detail, which renders `jobActions` from enabled modules

## Build this

### 1. Module registration

`modules/admin-finance` exports a `JobcoreModule` with `id: 'admin-finance'`,
`requiredRoles: ['owner', 'admin']`, its routes and nav entries, its `jobActions`, and its own
migrations. It must not be imported by `apps/mobile` except through the registry.

### 2. Migration `0003_money.sql`

`price_sheets` · `price_sheet_rates` · `compensation_policies` · `commissions` ·
`reimbursements` · `payout_batches` · `payout_lines`.

- `price_sheets` is **versioned and immutable once published**: `version`, `effective_from`,
  `published_at`, `status` (`draft|published|superseded`). Editing a published sheet creates a new
  draft version; it never mutates rows in place.
- `price_sheet_rates` is tiered **by service** and carries a rate per `attach_timing`, so an
  after-the-fact attach can price differently from an at-purchase attach on the same service.
- `commissions` snapshots `price_sheet_id` **and** `compensation_policy_id` on every row
  (Master Spec §9 snapshot rule). Historical pay must never move when a sheet is re-published.
- `reimbursements` are their own rows with a `receipt` photo reference, an `approved_by`, and an
  `approved_at`. A reimbursement is **never** a deduction against commission.

### 3. Lead inbox and the Qualify step

A list of `leads` that have not converted, newest first, with `source` / `payer` /
`attach_timing` visible. **Incomplete leads must be first-class** — the website's hero form
captures no date and no address, so those leads arrive unschedulable. Show them plainly as
*needs info*; do not hide them and do not fabricate defaults.

**Qualify** is an explicit screen (Master Spec §6.1): confirm or enter the customer, address,
service, the three axis fields, and a `requested_window`; then create the `job` in `new` and
advance it to `qualified`. Set `converted_job_id` and `qualified_at` on the lead.

### 4. Assignment board and dispatch

A day/week board of `qualified` and `scheduled` jobs against the roster of active techs. Assigning
sets `assigned_tech_id`, writes a `job_assignments` row, and advances the job via
`applyTransition` — never by writing `status` directly.

Warn (do not hard-block) on overlap with an existing `scheduled_start`/`scheduled_end` for that
tech, and on assignment outside a seeded `service_areas` community.

### 5. Close-out and commission recording

When a tech reaches `completed`, the job appears in an **Awaiting close-out** queue. The admin
reviews photos and quality notes, then closes the job. Closing calls:

```ts
calculateCommission(job, priceSheet, policy): CommissionLine
```

which resolves the rate from the **published** sheet using `service_id` + `attach_timing`, writes
one `commissions` row with both snapshot ids, and records who closed it. Commission is computed at
close-out and is **not** contingent on any review (Master Spec §12 — payout feeds review, not the
reverse).

### 6. Price-sheet editor and publish action

Create a draft, edit tiered rates per service and per `attach_timing`, then **Publish**, which
stamps `published_at`, supersedes the prior sheet, and increments `version`.

Publishing also updates what `PriceSheetPublisher` serves (Master Spec §12):

```
GET /api/price-sheet/current
→ { ok: true, version, effective_from, rates: [...] }
```

Implement this as a Supabase Edge Function that reads the current published sheet. It is
**read-only and unauthenticated by design** — it publishes rates, nothing else. **Do not write any
website code**; consuming this feed is the website's problem, later, and out of scope here.

### 7. Payroll roll-up

```ts
rollUpPeriodPay(tech, period, jobs, policy): PeriodPayResult
```

per Master Spec §12:

```
period_pay = hourly_base × billable_hours
           + Σ per-job commission
           + productivity_bonus (per active policy)
           + Σ reimbursements
```

- `billable_hours` is **derived**, not clocked: sum each job's `en_route_at → completed_at` span
  from the payroll-grade timestamps. There is no clock-in/out UI.
- Travel and idle time outside those spans are unpaid by construction; make that a documented,
  policy-settable fact rather than an accident of the query.
- The bonus is a **pluggable rule**: implement `BonusRule.evaluate(period, tech, jobs[]): BonusResult`
  and ship `NullBonusRule` (returns zero, with a reason string) as the default. The written
  productivity policy will be supplied later — leave a clearly-marked seam, and do **not** invent a
  bonus formula.
- Show the result as a **breakdown**, never a single number: hours, each commission line, bonus,
  each reimbursement.

### 8. Reimbursement approval and payout batches

Approve or reject submitted receipts with a reason. Then build a `payout_batches` row per pay
period containing one `payout_line` per tech, each frozen against the `PeriodPayResult` at batch
time. The app **records** payouts; it does not move money.

### 9. Reporting

Jobs by status, by `source`, and by `attach_timing`; requested-vs-committed slot hit rate (this is
why P2 kept `requested_window` separate); revenue and commission by service and by period.

## Do NOT build

- Any tech-facing screen — greeting, checklists, photo capture, earnings view — that is P4
- Payment capture, the QR handoff page, or reviews — P5
- Social posting or the review library — P6
- Real website intake adapters or push notifications — P7
- Any change to sdassemblypro.com, its PHP, its forms, or its GTM/GA4 tags — permanently out of scope
- Any card data anywhere in the app or database — zero PCI scope

## Acceptance criteria

1. An incomplete hero lead (no date, no address) appears in the inbox marked *needs info* and
   **cannot** be converted to a scheduled job without the missing fields.
2. Qualifying a lead creates a job in `qualified` with all three axis fields set, and stamps
   `converted_job_id` on the lead.
3. Assigning a job makes it appear on that tech's day in the shared Calendar with no code specific
   to the admin module involved in the rendering.
4. Every status change in this module goes through `applyTransition` —
   `grep -rn "status *=" modules/admin-finance` finds no direct writes.
5. Closing a completed job writes exactly one `commissions` row carrying both a `price_sheet_id`
   and a `compensation_policy_id`.
6. Re-publishing a price sheet at a new rate leaves the existing `commissions` rows numerically
   unchanged.
7. `GET /api/price-sheet/current` returns the newly published `version` immediately after publish.
8. `rollUpPeriodPay` for a tech with two jobs, one receipt, and `NullBonusRule` returns
   `hourly_base × derived_hours + both commissions + 0 bonus + the reimbursement`, itemized.
9. A reimbursement never appears as a negative adjustment to any commission line.
10. A `tech`-role user cannot see any route, nav entry, or table from this module — verified by a
    direct query, not just by the UI.

## Verification steps

1. Seed a hero-form lead with null `preferred_date` and null `address`; confirm the inbox shows it
   as *needs info* and the Qualify screen blocks conversion until both are supplied.
2. Qualify, assign, and then sign in as that tech — the job is on their day.
3. Drive a job to `completed`, close it, and inspect the `commissions` row's two snapshot ids.
4. Publish a new price sheet with a doubled rate; re-run step 3's query and confirm the old
   commission amount is byte-identical.
5. `curl` the price-sheet endpoint before and after publishing; confirm `version` increments and
   `rates` reflect the new sheet.
6. Compute one tech's period pay by hand from the `audit_log` timestamps and confirm
   `rollUpPeriodPay` matches to the cent.
7. Sign in as `tech@…` and run `select * from price_sheets` directly — expect zero rows returned.
8. `grep -rn "sdassemblypro\|GTM-\|G-93R" modules/admin-finance` — expect **no matches**.
