---BUILD REPORT---

# Build Report — JobCore — test employees retest fixes (FAIL 5.1/5.2 + scope adds)

**Project:** jobcore
**Date:** 2026-10-01
**Status:** Closed by Jeff without retest results ("just mark it done. If I have more things I will do a separate effort"). The 7 retest items were NOT verified by Jeff. No PASS is claimed.
**Plan:** `E:\Jeff\.claude\plans\jobcore-test-employees-retest-fixes-fail-5152-5-scope-adds.md` (status COMPLETE)
**Branch:** jobcore-job-detail-action-buttons
**Tier:** A

## Summary

Goal: fix retest items 5.1, 5.2, 4.1, 4.2, 1.2, 2.3, 3.3.
Out of scope: migrations, live data writes, git push, the other session's features.

## Changes

- **5.1** Duplicate-key error on `job_assignments_one_investigator_per_job`: a partial unique index on (job_id) WHERE kind='investigator' cannot be an upsert target. `create()` now does read prior tech -> delete -> insert, with best-effort restore of the prior tech on insert failure; this keeps the BEFORE INSERT blackout trigger `deny_job_assignment_on_time_off` effective. New port method `removeInvestigator(jobId)`. Files: `ports.ts`, `admin-finance-repos.ts`. Commit d940ea3.
- **4.2 / 5.1 UI:** JobHeader toggle header removed; tech Select always visible under Progress. File `app/apps/mobile/src/components/JobHeader.tsx`. Commit d940ea3.
- **4.1 label:** Jeff changed the wording to "Tech:" (supersedes "Assigned to:"). Present at HEAD via the other session's commit 8042668.
- **5.2 Unassigned option:** `handleUnassign` calls `removeInvestigator` (`app/apps/mobile/app/job/[jobId].tsx` L708 at HEAD) and `onUnassign` is passed unconditionally (L1189 at HEAD) — landed via the other session's commit 8042668.
- **1.2:** EmployeeRosterScreen hides role 'owner'.
- **2.3:** EmployeeDetailScreen "Service Areas" card (`serviceAreas` prop, fed sorted names from `AdminFinanceRoot.tsx`).
- **3.3:** top actions row Back / Edit / Deactivate-Reactivate, size sm.
- 1.2 / 2.3 / 3.3: commit b8698b7 (amended to include `AdminFinanceRoot.tsx`).

## Commits

- 3eb21bc — seed task: test employees roster visibility + service areas + skills
- d940ea3
- b8698b7
- Admin repo `E:\Jeff`: 016f741 (plan + memories)
- Dependency: the other session's 8042668 carries "Tech:" and the `[jobId].tsx` unassign wiring.
- No push.

## Verification

Type-check: 3 passes, 0 errors (from `app/`):
1. `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing`
2. `npx tsc -p modules/admin-finance/tsconfig.json --noEmit`
3. `npx tsc -p apps/mobile/tsconfig.json --noEmit`

HEAD grep: `git show "HEAD:app/apps/mobile/app/job/[jobId].tsx" | Select-String "removeInvestigator|onUnassign"` -> L621, L685, L708, L1189.

## Test plan

Delivered `E:\Jeff\Desktop\20260930_jobcore-test-employees-retest_testplan.html` (passed check-test-plan.ps1). Results not received; effort closed by Jeff.

## Forward contracts

1. The "Tech:" label (`JobHeader.tsx`) and the `[jobId].tsx` unassign wiring (L708, L1189) live in the other session's commit 8042668, not this effort's commits; reverting 8042668 regresses 4.1 and 5.2.
2. The other session's migration `0072_job_assignments_allow_many_investigators.sql` may relax the one-investigator index; the delete-then-insert in `create()` stays correct but should be re-judged when 0072 lands (not owned here).

## Rule 41 — prior contracts

Lineage: test employees; prior report `2026-08-27_employee-detail-screen-ux-fixes.md` — no open contracts in this lineage.

Carried, not in this lineage, not addressed:
- `2026-08-30_job-detail-action-buttons.md:97` — PunchList wiring
- `2026-08-30_job-detail-action-buttons.md:99` — Completion/StartChecklist null field-tech session fallback
- `2026-09-02_service-area-error-fix.md:79` — (tabs)/jobs.tsx service_area_id/toJob() gap
- `2026-09-04_job-detail-screen-restyle.md:145` — FC-A3 investigator rows not backfilled
- `2026-09-04_job-detail-screen-restyle.md:82` — FC1 EAS dev build + on-device checklist
- `2026-09-17_git-hygiene-bucket1-closeout.md:72` — Bucket 3 admin-finance-repos.ts
- `2026-09-20_jobcore-redlines-stabilize.md:25` — redundant serviceTasks cast in AdminFinanceRoot.tsx L955-981
- `2026-09-25_job-detail-save-customer-edits-fix.md:28` — FC6 patchLifecycle 'key' in patch
- `2026-09-27_jobcore-c2-fk-m1-address-orphan-cleanup.md:52` — F-new-1 Address visual check
- `2026-09-27_jobcore-c2-fk-m1-address-orphan-cleanup.md:53` — F-new-2 reseed may recreate customer ...0206

## Deviations / Defects

- Workflow launched before its 4-line preflight.
- Test plan named "John Doe" instead of "Dev Tech" (fixed).
- Workflow JSON read at the wrong level.
- Obeyed a file restriction Jeff disowned.
- Browser self-check run then dropped (Jeff: trust the test plan).
- Dev-server shutdown promised then cancelled (Jeff: never stop 8081).
- Status line repeatedly not printed first.
- cmd.exe split SQL and mangled % (fixed via single-line SQL + strpos).
- Seed keyed on ids instead of is_test (fixed).
- Hound outputs returned empty.
- Dev server died and was restarted.
- Commit B missed `AdminFinanceRoot.tsx` (fixed by amend).
- D1 crib was short.
- Memories written before closeout.
- "Never stop 8081" put in the port memory instead of a feedback file.
- MEMORY.md over budget 41 lines/4139 B (fixed to 40/3972).
- Plan-status Edit failed twice with "File has not been read yet" (Rule 22-B breaker, fixed by Spot).
- "git add --dry-run skips feedback files" misdiagnosed (files were untracked, not ignored).
- ~41 compactions during closeout.
- Closed without retest results.

## Not mine, left untouched

- `app/supabase/migrations/0072_job_assignments_allow_many_investigators.sql`
- `.claude/build-reports/jobcore/2026-10-01_field-tech-gear-and-r3-assignments-overview.md`
- `app/package-lock.json`

## Delivery

Report copied to `E:\Jeff\Desktop\Build-Reports\` per Rule 8.

---BUILD REPORT---
