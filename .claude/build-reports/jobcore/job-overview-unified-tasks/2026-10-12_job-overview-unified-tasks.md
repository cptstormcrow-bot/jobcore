---BUILD REPORT---
GOAL: Job Overview (#0081) + Unified Job Tasks + Customer Projects: one task store for every job, an Overview screen replacing in-job Planning, and customer project history.

RoA: jobcore / BUILD
Plan: noble-kindling-river (E:\Jeff\.claude\plans\noble-kindling-river.md), "Job Overview (#0081) + Unified Job Tasks + Customer Projects" | Date: 2026-10-12 | Status: COMPLETE
Why: Jeff's approved plan; 11 slices, all built and verified.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\job-overview-unified-tasks\2026-10-12_job-overview-unified-tasks.md

Summary:
- One commit on branch jobcore-role-landing-0.1.3: ee92930 "feat(job): Job Overview #0081, unified job tasks, customer projects" (22 files, +1457/-169). NOT pushed.
- job_plan_tasks is now the single task store (kinds price_sheet and misc/hourly). New columns jobs.name and parent_job_id. A one-open-job-per-customer trigger raises customer_has_open_job. New RPC spawn_customer_job. New views customer_project_history_v and job_task_summary_v. Idempotent backfill.
- The shared JobTaskList is used on Overview, Prem #0061, estimate #0057 and field detail. #0081 Overview replaces in-job Planning #0041, and the Job stage opens it. Compact TextField (dense) and JobDetailsForm. S&M callbacks show next-project ideas.
- Verification: tsc clean apart from 2 errors belonging to other sessions (payroll-repos rootDir; core rates.assert.ts(61,14)). npm test: 162/162. Migration 0086 pushed live to Supabase with Jeff's go; remote is now 0076-0079 plus 0086. (Figures as supplied by the dispatching session; this report-writer did not re-run them.)

Files:
New:
  app/apps/mobile/src/components/JobOverviewRegion.tsx
  app/apps/mobile/src/components/JobTaskList.tsx
  app/supabase/migrations/0086_unified_job_tasks.sql
Modified: the remaining files of the 22 in commit ee92930 (see `git show --stat ee92930`).

Test plan: delivered to E:\Jeff\Desktop\jobcore-job-overview-test-plan.html (7 tests). Results pending from Jeff.

Prior-contract check (Rule 41, 2026-10-12): the two newest reports' open contracts were reviewed (time-off-tech-calendar and blackout-calendar-scheduler; the latter points at 2026-10-11_apk-0-4-0-build.md for the rest). Contracts honored: techNameById stays optional and #0056 untouched; the DateRangeCalendar shim is untouched (this change does not touch field-tech/TimeOff.tsx #0031); the shared BLACKOUT_WEEK_VIEW_KEY is unaffected. Carried open and not resolvable by this change: 0.4.0 release step, estimate role gating FC-2, service_task_id in commission FC-3, payout-batch parameter mismatch. input-needed: none.

Forward contracts:
- Jeff's test-plan results feed the next build.
- Payroll-session migrations 0080-0085 are still local and unpushed. They are owned by that session; pushing them needs Jeff's go.
- PlanningScreen.tsx still uses the legacy addTask(jobId, serviceTaskId, qty) signature and the name alias, kept for compatibility.
- job_planning_details can no longer be edited in-job; it stays reachable from A&F Planning only.

## Deviations / Defects
- Migration renumbered 0084 to 0086 to avoid a clash with the payroll session (Jeff approved).
- Only 0086 was pushed; payroll 0080-0085 were deliberately left unpushed.
- The test plan has 7 tests, one over the SOP's 6-test warning.
- The first commit hound died ("Autocompact is thrashing") from oversized diff output. The commit was redone in small one-line-return steps from the main session.
- Three test-plan labels were not source-verified: "Callbacks", "field tech job detail", and the Reset confirm text.
- Files shared with other sessions were staged hunk-by-hunk with git apply --cached --recount. read-cache-patches.ts and offline-ops/register.ts were left unstaged because they hold only other sessions' changes.
- DEFERRED: none.
---END BUILD REPORT---
