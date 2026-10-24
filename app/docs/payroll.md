---
classification: sdassemblypros/jobcore
comments: "Payroll"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/payroll.md
tags: [sdassemblypros, jobcore]
---
# Payroll

Status: migrations 0080-0085 are NOT pushed live until Jeff says go.

## Pay period

Weekly pay only. `payroll_settings` (migration 0080) stores the week-start day
and an anchor date; period boundaries derive from those two values.

## California overtime

- Daily hours over 8: 1.5x; over 12: 2x.
- Weekly hours over 40: 1.5x.
- 7th consecutive workday in the week: premium rules apply.

## Effective-dated rates

- `employee_rate_history` holds each rate with its effective date.
- Changes go through the `set_employee_rate` RPC.
- `profiles.hourly_rate_cents` is a mirror of the current rate, kept in sync
  by the RPC; it is not the source of truth.
- `profiles` also carries `worker_type`, `tech_role`, `dev_pay_mode` and
  `flat_rate_cents` (0103), used by Close-Out job pay; see `compensation.md`.
- `profiles` also carries `commission_enabled boolean not null default false`
  and `commission_percent numeric(5,2)` (0106). Checks: percent is null or
  0..100 (0..50 from 0107), and enabled requires percent > 0. An admin sets
  them on the Employee editor's Pay tab (Base Pay + Commission switch).
- 0107: `dev_pay_mode` is `hourly` | `commission` (old `flat` mapped to
  `commission`); `flat_rate_cents` is deprecated and unused. A Dev commission
  tech's percent is `commission_percent`; the policy fallback is
  `compensation_policies.dev_default_commission_percent`. 0106 and 0107 are
  applied live (2026-10-24). Techs who were on flat are now in Commission mode
  with no personal percent, so they get the policy default (0 until set) until
  an admin enters a percent on the Pay tab.

## Hours: payroll_time_entries (0081)

`payroll_time_entries` holds daily free-entry hours and clock punches. It is
the sole payroll hours source. Entries follow a submit then approve flow;
only approved entries feed payroll.

## Reimbursements

- Visible to the owning employee or an admin only.
- A receipt photo is required; this is enforced at the app layer, not the DB.
- Receipts live in a private `receipts` storage bucket (0083).
- `rejection_reason` and mark-paid are added in 0082.

## Payouts

`payout_batches` and `payout_lines` are reused, with additive columns (0084).

The Close-Out Payouts tab and its `contractor_payouts` rows are separate from
`payout_batches`/`payout_lines`. Employee Close-Out flat/prem lines post to
`job_payout_lines` (0104, applied live 2026-10-24), and `create_payout_batch`
folds each user's pending lines into `payout_lines.bonus_amount` (see
`compensation.md`). The `job_payout_lines` basis values are `dev_flat`,
`prem_bonus` and `commission` (0106); the unique live row is per
(job, user, basis). With commission on, Close-Out posts an extra `commission`
line = round(percent/100 x the job's estimate labor cost) for that employee,
on top of their normal line (employees only, never contractors). From 0107 a
Dev commission tech instead gets one `commission` line = their own percent of
the FULL labor total (no split, no second on-top line); `dev_flat` stays valid
for history but is no longer posted.
`create_payout_batch` sums all pending lines per user without filtering by
basis, so payroll code is unchanged: commission lands in the next run's
`bonus_amount`. Exports carry it as "Job pay": a separate wages-expense
debit in IIF and QBO journal, and a "Job Pay" column in generic CSV when any
line has it.

## Export log and QuickBooks (0085)

0085 adds the export log and the QB account map.

Formatters live in `packages/core/src/wage-engine/export`:

- Generic CSV
- QBO journal CSV
- IIF

Caveats:

- QuickBooks flavor (Online vs Desktop) is undetermined.
- IIF DURATION and date formats are unconfirmed.
- QBO journal import has a ~1000-row cap, and all accounts must pre-exist.
