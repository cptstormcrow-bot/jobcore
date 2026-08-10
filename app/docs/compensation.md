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

There is no clock-in/out feature in this app. Billable hours are **derived**
from job timestamps, not entered directly:

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
in scope for this change.

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

## What this document does not cover

- A concrete bonus formula — none exists in this codebase by design; see
  the `NullBonusRule` section above.
- Payroll disbursement, tax withholding, or any payment processing — out of
  scope for this app (see the Do-Not-Build list in the project plan: no card
  handling, no bonus-formula changes).
- Any change to the price sheet or commission rate structure — this
  document describes existing behavior; it introduces no new rates or
  formulas.
