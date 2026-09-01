# Job Estimate Feature — Wave 2: Missing Migrations + Concurrent-Edit Repair (Slice D)

**Date:** 2026-09-01
**Branch:** jobcore-job-detail-action-buttons
**Trigger:** Closeout of plan `E:\Jeff\.claude\plans\mellow-tickling-conway.md` — Slices A-C (repo-layer fixes + fresh migration files) were completed and committed earlier; this report closes Slice D (hosted Supabase DB apply + smoke test).

## Summary

Closes out the "Job Estimate Feature — Wave 2: Missing Migrations + Concurrent-Edit Repair" plan.
Slice D — hosted Supabase DB apply + smoke test — was performed live by Jeff (never by Claude — no
service_role key ever used, anon key only in repo, no Docker), per the plan's explicit
environment-gating requirement.

## What shipped

- Migration `0032_price_sheet_task_pricing.sql` (`service_tasks` table + `price_sheet_area_adjustments.adjustment_target` column) — applied to hosted DB (ref `vogkxkcceahtwyovpxsg`), confirmed via information_schema introspection.
- Migration `0036_job_estimates.sql` (documentation migration for already-live `job_estimates`/`job_estimate_line_items` tables) — applied (idempotent no-op confirming existing shape).
- Migration `0037_estimate_tokens.sql` (documentation migration for already-live `estimate_tokens` table) — applied (idempotent no-op confirming existing shape).
- Slice D Step 3 smoke tests — all three passed:
  1. `service_tasks` CRUD round-trip (SQL-level), test row cleaned up.
  2. `price_sheet_area_adjustments.adjustment_target` CHECK constraint: accepts `'materials'`/`'labor'`/`'total'`, rejects invalid values; test row cleaned up.
  3. Estimate share-link flow: Jeff navigated directly to the `estimate-resolve` Edge Function URL with a live token and received a correctly rendered HTML estimate page (job "Assemble patio storage shed", customer Sofia Reyes) — confirms `JobEstimateScreen.tsx` -> `estimate-resolve` function resolution works correctly post-migration.

## Execution model

All hosted-DB actions in Slice D were performed by Jeff himself in his own authenticated session
(SQL editor + browser), per the plan's explicit environment-gating requirement — Claude never
executed SQL or app actions against the hosted DB directly, only guided/verified via read-only
introspection and confirmed Jeff's live reports.

## Deviations / Defects

none

## Forward contracts

The `issue_estimate_token` RPC's SQL body is still unlocated in any committed migration
(documented as signature-only in `0037_estimate_tokens.sql`, out of scope for this plan) — a
future migration should locate/reconstruct and commit its body. Also: the RLS test suite + manual
smoke checks from the original Employee Screen Edits merge (distinct from this plan's Slice D
SQL-level smoke tests) remain unrun — tracked in memory `jobcore-supabase-migration-pending.md`.

## Related memories

`jobcore-price-sheet-migration-0032-applied` (superseding `jobcore-price-sheet-migration-0032-partial`),
`jobcore-supabase-migration-pending` (partially resolved), `jobcore-build-report-canonical-root`,
`feedback-no-ground-on-jobcore`.
