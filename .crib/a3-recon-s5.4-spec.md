# A3 Recon — P4 S5.4 negative-access spec (for hosted RLS test suite: migration 0012 marketing + S5.4)

## Source
`E:\Jeff\.claude\plans\jobcore-p4-field-tech-module-rolling-slice-implementation.md`

## Exact spec text — S5.4 (Wave 5 table, line 153)
> | S5.4 | RLS negative-access via direct SQL/REST (not the app UI) — unassigned tech rejected on jobs/checklist/photo/time-off rows; `price_sheets`/`payout_batches` return zero rows | AC1/AC9, VS1/VS7 |

Concurrency note (line 156):
> **Concurrency:** {S5.1, S5.2, S5.3} then {S5.4, S5.5}. Depends on all prior waves.

## Verification steps mapped to S5.4 (lines 196, 209-210)
1. (line 196) `select count(*) from jobs` as a signed-in tech — equals only their assignments (AC1/VS1).
10. (lines 209-210) `select * from price_sheets` / `payout_batches` as tech — zero rows; another tech's `commissions` unreadable (AC9) — S5.4.

## Status
Plan frontmatter (line 9): `status: COMPLETE — CLOSED WITH DEFERRALS (S5.3, S5.4)` — S5.4 was deferred, i.e. not actually executed/verified as of plan closure. This is the gap the hosted RLS test suite needs to cover.

## Tables / policies involved (from actual migration files, not just plan prose)

### `app/supabase/migrations/0008_field_tech_jobs_rls.sql` (field-tech jobs RLS, applies after 0005)
- `jobs_update_tech` policy (for update, to authenticated) on `public.jobs`:
  - USING/WITH CHECK: `organization_id = public.current_org_id() AND EXISTS (select 1 from public.job_assignments ja where ja.job_id = jobs.id and ja.tech_id = auth.uid())`
  - i.e. an unassigned tech (no matching `job_assignments` row) fails both USING and WITH CHECK → row invisible/unwritable.
- `jobs_tech_update_whitelist_trg` trigger + `public.jobs_tech_update_whitelist()` function: before-update trigger restricting a non-admin (`public.is_org_admin()` false) update to only `status, en_route_at, in_progress_at, completed_at`; any other column change raises exception `'jobs: tech update may only change status, en_route_at, in_progress_at, completed_at (id=%)'`.
- `commissions_select_own` policy (select, to authenticated) on `public.commissions`:
  - USING: `organization_id = public.current_org_id() AND user_id = auth.uid()`
  - This is additive to `commissions_admin_all` from 0005 (admin-only insert/update/delete) — confirms "another tech's commissions unreadable" (line 210) since a tech only sees rows where `user_id = auth.uid()`.

### `app/supabase/migrations/0005_money.sql` (price_sheets / payout_batches / commissions base RLS — reimbursements template referenced at plan line 224)
- `price_sheets_admin_all` (line 475) — admin-only in every direction; comment (lines 472-474): "price_sheets - admin-only in every direction. A non-admin caller (e.g. a tech) must see zero rows; there is no non-admin select policy at all, and with RLS enabled the absence of a policy is a denial." → directly backs S5.4's "`price_sheets`/`payout_batches` return zero rows".
- `price_sheet_rates_admin_all` (line 483) — admin-only, joins up to parent `price_sheets` row.
- `compensation_policies_admin_all` (line 504).
- `commissions_admin_all` (line 513-514) — admin-only in every direction; comment (511-513): commissioned user does not get a self-select policy in 0005 itself (self-select is added later by 0008's `commissions_select_own`).
- `reimbursements_admin_all` (line 524), `reimbursements_select_own` (line 530), `reimbursements_insert_own` (line 535) — the "working" self-scoped pattern that 0008 explicitly mirrors for `commissions_select_own` (per plan line 61: "tech-self-select policy, mirroring the working `reimbursements_select_own` pattern").
- `payout_batches_admin_all` (line 541-542) — admin-only in every direction (mirrors price_sheets).
- `payout_lines_admin_all` (line 548).
- Tables enabled for RLS: `price_sheets` (464), `commissions` (467), `payout_batches` (469).

### Field-tech tables added in `supabase/migrations/0007_field_tech_tables.sql` (per plan S0.1, line 87)
New tables referenced by S5.4's "jobs/checklist/photo/time-off rows": `checklist_templates`, `checklist_instances`, `checklist_items`, `job_photos`, `time_off_requests`, `job_notes` — plan states "each with RLS enabled" with tech-self-scoped + admin-all policies (acceptance signal: `pg_policies` shows every new table RLS-enabled). Did not independently re-verify the exact policy SQL text for these tables in this pass — 0007 file was not opened; only 0008 and 0005 were read in full. If exact policy names for checklist/photo/time-off are needed, read `app/supabase/migrations/0007_field_tech_tables.sql` directly.

## Migration 0012 (marketing)
`app/supabase/migrations/0012_marketing.sql` exists in the repo. Not read in this pass (out of scope for the S5.4 negative-access spec text itself — flagged here since the requesting task pairs "0012 marketing" + "S5.4 negative-access" as the two things the hosted RLS test suite must cover). Prior recon on migrations 0005-0012 exists at `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.crib\a1-verify-migrations-0005-0012.md` — check that file for 0012-specific findings before re-deriving them.

## File:line references
- Plan spec table: `E:\Jeff\.claude\plans\jobcore-p4-field-tech-module-rolling-slice-implementation.md:153` (S5.4 row), `:156` (concurrency), `:196`, `:209-210` (verification steps), `:9` (deferred status)
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\migrations\0008_field_tech_jobs_rls.sql` — full file (jobs_update_tech policy, whitelist trigger, commissions_select_own policy)
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\migrations\0005_money.sql:464-548` — RLS enable + admin-only/self-scoped policies for price_sheets, price_sheet_rates, compensation_policies, commissions, reimbursements, payout_batches, payout_lines
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\migrations\0007_field_tech_tables.sql` — new field-tech tables (checklist/photo/time-off); not opened this pass, needs follow-up read if exact policy SQL required
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\migrations\0012_marketing.sql` — exists, not read this pass
- Related prior recon: `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.crib\a1-verify-migrations-0005-0012.md`
