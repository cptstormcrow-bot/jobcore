---BUILD REPORT---

Tier: A
Project: jobcore
Slug: jobcore-profiles-pay-masking
Date: 2026-10-24
Branch: jobcore-role-landing-0.1.3 (not pushed)
Commits: 37512a5 (feat), b878405 (test), 1aad91e (docs); not pushed
Status: COMPLETE for the written scope; 0110 APPLIED LIVE 2026-10-24 on Jeff's go; 0111 is written and NOT applied.
Test plan: none - Jeff answered "No test plan" to the Rule 43 question on 2026-10-24 (nothing is applied live, so there is nothing visible to click).
Plan: E:\Jeff\.claude\plans\ok-next-on-screen-pure-boole.md

## Scope

Jeff's order (verbatim): "Yes, draft a migration that closes the profiles_select_own_org pay-column read exposure. Write it only; do not apply it live until I say so."

Later the same day Jeff said (verbatim): "Yes, apply migration 0110 to the live database now, then confirm the employee_profiles_v view exists and the app still lists employees."

Design answers: a masked view plus a column lock. Scope: two migration files plus the paired app edits (plus SQL tests and docs).

## Changes (paths under app/)

| File | Change |
|------|--------|
| supabase/migrations/0110_employee_profiles_view.sql | New view public.employee_profiles_v. The 16 non-pay columns pass through as-is. hourly_rate_cents, worker_type, tech_role, dev_pay_mode, commission_enabled and commission_percent show only to org admins and the row owner, NULL otherwise. Org-scoped; SECURITY DEFINER view with security_barrier; select granted to authenticated only. |
| supabase/migrations/0111_profiles_lock_pay_columns.sql | New. Preflight; revoke select on profiles from anon and authenticated; grant select on the 16 non-pay columns to authenticated; closing has_column_privilege check. |
| apps/mobile/src/lib/employee-profiles-source.ts | New readEmployeeProfiles helper: reads the view, falls back once to profiles on a missing-relation error (PGRST205 / 42P01) and remembers it; re-probes the view if the table later returns 42501. |
| apps/mobile/src/lib/employee-profiles-source.assert.ts | New, 6 cases; registered in apps/mobile/package.json and the root package.json test scripts. |
| apps/mobile/src/lib/admin-finance-repos.ts | listEmployees and getEmployee read through the helper. |
| apps/mobile/src/lib/payroll-repos.ts | The rate fallback reads through the helper. |
| supabase/tests/0110_employee_profiles_view_rls.test.sql | New local test, V1-V6 and L1-L4, 228 lines. |
| supabase/tests/0110_hosted_cases/01..08 | 8 new hosted cases. |
| supabase/tests/0106_hosted_cases/12_tech_reads_other_tech_pay_columns.sql and T8 in supabase/tests/0106_profiles_pay_columns_rls.test.sql | Reworded: case 12 now expects 42501 after 0111. |
| supabase/README.md | 0110/0111 rows and test rows; rows 156/157 reworded. |
| docs/compensation.md | New section "Who can read pay columns" (lines 275-314). |
| E:\Jeff memory jobcore-live-state-rollup.md and MEMORY.md | Rollup updated and index pointer added (admin repo). |

## Forward contracts:

Each needs Jeff's separate go that NAMES it.

1. DONE - 0110 was applied 2026-10-24, alone. App screens were NOT click-checked in a browser (standing order: no self browser-check); the DB-side listing was checked instead.
2. 0111 is NOT applied. It must follow 0110 and the app build that reads the view. Older installed APKs, or a dev server on an old build, will fail on employee reads with 42501 once 0111 is live.
3. Hosted cases 01, 02, 03 were run live (one file at a time, read-only) and passed 3 of 3. Cases 04-08 and the reworded 0106 case 12 are still NOT run and need 0111. Dev Tech d59e3bc7 pay was re-read through the view after the apply: worker_type employee, tech_role dev, dev_pay_mode hourly, commission_enabled true, commission_percent 2.00, hourly_rate_cents 2500 = unchanged.
4. The local one-file tests (the 0110 test file and the 0106 T8) cannot run without a local Postgres.
5. address, drivers_license_number, email and phone stay readable by every org member (Jeff's decision); one line per column in the view later.
6. Future profiles columns are locked until a migration grants them and adds them to the view.

Rule 41 statement: the prior open Forward contract of this lineage is the case-12 pay-column exposure recorded in the open-items sweep report (jobcore-open-items-sweep). This change writes its fix as 0110 + 0111; 0110 is applied live (2026-10-24) but the change does not close the exposure; it closes when 0111 is applied.

## Evidence

| Check | Result | Source |
|-------|--------|--------|
| Tests | 569 tests, 569 pass, 0 fail (563 baseline + 6 new helper cases) | cd app && npm test |
| Type-check, build config | exit 0 | npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing |
| Type-check, mobile | exit 0 | npx tsc -p apps/mobile/tsconfig.json --noEmit |
| Helper test run directly | 6 of 6 | helper assert file run directly |
| Migrations and tests vs live columns | verified by disk read against the live read-only column list (22 columns: 16 open + 6 pay) taken 2026-10-24 | disk read |
| Migration list (live) | 0110 in Local and Remote; 0111 Local only | supabase db query --linked (read-only) |
| Catalog (live) | View exists, owner postgres, reloptions security_invoker=false and security_barrier=true; authenticated has SELECT only, anon none; view columns 22 = profiles columns 22; profiles table SELECT for authenticated still open (0111 not applied) | supabase db query --linked (read-only) |
| Hosted cases 01, 02, 03 | 3 of 3 as expected | supabase db query --linked --file, one file at a time (read-only) |
| List checks (two scratch queries, not saved in the repo) | As a technician the view returns 5 of 5 org rows with 0 pay values on the other four rows; as an admin 5 of 5 rows with pay visible | supabase db query --linked (read-only) |
| NOT verified | Still no SQL for 0111 or hosted cases 04-08 has been executed; 0110 itself ran clean on the live project; app screens not click-checked. | - |

## Deviations / Defects

1. 0111 also revokes SELECT from anon (the plan said authenticated only; the live check showed anon held a table-wide SELECT).
2. The view uses security_barrier = true (the plan did not say).
3. Both migrations end with notify pgrst, 'reload schema'.
4. The view's helper calls are wrapped as (select public.is_org_admin()), (select auth.uid()) and (select public.current_org_id()) so Postgres evaluates them once per query, not per row.
5. The helper re-probes the view after a table 42501 (not in the plan).
6. A helper test file was added (the plan had no helper test) and registered in both package.json test scripts.
7. The S6 hosted cases were written four files per hound instead of one file per hound (Rule 33 bundling).
8. The case 12 rewrite uses a DO block with a set_config capture of insufficient_privilege. The plan said to copy sibling 04's mechanism, but 04 and 06 have no capture; they are plain selects that simply error under role authenticated.
9. The docs/compensation.md section is 40 lines (15-25 was asked).
10. Two small edits (root package.json test line, MEMORY.md index line, both under 200 characters) were made from the main session under the Rule 30 carve-out.
11. One wrong file-path guess for a migration name was corrected by a glob before use.
12. db push has no per-migration selection, so 0111 was moved out of supabase/migrations to the scratchpad for the dry-run and the live push and moved straight back in a finally block; git status was clean afterwards.
13. Hosted cases 01-03 were run against 0110 alone (the report's earlier contract said after both migrations); no other case was run.

Defects: none known. 0111 and its cases remain unexecuted; that is the main residual risk.

## Open items

1. The pay-column read exposure: the fix is written as 0110 + 0111; 0110 is applied live (2026-10-24), and 0111 awaits Jeff's go. The exposure closes when 0111 is applied.
2. The local one-file SQL variants are unrun.
3. UI Inventory regen is excluded by Jeff; another session owns docs/snapshots.
4. Commission Totals may double count a job that has both a legacy commissions row and payout lines.
5. The closed-job Close-Out screen and the Commission Totals card are not click-checked.

## Rule 14 teardown

No ad-hoc process or file was left running. The held-aside 0111 copy was moved back into supabase/migrations, and the scratchpad query files remain only in the session scratchpad. No Desktop copy of this report was made (Jeff order 2026-10-05).

---END BUILD REPORT---
