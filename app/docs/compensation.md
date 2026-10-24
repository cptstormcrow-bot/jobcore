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
or zero. Close-Out no longer hard-fails on this: the price-sheet commission
(`commissions` table) is best effort, written only when an active price sheet
has a matching rate row. Otherwise it is skipped and the close-out still
succeeds (job moves completed->paid or paid->closed).

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
  - Dev tech, flat (0103; replaced by commission in 0107, see below): the tech's `flat_rate_cents`, falling back to the policy
    `dev_default_flat_cents`. A Dev tech with no pay mode is treated as hourly.
  - Prem tech: `prem_bonus_flat_cents + round(prem_bonus_percent/100 x
    max(job total, 0))`.
  - Service tech: no pay line.
  - No role but a personal hourly rate (> 0): paid hourly like a Dev tech
    (pay mode ignored).
  - No role and no rate: no pay line.
- Screen #93 (`af-compensationPolicy`, `CompensationPolicyScreen.tsx`) edits
  the org policy (hourly rate, Dev default commission percent since 0107
  (was Dev flat default), Prem flat bonus, Prem percent
  bonus). It is reached from the "Open Compensation Policy" button on Close
  Out, which replaced the red "No compensation policy is configured" dead end.
  Per-tech role, worker type, Dev pay mode, Base Pay (hourly or flat rate) and
  commission are edited on the PAY tab of the employee editor screen; the
  hourly rate no longer lives on the Detail tab.
- The Close Out Payouts tab (`CloseOutReviewScreen.tsx`,
  `JobCloseOutRegion.tsx`) shows employee lines and contractor lines
  separately, each with a basis label (hourly, flat, prem bonus, commission).
- At close-out, contractor lines with amount > 0 are written to
  `contractor_payouts` (status `pending`, one row per tech per job, online
  only; close-out is not undone if the write fails).
- Migration 0104 (`supabase/migrations/0104_job_payout_lines.sql`, written and
  applied live 2026-10-24) adds table `job_payout_lines` (basis
  `dev_flat` | `prem_bonus`, plus `commission` from 0106; status `pending` | `included` | `void`;
  one live row per job per tech, per basis from 0106) and RPC `post_job_payout_lines`.
- At close-out, employee Dev FLAT (until 0107; now Dev commission, see below)
  and Prem BONUS lines with amount > 0 are posted to `job_payout_lines` (online only; close-out is not undone if the
  post fails; re-posting is idempotent).
- Dev HOURLY lines are never posted: payroll already pays those hours from
  approved timesheets, so posting would double-pay. The Payouts tab labels them
  "paid via timesheet"; flat/prem rows say "posts to next payroll run".
- `create_payout_batch` (replaced in 0104) adds each user's pending lines dated
  on or before the period end to that user's `bonus_amount`, recomputes the
  total, and stamps the lines `included` with the batch id; a user with only
  job pay still gets a payout line.
- Wage engine: `RunLine.bonusCents` (optional) shows as "Job pay": a separate
  debit line in the IIF and QBO journal (to wages expense), and a "Job Pay"
  column in the generic CSV when any line has it.
- Contractor lines are unchanged (`contractor_payouts`). Not backfilled for
  already-closed jobs.
- Pay math for already-closed jobs is unchanged.

### Commission (per-employee switch)

Migration `supabase/migrations/0106_tech_commission.sql`.

- On the Employee editor's PAY tab an admin sets "Base Pay: $xx.xx" and a
  Commission switch with a percent box. Base Pay is one field that follows the
  Hourly/Flat picker: Hourly mode edits the hourly rate (with its "Rate
  effective from" date); Flat mode (Dev role only) edits the flat rate.
- Switch OFF = base pay only. Switch ON (percent > 0 and <= 100; employees
  only, never contractors) adds an EXTRA commission pay line on top of base
  pay: `round(percent/100 x the job's labor cost)`, where labor cost is the
  estimate's labor total (not materials or other). It rides on top of hourly,
  flat or prem-bonus pay; a Prem Tech with commission on gets two lines for
  the job.
- Profile columns: `commission_enabled boolean not null default false` and
  `commission_percent numeric(5,2)`, with checks (percent null or 0..100;
  enabled requires percent > 0).
- Posting: at Close-Out the commission line is posted to `job_payout_lines`
  with basis `commission`. One live line per (job, user, basis), so a tech can
  hold a base line and a commission line on the same job. Posted lines are
  immutable: later estimate or percent changes do not alter them.

### Dev Tech commission replaces flat rate (migration 0107)

Migration `0107` (Jeff order 2026-10-24). 0106 and 0107 are NOT applied live
yet; 0107 must follow 0106.

- The Dev Tech "flat rate" ($ per assembly) is replaced by Commission: a
  percent (0 to 50) of the estimate's LABOR charged (`job_estimates.labor_cost`;
  labor lines only, not materials, the $20 upstairs fee or contingencies).
- `profiles.dev_pay_mode` is now `hourly` | `commission`; 0107 maps old `flat`
  to `commission`. A Dev Tech's personal percent reuses
  `profiles.commission_percent`. 0107 caps `commission_percent` at 0..50 for
  everyone (0106 allowed 0..100) and refuses to apply if any profile is over 50.
- `compensation_policies.dev_default_commission_percent numeric(5,2)` (default
  0, check 0..50) is the fallback when the Dev tech has no personal percent.
  `flat_rate_cents` and `dev_default_flat_cents` stay in the database,
  DEPRECATED and unused.
- Pay rule: each Dev commission tech gets THEIR OWN percent of the FULL labor
  total (no split). Labor $240: tech A at 10% = $24, tech B at 20% = $48. The
  line has basis `commission`, posts to `job_payout_lines` (employees only;
  contractors still go to `contractor_payouts`) and folds into
  `payout_lines.bonus_amount` at the next payroll batch.
- A Dev commission tech gets NO second on-top commission line; the per-employee
  Commission switch is hidden for them.
- The `dev_flat` basis stays valid in `job_payout_lines` for history but is no
  longer posted.
- After 0107, any tech who was on flat must have a percent re-entered (the
  dollar flat amount cannot convert) or they fall back to the policy default
  (0 until set).
- `create_payout_batch` sums all pending lines per user into the bonus amount
  with no basis filter, so payroll needed no change: commission lands on the
  next payroll run. Hourly pay is still paid through approved timesheets and
  is never posted.
- 0106 also widens the `job_payout_lines` basis check and unique index, and
  makes `close_out_job_write` insert into `commissions` only when all three
  commission arguments are supplied.

Limits:

- Reports "Commission Totals" still reads the legacy `commissions` table, so
  per-tech commissions do not appear there yet.
- Superseded by 0107: the picker is Hourly or Commission. On Commission the
  Base Pay box is replaced by a percent box; the hourly rate (still used by
  payroll for timesheet hours) is edited by switching the picker to Hourly.
- The policy default hourly rate is now $25.00 (live data).

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
