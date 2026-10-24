---
classification: sdassemblypros/jobcore
comments: "Compensation"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/compensation.md
tags: [sdassemblypros, jobcore]
---
# Compensation

How pay is calculated for a field tech's pay period, from the money-core
primitives up through the per-period result. This describes the domain
logic that already exists in `modules/admin-finance/src/money/`; it does
not add or change any bonus/pay formula.

## Money type

All money amounts are integer cents (`Money`), never floating point, to
avoid rounding drift across the pipeline. Every calculation in this domain
takes and returns `Money`, and the final `PeriodPayResult` total is always
derived from its parts — never supplied directly by a caller.

## Price sheets and commission

A `PriceSheet` holds `PriceSheetRate`s used to calculate commission for
completed jobs. A price sheet is usable only when its `status` is
`'published'` — any other status (draft, archived, etc.) causes commission
calculation to fail closed rather than silently fall back to a default rate
or zero. This means a tech's commission calculation will hard-fail, not
under-pay silently, if the org has not published a rate sheet.

`CommissionLine` records never carry reimbursement fields (see AC-9 in the
codebase) — reimbursements are a separate line item in the final result, not
folded into commission.

## Billable hours

`payroll_time_entries` (migration 0081) now holds daily free-entry hours and
clock punches, and is the sole payroll hours source (see `payroll.md`). The
job-timestamp derivation below applies to commission billable hours only; it
is derived from job timestamps, not entered directly:

- `enRouteAt` — tech marked en route to the job.
- `inProgressAt` — tech marked as started work on site.
- `completedAt` — job marked complete.

Policy, by design:

- The travel leg, from `enRouteAt` to `inProgressAt`, is **always unpaid**.
- If `inProgressAt` is missing, the **entire span is treated as unpaid
  travel** — 0 billable hours for that job. This is deliberate policy, not
  an error state: a job that never progressed past "en route" contributes no
  billable time.
- A job with **no `enRouteAt` at all** is a **failure**, not "0 hours" — it
  means the job never properly entered the payroll window and the
  calculation aborts rather than silently recording zero pay for it.
- Billable hours are rounded to the nearest 0.01 hour.

See `modules/admin-finance/src/money/billable-hours.ts` for the exact
derivation logic.

## Bonus — the `NullBonusRule` seam

`modules/admin-finance/src/money/bonus.ts` defines a `BonusRule` interface
(`evaluate(period, tech, jobs) => BonusResult`) and one implementation,
`NullBonusRule`, which is the default. **`NullBonusRule` always returns a
zero-amount bonus.** It exists as an explicit seam for a future bonus
policy — percentage, threshold, tier table, per-job kicker, or anything
else — but no such formula has been specified or implemented, and none is
in scope for this change. (Per-job Dev/Prem pay at Close-Out is a separate
mechanism and is specified in "Per-job pay at Close-Out (migration 0103)"
below.)

Plugging in a real bonus formula requires Jeff's explicit sign-off; it is
not something to implement speculatively. Anyone extending this code should
add a new `BonusRule` implementation behind the same interface when that
sign-off exists, and leave `NullBonusRule` as the safe default until then.

## Rollup: `rollUpPeriodPay`

`modules/admin-finance/src/money/rollup.ts` combines all of the above into
one pay-period result:

```
rollUpPeriodPay(tech, period, jobs, policy, options) -> PeriodPayResult
```

It:

1. Derives billable hours per job (`deriveBillableHours`), then computes
   `hoursAmount = Math.round(hoursTotal * policy.hourlyRate)`.
2. Calculates commission from completed jobs against the org's published
   price sheet.
3. Evaluates the configured `BonusRule` (`NullBonusRule` unless a real
   policy has been wired in) for `bonusAmount`.
4. Adds any reimbursements for the period as `reimbursementAmount`.
5. Derives the final `total` as the sum of all four components — `total` is
   never caller-supplied, only ever computed.

**Any per-job failure aborts the whole rollup.** If a single job in the
period fails its billable-hours derivation (e.g. missing `enRouteAt`), the
entire pay-period calculation fails rather than silently omitting that job
and paying a partial, wrong total. This mirrors the database's own
constraint that `total` must equal the sum of its parts
(`hoursAmount + commissionAmount + bonusAmount + reimbursementAmount`).

## Result type

Calculations that can fail (price sheet not published, missing timestamps,
etc.) return a `CalculationResult<T>` — a discriminated success/failure
result type — rather than throwing or returning a sentinel value, so callers
must explicitly handle the failure case before touching pay data.

## Per-job pay at Close-Out (migration 0103)

Migration `supabase/migrations/0103_pay_policy.sql` (applied live 2026-10-23).
All money is integer cents.

- `profiles` gained `worker_type` (`employee` | `contractor`, default
  `employee`), `tech_role` (`prem` | `dev` | `service`, nullable),
  `dev_pay_mode` (`hourly` | `flat`, nullable) and `flat_rate_cents`
  (nullable). Hourly pay still uses the existing `profiles.hourly_rate_cents`.
- `compensation_policies` gained `prem_bonus_flat_cents`,
  `prem_bonus_percent` and `dev_default_flat_cents`. 0103 seeds one
  "Default pay policy" row per org; all rates start at 0 until an admin sets
  them.
- Math lives in `modules/admin-finance/src/money/job-pay.ts`
  (`computeJobPayLines`). Hours come from time entries for that job; job
  total is the estimate `totalCost` converted to cents.
  - Dev tech, hourly: `round(hours x rate)`, where rate is the tech's hourly
    rate if > 0, else the policy hourly rate.
  - Dev tech, flat: the tech's `flat_rate_cents`, falling back to the policy
    `dev_default_flat_cents`. A Dev tech with no pay mode is treated as hourly.
  - Prem tech: `prem_bonus_flat_cents + round(prem_bonus_percent/100 x
    max(job total, 0))`.
  - Service tech or no role: no pay line.
- Screen #93 (`af-compensationPolicy`, `CompensationPolicyScreen.tsx`) edits
  the org policy (hourly rate, Dev flat default, Prem flat bonus, Prem percent
  bonus). It is reached from the "Open Compensation Policy" button on Close
  Out, which replaced the red "No compensation policy is configured" dead end.
  Per-tech role, worker type, Dev pay mode and flat rate are edited on the
  employee editor screen.
- The Close Out Payouts tab (`CloseOutReviewScreen.tsx`,
  `JobCloseOutRegion.tsx`) shows employee lines and contractor lines
  separately, each with a basis label (hourly, flat, prem bonus).
- At close-out, contractor lines with amount > 0 are written to
  `contractor_payouts` (status `pending`, one row per tech per job, online
  only; close-out is not undone if the write fails).
- Employee lines are a display preview only: nothing posts them to payroll or
  commissions yet.
- Pay math for already-closed jobs is unchanged.

## What this document does not cover

- A concrete period-bonus formula — none exists in this codebase by design;
  see the `NullBonusRule` section above. Per-job Dev/Prem pay at Close-Out is
  specified in the section above and is separate from that rule.
- Payroll disbursement, tax withholding, or any payment processing — out of
  scope for this app (see the Do-Not-Build list in the project plan: no card
  handling, no bonus-formula changes).
- Any change to the price sheet or commission rate structure — this
  document describes existing behavior; it introduces no new rates or
  formulas.
