---
classification: sdassemblypros/jobcore
comments: "Jobcore — Supabase foundation (P1 · S3)"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/README.md
tags: [sdassemblypros, jobcore]
---
# Jobcore — Supabase foundation (P1 · S3)

SQL only. No Supabase **client** lives here — `src/lib/supabase.ts` (with the Expo SecureStore
storage adapter) is S4's work, not S3's.

**A hosted Supabase project now exists** (ref `vogkxkcceahtwyovpxsg`). All thirteen migrations
(`0001_foundation.sql` through `0013_rls_fixes.sql`) live in this directory and have been applied to
it, the four auth users have been created, and `seed.hosted.sql` has been applied (`public.profiles`
holds 4 rows). Both hosted RLS suites have been run against it and both passed — but that coverage
is limited to `0001_foundation` and `0004_scheduling`; the newer RLS-bearing migrations (`0005` money,
`0008` field-tech-jobs, `0012` marketing) do not yet have hosted test suites, which is tracked as
separate follow-on work.

## Files

| File | Purpose |
|------|---------|
| `0001_foundation.sql` | Types, tables (`organizations`, `profiles`, `audit_log`), the `current_org_id()` tenancy helper, RLS + every policy |
| `0002_profiles_role_column_guard.sql` | Column-level `revoke update (role)` — **ineffective** against the table-level `UPDATE` grant; superseded by `0071_profiles_sensitive_column_guard.sql`, which actually closes the self-escalation gap that 4.4 below probes |
| `0003_invitations_and_signup.sql` | `invitations` table + RLS, `signup_attempts` (RLS on, no policies), and the `handle_new_user()` signup trigger that turns a pending invitation into a profile |
| `0004_scheduling.sql` | P2 scheduling core — `job_status` enum (13 values), tables `customers`, `services`, `service_areas`, `leads`, `jobs`, `job_assignments` (each with an `organization_id` FK + index), RLS enabled on all six with 25 policies scoped through `current_org_id()`; a tech's read on `jobs` resolves through `job_assignments` |
| `0005_money.sql` | P3 admin/finance money core — `publication_status`, `reimbursement_status`, `payout_batch_status` enums, the `is_org_admin()` tenancy helper, and the rate-publication / reimbursement / payout-batch schema with RLS |
| `0006_job_service_area.sql` | Adds a nullable `service_area_id` FK (+ index) on `jobs` referencing `service_areas`, `on delete set null` |
| `0007_field_tech_tables.sql` | P4 field-tech job-execution tables + RLS |
| `0008_field_tech_jobs_rls.sql` | Tech `UPDATE` policy on `jobs` (column-whitelisted via trigger), plus a commissions tech self-select policy |
| `0009_idempotency_keys.sql` | Adds `idempotency_key` columns + unique partial indexes to `audit_log` and `job_photos` for offline-queue replay dedup |
| `0010_payment_review.sql` | P5 payment + review — org-level `payment_providers` config plus the payment/review schema, RLS |
| `0011_handoff_token_issue.sql` | P5.S5 handoff token issuance — `issue_handoff_token(p_job_id uuid)`, a signed, expiring, single-job-scoped token inserted into `public.handoff_tokens` (0010) |
| `0012_marketing.sql` | Adds `reviews.sort_order` + index, `job_photos.customer_consent`; creates `marketing_assets`, `post_drafts`, `post_draft_assets`, `post_targets`, `campaign_log`, `social_providers`, `social_provider_credentials` tables with RLS; dual-consent trigger on `post_draft_assets` |
| `0013_rls_fixes.sql` | RLS defect fixes for hosted-suite findings (0004 AC-7, 0008 AC-8.2, 0010 AC-RV-2) — supersedes `jobs_select_org`, `jobs_update_org`, and `reviews_insert_anon`; adds `job_exists_in_org()` helper; idempotent, apply after `0012_marketing.sql` |
| `0014_calendar_events.sql` | Calendar events core table + RLS |
| `0015_job_detail_extensions.sql` | Job-detail extension columns/tables |
| `0016_job_status_backfill.sql` | Backfills `job_status` data for pre-existing rows |
| `0017_sales_callback_status.sql` | Sales callback status tracking |
| `0018_job_notes_gotcha_kind.sql` | Adds a `gotcha` kind to job notes |
| `0018_beta_test_jobs.sql` | Adds `jobs.is_beta boolean NOT NULL DEFAULT false` — backs the "Spawn Test Jobs" feature |
| `0019_time_off_auto_decide.sql` | Time-off requests auto-decided at insert (no admin approve/deny step); adds `decide_time_off_request()` trigger function and `cancel_time_off_request(uuid)` RPC |
| `0020_job_detail_extensions_read_access.sql` | Read-access RLS for job-detail extensions |
| `0021_payout_lines_freeze.sql` | Payout lines freeze |
| `0022_referrer_taxonomy_and_area_pricing.sql` | Referrer taxonomy + area pricing schema |
| `0022_close_out_failures.sql` | Close-out failure tracking |
| `0023_close_out_override_rpcs.sql` | Admin override RPCs for close-out |
| `0023_field_ops_segway_and_estimating.sql` | Field-ops segway + estimating schema |
| `0024_time_tracking_and_variance.sql` | Time tracking + variance schema |
| `0025_reimbursement_review_rpcs.sql` | Reimbursement review RPCs |
| `0026_close_out_write_rpc.sql` | Close-out write RPC |
| `0027_beta_test_source.sql` | Widens `jobs_source_check` to allow `'beta-test'` — unblocks the "Spawn Test Jobs" feature's synthetic-row insert. |
| `0033_job_planning.sql` | Job planning schema |
| `0034_price_sheet_archive.sql` | Adds `public.archive_price_sheet` function for archiving a price sheet — applied 2026-09-04 (linked DB, `db query --file`) |
| `0038_job_investigations_unique_job.sql` | applied 2026-09-05 (unique constraint job_investigations_job_id_key, verified via pg_constraint) |
| `0040_jobs_job_number.sql` | Sequential job number on `jobs`, numbered GLOBALLY across organizations (not per-org), by design (plan decision S1, 2026-09-03) — applied 2026-09-04 (linked DB, `db query --file`) |
| `0041_service_areas_zip_codes.sql` | Zip-code list on `service_areas` for address-based auto-select (plan decision S2, 2026-09-03) — applied 2026-09-04 (linked DB, `db query --file`) |
| `0042_job_planning_evisit_columns.sql` | Plan region's own editable copy of the E-visit fields (ingress/logistics/parking/state) on `job_planning_details`, seeded from `job_investigations` client-side where null, then diverges (plan decision 9, 2026-09-03) — applied 2026-09-04 (linked DB, `db query --file`) |
| `0044_jobs_ingress_instructions.sql` | Adds nullable `jobs.ingress_instructions` text column (gate codes, meetup notes) for the mobile Job Details form. |
| `0045_service_areas_zip_backfill.sql` | applied 2026-09-05 — backfills `service_areas.zip_codes` for 31 existing San Diego service areas (91 zips total, verified via SELECT count); enables auto zip→service-area match on the Job Details form. |
| `0048_job_notes_gotcha_kind.sql` | Adds 'gotcha' to job_notes_kind_check |
| `0049_referrer_taxonomy_and_area_pricing.sql` | Referrer taxonomy and area pricing |
| `0050_field_ops_segway_and_estimating.sql` | Field ops segway and estimating |
| `0051_restore_job_notes_gotcha_kind.sql` | Re-adds 'gotcha' alongside other values to job_notes_kind_check |
| `0065_jobs_needs_prem.sql` | jobs.needs_prem_at + Prem queue RLS + job_assignments write hardening + backfill; dedupes duplicate investigator assignments (keeps latest per job) before creating the one-investigator-per-job unique index |
| `0071_profiles_sensitive_column_guard.sql` | `BEFORE UPDATE` trigger `guard_profiles_sensitive_columns` on `profiles` — `id`/`organization_id`/`role`/`created_at` immutable for API roles, org admins limited to non-immutable columns, everyone else to `full_name`/`phone` on their own row (SQLSTATE `42501` on violation); revokes insert/update/delete/truncate on `profiles` from `anon` and truncate from `authenticated`. Supersedes the ineffective 0002 revoke |
| `0108_contractor_payouts_unique.sql` | Unique `(job_id, tech_id)` on `public.contractor_payouts`; refuses to apply if duplicates exist. STATUS: applied live 2026-10-24 (Jeff's go named 0108; constraint `contractor_payouts_job_tech_uniq` verified) |
| `0110_employee_profiles_view.sql` | Creates the view `public.employee_profiles_v`: the 16 non-pay `profiles` columns as-is, and the 6 pay columns (`hourly_rate_cents`, `worker_type`, `tech_role`, `dev_pay_mode`, `commission_enabled`, `commission_percent`) shown only to org admins and to the row's own owner, NULL for everyone else; scoped to the caller's organization; `SECURITY DEFINER` view with `security_barrier`, `select` granted to `authenticated` only. Additive; safe to apply on its own. STATUS: APPLIED LIVE 2026-10-24 on Jeff's go naming 0110 (applied alone via `supabase db push` with 0111 temporarily held out of the migrations folder; dry-run listed only 0110; `migration list` shows 0110 in Local and Remote; catalog verified: owner postgres, security_invoker=false, security_barrier=true, authenticated SELECT only, no anon access, 22 columns = profiles' 22) |
| `0111_profiles_lock_pay_columns.sql` | Revokes table-wide `select` on `public.profiles` from `anon` and `authenticated`, then grants `select` back to `authenticated` on the 16 non-pay columns only, so the 6 pay columns can be read only through `employee_profiles_v`. Preflight raises if 0110 is missing or `profiles` has a column this migration does not know. Writes, RLS policies and triggers are untouched. Must follow 0110 and the app build that reads the view. STATUS: written 2026-10-24, NOT applied live (apply only on Jeff's go that names 0111) |
| `seed.hosted.sql` | Prepared hosted variant of `seed.sql` — `auth.users` insert block removed, the four seed uuids substituted globally; apply this instead of `seed.sql` against a hosted project |
| `tests/0001_foundation_rls.hosted.test.sql` | Hosted variant of `tests/0001_foundation_rls.test.sql`, carrying the real auth uuids in place of the placeholder ids |
| `tests/0004_scheduling_rls.hosted.test.sql` | Hosted variant of `tests/0004_scheduling_rls.test.sql`, carrying the real auth uuids in place of the placeholder ids |
| `tests/0071_profiles_sensitive_column_guard_rls.hosted.test.sql` | Hosted variant of `tests/0071_profiles_sensitive_column_guard_rls.test.sql`, carrying the real auth uuids in place of the placeholder ids |
| `seed.sql` | One organization with all three modules enabled + one user per role, plus 9 services, 31 service areas (real San Diego County community rows per Master Spec §4), 6 customers, 4 leads, 5 jobs, 3 job assignments |
| `tests/0001_foundation_rls.test.sql` | Foundation assertions — `audit_log` immutability (5.3 / 5.4 below) and the profiles recursion canary. Wrapped in `begin; … rollback;` |
| `tests/0004_scheduling_rls.test.sql` | Scheduling assertions — org isolation (3.1 / 3.5) and a tech seeing only their own assigned jobs (AC-7). Wrapped in `begin; … rollback;` |
| `tests/0071_profiles_sensitive_column_guard_rls.test.sql` | Profiles sensitive-column guard assertions — 10 cases covering role/org/id/created_at immutability, tech self-edit limited to full_name/phone, admin edits, anon revokes. Wrapped in `begin; … rollback;` |

## Apply order

Order is not cosmetic — each step depends on the previous one existing.

1. **`0001_foundation.sql`** — creates the enum, the three tables, the `security definer` helper, and
   enables RLS. Run it first; `seed.sql` inserts into tables it creates.
2. **`0002_profiles_role_column_guard.sql`** — revokes `update (role)` from `authenticated`. A
   column-level `REVOKE` can only be issued against a column that exists, so it must follow 0001.
3. **`0003_invitations_and_signup.sql`** — the `invitations` table and the `on_auth_user_created`
   trigger. Depends on `public.user_role` and `public.current_org_id()` from 0001.
   **Apply this before creating any auth user below** — the trigger only provisions profiles for
   users created *after* it exists.
4. **Create the four auth users.**
   - *Local dev (`supabase start`)*: skip this step. `seed.sql` inserts the `auth.users` rows itself.
   - *Hosted project*: create four users via the Auth dashboard or the Auth Admin API
     (`owner@` / `admin@` / `tech@` / `sales@sdassemblypro.com`), then replace the four
     `00000000-0000-4000-8000-0000000001NN` ids **globally across the whole file** (every section, not
     just §2/§3 — the tech id `...0103` also appears in §8 `jobs.assigned_tech_id` and §9
     `job_assignments.tech_id`) with the real UUIDs and **delete the `insert into auth.users` block** —
     direct writes to `auth.users` are not supported against a hosted project. This has already been
     done: `seed.hosted.sql` is the prepared hosted variant with the auth.users block removed and all
     four uuids substituted globally — apply that file instead of `seed.sql` on a hosted project, and
     leave `seed.sql` untouched for local dev.
5. **`0004_scheduling.sql`** — the P2 scheduling core. Depends on `public.organizations` and
   `public.current_org_id()` from 0001; must follow 0003 (no ordering dependency on 0002).
6. **`seed.sql`** — org, then profiles, then the scheduling data (services, service areas,
   customers, leads, jobs, job assignments). Re-runnable (`on conflict do nothing`). Leads insert with `converted_job_id` set to null; a
   guarded `update` placed after the jobs section sets the one real link, because
   `leads.converted_job_id` references `jobs(id)` and the forward reference cannot be satisfied
   while the leads section runs.
7. **`tests/*.test.sql`** — run last, after the seed. Each file asserts against the seed identifiers
   and rolls itself back, so the database is unchanged either way.

All migrations through `0026_close_out_write_rpc.sql` have been applied to the hosted project (ref
`vogkxkcceahtwyovpxsg`). Files `0001`-`0013` were applied in order per each file's own "apply after"
header. Files `0014`-`0026` were applied in this order: `0014`, `0015`, `0016`, `0017`,
`0018_job_notes_gotcha_kind`, `0018_beta_test_jobs`, `0019_time_off_auto_decide`,
`0020_job_detail_extensions_read_access`, `0022_referrer_taxonomy_and_area_pricing`,
`0022_close_out_failures`, `0023_close_out_override_rpcs`, `0023_field_ops_segway_and_estimating`,
`0024_time_tracking_and_variance`, `0026_close_out_write_rpc`.

Two gaps in the numbering are known and resolved: `0022_close_out_failures.sql` and
`0026_close_out_write_rpc.sql` each carry a header comment naming a dependency (`0021`, `0025`
respectively) that never existed on disk or in git history — resolved as apply-after-previous-in-chain,
i.e. `0022_close_out_failures` applied immediately after `0022_referrer_taxonomy_and_area_pricing`, and
`0026_close_out_write_rpc` applied immediately after `0024_time_tracking_and_variance`.

`0027_beta_test_source.sql` was applied after `0026_close_out_write_rpc.sql` via the same
`supabase db query --file <path> --linked` command, to fix a `jobs_source_check` violation
discovered during live verification of Spawn Test Jobs.

Applied via the Supabase CLI: `npx -y supabase@latest db query --file <path> --linked` (not `db push`
or `db execute`, which do not apply to this repo's non-timestamped `supabase/*.sql` file layout).
`0019_time_off_auto_decide.sql` required a workaround to apply: its dollar-quoted function bodies use a
bare `$` delimiter (`as $ ... $;`) instead of the conventional `$tag$`, which the CLI's `db query --file`
Management-API path mis-parses as a syntax error. It was applied from a scratchpad copy with the bare
`$` swapped to `$body$` (semantically identical dollar-quoting) — the tracked source file on disk was
never modified. No other file in `0014`-`0026` carries this pattern.

Applying `seed.sql` before step 4 on a hosted project fails on the `profiles.id → auth.users(id)`
foreign key. That failure is correct behavior, not a bug in the seed.

## Test protocol — AC-3 / AC-4 / AC-5

Run each as the named user (an authenticated session, **not** the service role — the service role
bypasses RLS entirely and will make every check below pass vacuously).

### Automated assertions — `tests/`

The checks below are also encoded as runnable SQL under `tests/`, so they can be executed as a suite
instead of by hand:

| Test file | Covers |
|-----------|--------|
| `tests/0001_foundation_rls.test.sql` | 5.2 (append still permitted), 5.3, 5.4, and the recursion smoke test — from both an owner and a tech session |
| `tests/0004_scheduling_rls.test.sql` | 3.1, 3.5, and AC-7 (a tech sees only their assigned jobs) |
| `tests/0013_rls_fixes_rls.test.sql` | jobs_select_org (supersedes 0004's AC-7/AC-7b/AC-7c under the stricter is_org_sales_or_above() policy), jobs_update_org (net-new — admin-only update, no prior local suite covered this policy), reviews_insert_anon (supersedes 0010's AC-RV-2/AC-RV-2b/AC-RV-2c under the new job_exists_in_org() SECURITY DEFINER helper) |
| `tests/0071_profiles_sensitive_column_guard_rls.test.sql` | AC-4.4 (role cannot be self-changed) plus the rest of the 0071 rules: immutable columns, admin vs. self allow-list, anon/truncate revokes |
| `tests/0106_profiles_pay_columns_rls.test.sql` | Profiles pay columns (0103 tech_role/worker_type, 0106 commission_enabled/commission_percent, 0107 dev_pay_mode + 50 percent cap): tech blocked 42501, admin allowed, range checks 23514, cross-tech update, plus T8, reworded for 0111 to expect a tech's direct read of a colleague's pay column to be denied 42501 (T8 requires 0110 and 0111). Hand-applied after 0001..0107 and seed.sql. STATUS: the one-file local variant is NOT run (no local Postgres); its cases were run one by one live as tests/0106_hosted_cases/ on 2026-10-24, see the next row |
| `tests/0106_hosted_cases/` | 12 single-case files (01-06 tech blocked 42501, 07 admin allowed, 08-10 admin rejected 23514, 11 cross-tech update, 12 direct read of another tech's pay column (informational when run 2026-10-24; reworded for 0111 to expect 42501)); run one at a time with `supabase db query --linked --file`; each ends in rollback. STATUS: run live 2026-10-24 on Jeff's go, 12 of 12 as expected (01-06 blocked 42501; 07 allowed, rows_updated 1; 08-10 rejected 23514; 11 rows_updated 0; 12 other tech's row readable, rows_visible 1, so the profiles_select_own_org exposure was confirmed (the fix is written as migrations 0110 + 0111, NOT applied; case 12 is now reworded to expect 42501 after 0111)). Dev Tech (d59e3bc7-691d-4ada-8959-e86f40c1e344) confirmed unchanged afterward: commission_enabled true, commission_percent 2.00, dev_pay_mode hourly, tech_role dev. Run 2026-10-24 against the linked project: 01-06 blocked 42501; 07 allowed (rows_updated 1); 08-10 rejected 23514; 11 zero rows; 12 informational (1 row visible, commission_percent not exposed). Nothing persisted. |
| `tests/0104_job_payout_lines_rls.hosted.test.sql` | Hosted variant of tests/0104_job_payout_lines_rls.test.sql carrying the real auth uuids (admin a143fac2..., tech d59e3bc7..., second tech 000b2b3c...); ends with a deliberate forced error `22P02 ... 0104 HOSTED ALL PASS` so nothing persists; run 2026-10-24 against the linked project: T1-T8 all passed |
| `tests/0110_employee_profiles_view_rls.test.sql` | View masking (V1 own pay visible, V2 colleague pay NULL, V3 admin sees pay, V4 org row scope, V5 anon denied, V6 read-only) and the 0111 column lock (L1 tech denied 42501, L2 open columns readable, L3 admin denied a direct pay read but can still update, L4 column-set canary). Hand-applied after 0001..0111 and seed.sql. STATUS: written, NOT run (no local Postgres; never run it against the hosted database) |
| `tests/0110_hosted_cases/` | 8 single-case files (01 tech sees own pay in the view, 02 colleague pay NULL in the view, 03 admin sees colleague pay in the view, 04 tech direct pay read denied 42501, 05 tech direct read of open columns works, 06 admin direct pay read denied 42501, 07 admin pay update with returning id works, 08 column-set canary); run one at a time with `supabase db query --linked --file` only after 0110 and 0111 are applied; each ends in rollback. STATUS: cases 01, 02, 03 RUN LIVE 2026-10-24 against 0110 alone, 3 of 3 as expected (01 tech sees own pay; 02 tech sees colleague with all six pay columns NULL; 03 admin sees colleague pay); cases 04-08 are written, NOT run, and need 0111 applied first |

Each file opens `begin;`, sets `role authenticated` plus `request.jwt.claims` per block, raises an
exception naming the failed criterion on any mismatch, and closes `rollback;`. The same service-role
warning applies: run them as an authenticated session or every assertion passes vacuously.

The 0001 and 0004 suites have been executed against the hosted project and both passed. On a hosted project, run
the `.hosted.test.sql` variants (which carry the real auth uuids), not the placeholder-id originals.

`tests/0013_rls_fixes_rls.test.sql` / `.hosted.test.sql` has NOT yet been executed against the
hosted project (tooling blocked as of `.crib/a3-verify-unblock-brief.md`); treat as a manual/deferred
verification step until that's resolved.

Migration 0071 was pushed live and the hosted suite was executed on 2026-09-30. It ran as the single-case files in `tests/0071_hosted_cases/`, each via `supabase db query --linked --file`, because the CLI rejects `$$` blocks. Each case ends in `rollback;`, and a post-run check confirmed the seed admin/tech rows were unchanged. Result: 10 of 10 as expected. Cases 02, 07 and 10 first failed with 42804, a test-authoring defect: the CASE expression needed a `::public.user_role` cast. They passed after the fix. The local `.test.sql` (placeholder ids) has not been run, because there is no local database.

| Case | Scenario | Result |
|------|----------|--------|
| 01 | tech edits own full_name/phone | allowed (1 row) |
| 02 | tech changes own role | blocked 42501 |
| 03 | tech changes own hourly_rate_cents | blocked 42501 |
| 04 | tech flips own active flag | blocked 42501 |
| 05 | tech updates another user's row | blocked by RLS (0 rows — the trigger never fires) |
| 06 | admin updates a tech's hourly_rate_cents and active | allowed (1 row) |
| 07 | admin sets a tech's role directly | blocked 42501 |
| 08 | admin changes role via `admin_set_employee_role()` | allowed (1 row) |
| 09 | anon update | blocked 42501 (privilege revoked) |
| 10 | postgres/owner session (control) | allowed (1 row, rolled back) |

No dedicated suite exists (or is needed) for `0002_profiles_role_column_guard` — its AC-4.4 probe is
superseded by `0071_profiles_sensitive_column_guard_rls.test.sql`. `0006_job_service_area` and `0009_idempotency_keys` add no
RLS policies (service-role-only internal tables) and need no suite either.

### AC-3 — tenant isolation

| # | As | Do | Expect |
|---|----|----|--------|
| 3.1 | `owner@` | `select * from organizations` | exactly 1 row (SD Assembly Pros) |
| 3.2 | `tech@` | `select * from profiles` | 4 rows — the whole org roster, needed for job assignment |
| 3.3 | any | `select public.current_org_id()` | the seeded org id |
| 3.4 | `owner@` | insert a second org, then re-run 3.1 as `owner@` | insert **denied** (no client INSERT policy on `organizations`); org provisioning is service-role |
| 3.5 | service role | insert org B + a profile in org B; then as `owner@` re-run 3.1 | still exactly 1 row — org B is invisible |

3.5 is the real isolation test. 3.1–3.3 only prove the helper resolves; they cannot fail from
cross-tenant leakage when only one org exists.

### AC-4 — role enforcement

| # | As | Do | Expect |
|---|----|----|--------|
| 4.1 | `tech@` | `update organizations set name = 'x'` | 0 rows affected — only `owner` may update the org |
| 4.2 | `owner@` | `update organizations set name = 'SD Assembly Pros'` | 1 row affected |
| 4.3 | `tech@` | `update profiles set full_name = 'Renamed' where id = <tech id>` | 1 row — self-edit is allowed to every role |
| 4.4 | `tech@` | `update profiles set role = 'owner' where id = <tech id>` | denied — `0071`'s `guard_profiles_sensitive_columns` trigger rejects it (SQLSTATE `42501`); the error is a *permission* error, not 0 rows. Test body: `tests/0071_profiles_sensitive_column_guard_rls.test.sql` |
| 4.5 | `sales@` | `update profiles set full_name='x' where id = <tech id>` | 0 rows — not self, not admin |
| 4.6 | `admin@` | same as 4.5 | 1 row — `profiles_update_admin` |
| 4.7 | `admin@` | insert a profile with `organization_id` = another org's id | denied by `WITH CHECK` |

### AC-5 — audit log is append-only

| # | As | Do | Expect |
|---|----|----|--------|
| 5.1 | `tech@` | insert an audit row with `actor_id = auth.uid()` | succeeds |
| 5.2 | `tech@` | insert an audit row with `actor_id` = another user's id | denied — `WITH CHECK` forces self-attribution |
| 5.3 | `tech@` | `update audit_log set action='x'` | 0 rows — no UPDATE policy exists, and under RLS the absence of a policy is a denial |
| 5.4 | `tech@` | `delete from audit_log` | 0 rows — same reason |
| 5.5 | service role | `delete from audit_log where created_at < now() - interval '1 year'` | succeeds — retention is deliberately a service-role job |

### Recursion smoke test

If `0001_foundation.sql` is ever edited so a `profiles` policy reads `profiles` **inline** instead of
through `current_org_id()`, step 3.2 will fail with
`infinite recursion detected in policy for relation "profiles"`. That error is the canary for having
broken the `security definer` indirection; it is why every policy is expressed through the helper.

## Closed gap — self-service role escalation (4.4)

`profiles_update_self` permits a user to update their own row, and its `WITH CHECK` constrains `id`
and `organization_id` but **not `role`** — as written, a `tech` could promote themselves. Postgres
RLS cannot express a per-column check. `0002_profiles_role_column_guard.sql` tried to close this with a
column-level `revoke update (role) on public.profiles from authenticated`, but that revoke was a
**no-op**: `authenticated`/`anon` hold a *table-level* `UPDATE` grant, and a column-level revoke cannot
carve a column out of a table-level grant. Any signed-in user could still change their own role, pay
and active flag.

The gap is actually closed by `0071_profiles_sensitive_column_guard.sql`, a `BEFORE UPDATE` trigger
(`public.guard_profiles_sensitive_columns`) that applies to API roles: `id`, `organization_id`, `role`
and `created_at` are immutable (role changes only via `public.admin_set_employee_role()`, 0029); org
admins may change other columns; everyone else may change only `full_name` and `phone` on their own
row. Violations raise SQLSTATE `42501`. Test 4.4 above is the regression probe: if it ever starts
succeeding, 0071 was not applied.

Note for any future offline-replay `send`: treat SQLSTATE `42501` as a permanent failure and never
retry it.

## Signup provisioning (0003)

There is no self-serve signup. An owner/admin creates an `invitations` row from the admin portal;
when that person signs up, the `on_auth_user_created` trigger matches the invitation by
lower-cased email, inserts the profile with the invited org and role, and stamps `consumed_at`.
`handle_new_user()` is `security definer` with `search_path = ''` for the same reason as
`current_org_id()` — the new user satisfies none of the insert policies, and an elevated function
must not inherit a caller-controlled resolution path.

### Uninvited signup — `signup_attempts`

An address with no pending invitation still becomes an `auth.users` row: the trigger returns `new`
rather than raising, because a `raise exception` inside an AFTER INSERT trigger rolls the auth user
back and Supabase surfaces only a raw "Database error saving new user" — nothing an admin can act
on later. Instead the trigger writes one `signup_attempts` row (`user_id`, `email`, `attempted_at`)
so an admin can see who tried and extend a real invitation.

`signup_attempts` has RLS enabled and **deliberately no policies**. It has no `organization_id` —
an unmatched signup belongs to no org — so there is no tenant predicate to write, and under RLS the
absence of a policy is a denial. The table is therefore opaque to every authenticated client and is
read with the service role only, the same shape as `audit_log`'s missing UPDATE/DELETE policies.
`handle_new_user()` can still insert into it because `security definer` runs as the owner.

**Client contract:** a signed-in user with no `profiles` row is the orphan state. `current_org_id()`
returns NULL for them and every policy denies, so the app must detect the missing profile at session
start and route to an explanatory screen — not an empty dashboard.

Verify after applying: sign up an invited address and confirm the profile lands with the invited
org + role and the invitation is stamped consumed; then sign up an *uninvited* address and confirm
the auth user exists, **no** `profiles` row was created, and exactly one `signup_attempts` row is
present for that user id.

## Edge Functions

### price-sheet-current
Public price feed for the current published price sheet per organization. Reads via the service-role client only (price_sheets_admin_all / price_sheet_rates_admin_all RLS is admin-only in every direction, so no anon/authenticated read path exists). Deploy REQUIRES --no-verify-jwt (verify_jwt = false) — see functions/price-sheet-current/DEPLOY.md.

### handoff-resolve
Token-based payment-handoff resolution API for the review/handoff flow (GET /:token, POST /:token/providers/:providerId/handoff). Service-role client only, no Supabase auth session. Deploy REQUIRES --no-verify-jwt (verify_jwt = false) — see functions/handoff-resolve/DEPLOY.md.
| `0046_job_plan_tasks.sql` | applied 2026-09-05 — Adds job_plan_tasks table (per-job catalog task list, live-linked to service_tasks) and extends service_tasks with estimated_minutes, rate, category, active columns. |
