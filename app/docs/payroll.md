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
