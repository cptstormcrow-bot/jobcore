---BUILD REPORT---

# Spawn Test Jobs (Sales & Marketing) + Job Service Area sub-task — 2026-09-13

**Date:** 2026-09-13
**Tier:** A

## Summary

Fixed the "Spawn Test Jobs" button in the Sales & Marketing (JobCore) module so it creates
realistic, retestable test jobs:
- Carlsbad service area, using real Carlsbad addresses (2450 Jefferson St, Carlsbad, CA 92008 /
  1140 Carlsbad Village Dr, Carlsbad, CA 92008 / 3200 Roosevelt St, Carlsbad, CA 92008)
- Customer name "Test Customer", phone 760-580-6041
- No tech assigned at spawn (`assigned_tech_id` left null)
- Rows tagged `is_beta=true` so they are individually deletable and bulk-deletable via "Delete All"
- Normal (non-beta) jobs remain non-deletable

Implementation lives in `app/apps/mobile/src/lib/sales-marketing-repos.ts`
(`spawnTestJobs`/`deleteTestJob`/`deleteAllTestJobs`/`listTestJobs`) and is wired into
`app/modules/sales-marketing/src/screens/SalesMarketingRoot.tsx` (spawn button + test-jobs panel
with per-row Delete + Delete All).

Sub-task (closed): Job Service Area field — confirmed already present and working as a selectable
picker on the Job view/edit screen in `app/apps/mobile/src/components/JobDetailsForm.tsx` (lines
~141-153, using the shared `<Select>` component, `UNASSIGNED_SERVICE_AREA` sentinel for null), with
status displayed. No code change was needed for this sub-task; it was verification-only.

## Bug fixed during this work

Migration 0049_referrer_taxonomy_and_area_pricing.sql narrowed the `jobs_source_check` constraint,
which broke the old spawner's insert using `source: 'beta-test'` (constraint violation). Fixed by
omitting the `source` field entirely from the spawn insert (jobs.source is nullable / has no
default requirement here) rather than widening the DB constraint.

## Files Changed

- `app/apps/mobile/src/lib/sales-marketing-repos.ts`
- `app/modules/sales-marketing/src/screens/SalesMarketingRoot.tsx`
- `app/apps/mobile/src/components/JobDetailsForm.tsx` — verified only, no edit needed

## Verification

End-to-end browser verification performed against the running dev server (localhost:8081,
Carlsbad org):
- Spawned test jobs via the button; confirmed via screenshot that 3 Carlsbad jobs were created
  with the correct address, customer name, and phone, and no assigned tech.
- Deleted a single test job via its row Delete button; confirmed removal.
- Used "Delete All"; confirmed via page-text extraction that zero test-job rows remained and the
  test-jobs panel disappeared (panel only renders when `testJobsError || testJobs.length > 0`).
- Confirmed normal (non-beta) jobs have no delete affordance and are unaffected.

## Forward contracts

none — this closeout stands on its own; no promises made to a later session.

## Deviations / Defects

- Rule 43 (test-plan gate): Jeff explicitly declined a test plan for this closeout ("no test plan.
  go") — no Nestor-rendered HTML test plan was produced. Verification was end-to-end browser-based
  as described above instead.
- Rule 29-B note: an open, non-functional measurement-provenance discrepancy exists elsewhere in
  this session's tooling (a subagent self-reported "247 lines" for `SalesMarketingRoot.tsx` against
  an actual on-disk count of 265-266 lines via `(Get-Content <path>).Count`); flagged here for
  visibility, not a defect in the shipped feature itself.
- Untracked build-artifact files exist in the working tree under
  `app/modules/field-tech/src/**/*.js, *.d.ts, *.d.ts.map` (pre-existing, unrelated to this
  change) — left for the git-audit pass to classify (likely Bucket 2 / gitignore-candidate), not
  committed as part of this change.

## Test plan

None — Jeff explicitly declined a test plan for this closeout.
