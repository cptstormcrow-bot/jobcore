---BUILD REPORT---
GOAL: Close out the remaining C2/M1 forward contracts and orphan-customer cleanup: Jeff said
"The C2 migration and M1 are still deferred." then "complete that", and separately gave
"OK, permission to delete" for the orphan-customer cleanup carried from the prior report.

RoA: jobcore / BUILD
Plan: E:\Jeff\.claude\plans\job-detail-save-follow-ups-null-safe-tech-trigger-atomic.md | Date: 2026-09-27 | Status: DRAFT (status flip left for Jeff)
Why: FC1 (C2 org-consistency constraint) and FC3 (M1 customerAddress input) were open forward
contracts carried from 2026-09-26_jobcore-save-followups-rpc-trigger-awaitsave.md; FC4's
orphan-customer cleanup (visible via the read-only H query in that report) was also carried,
pending Jeff's explicit go.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-09-27_jobcore-c2-fk-m1-address-orphan-cleanup.md

🔧 METHOD / TOOLS USED
- Migration authoring + `db push` for live application (Jeff's "go with the live push").
- `npx -y supabase@2.116.0 db query --linked --file c2_pre.sql` — read-only SELECT verify.
- Direct delete of 7 orphan customer rows, then a read-only post-check.
- `npx tsc -b` for typecheck verification.

✅ COMPLETED
| File / Target | Change | Action |
|---|---|---|
| supabase/migrations/0070_job_customer_same_org.sql | Unique constraint `customers(id, organization_id)`; composite FK `jobs(customer_id, organization_id)` → `customers(id, organization_id)` `ON DELETE SET NULL (customer_id)` | added, applied LIVE |
| app/apps/mobile/src/components/JobDetailsForm.tsx | Address input added, L127–136 (+9 lines) | edited |
| app/apps/mobile/app/job/[jobId].tsx | Create path L532 condition now includes `form.customerAddress`; L538 `address: form.customerAddress` replacing hardcoded `address: ''` | edited |
| Orphan customers (database rows) | 7 orphan customer rows deleted | deleted LIVE |

Commits: c3aa890 `feat(jobcore): 0070 same-org job->customer composite FK (C2/FC1)`;
581cfb7 `feat(jobcore): customer address input on job detail (M1/FC3)`
(2 files, +11/−2 across the two [jobId].tsx / JobDetailsForm.tsx edits).

🧪 VERIFY
- [x] C2 read-only verify (`c2_pre.sql`): cols = customers.organization_id:NO, jobs.organization_id:NO;
      xorg=0; cust_null_org=0; uniq=customers_id_organization_id_key, customers_pkey;
      fk=composite with ON DELETE SET NULL (customer_id); ver=170006.
- [x] `'y' | npx supabase db push` — live push of 0070 — succeeded.
- [x] Orphan delete: 7 customers deleted — Ben Castellano `00000000-0000-4000-8000-000000000206`
      (seed-style id; a reseed may recreate it), Joe Blow `7bea0d1c-…c649`, Lion's Share
      `79797e33-…f17a`, Ragnar Lobrock `c03ec53b-…1d98`, Ragnar Lobrock `dc156967-…e3`,
      Ragnar Lohbrok `18a5ef97-…6f1e`, Verus Dickus `da61c2c9-…a639`.
- [x] Post-check: 0 orphans, 0 targets remaining.
- [x] `Push-Location app; npx tsc -b; Pop-Location` — EXIT=0.
- [ ] Test plan — declined by Jeff this session ("skip the test plan"); visual check carried.

Forward contracts:
- Honored: FC1 (C2 org-consistency composite FK, migration 0070, commit c3aa890); FC3 (M1
  customerAddress input, commit 581cfb7). FC2, FC4, FC5, FC7 honored earlier (prior report).
- Closed: FC8 (test plan, closed as waived 2026-09-26).
- Carried: FC6 (`patchLifecycle` `'key' in patch` idiom alignment).
- Open: chip `task_4afe6e43` (deliver-plan.ps1 goal-slug bypass); chip `task_f9aac49a`
  (brs-scanner hardcoded to admin build-report root).
- New: F-new-1 — the visual check of the Address field on job detail is carried to Jeff.
  F-new-2 — Ben Castellano's seed-style id (`00000000-0000-4000-8000-000000000206`) may be
  recreated by a future reseed; watch item, not actionable now.
Test plan: not produced — Jeff declined test plans this session ("skip the test plan");
visual check carried.

## Deviations / Defects
1. The orphan-customer count drifted from the 4 known/detailed candidates in the prior report's
   read-only H query to 7 found at delete time (3 were previously undetailed older orphans).
2. An early verify query slipped and referenced `org_id` instead of the real column name
   `organization_id`; corrected before the query ran against the live database.
3. Spot reported "M1 already done" during recon, but the JSX Address input was in fact missing
   from the component — the report was inaccurate and had to be caught before proceeding.
4. An earlier session summary pointed at `[jobId].tsx` as the location for the Address input
   instead of the correct file, `JobDetailsForm.tsx`.
5. DEFECT FOUND+FIXED: the create path in `[jobId].tsx` hardcoded `address: ''`, so a new
   customer's address was silently dropped on creation; fixed to use `form.customerAddress`.
6. Minor: post-compaction edits to `[jobId].tsx` were applied without a fresh re-read in that
   turn; the edit succeeded and the diff was verified afterward, but the read-before-write
   ordering was not strictly observed.

⚠️ DEFERRED
| Item | Reason | Disposition | Saved to (path + anchor) |
|---|---|---|---|
| No git remote configured | `git push` blocked, exit 128 | Backlog | this report |
| Plan status flip (DRAFT → COMPLETE) | Left for Jeff | Backlog | plan file |
| Visual check of Address field on job detail | Needs Jeff's own look | Carried | this report, Forward contracts |
| Rule 41 item #10 (price-sheet migration 0032 schema catch-up) | Needs Jeff's design call, unrelated to this change | Carried | prior reports |
| Chip task_4afe6e43 (deliver-plan.ps1 goal-slug bypass) | Pre-existing, unrelated to this change | Carried | prior reports |
| Chip task_f9aac49a (brs-scanner hardcoded to admin build-report root) | Pre-existing, unrelated to this change | Carried | prior reports |

Test plan: not produced — Jeff declined test plans this session ("skip the test plan");
visual check carried.
