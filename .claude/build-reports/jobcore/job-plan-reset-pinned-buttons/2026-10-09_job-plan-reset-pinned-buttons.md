---BUILD REPORT---
GOAL: Make the job Reset clear the whole timeline (Prem checklist, stage marks, contacted time) and pin the Cancel / Reset / Save buttons on the Job Plan screen.

RoA: jobcore / BUILD
Plan: job-plan-reset-pinned-buttons (Task B) | Date: 2026-10-09 | Status: COMPLETE (commit pending)
Why: Reset left Prem checklist, stage marks and contacted time behind, and the footer buttons showed on the Details panel instead of the Job Plan.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\job-plan-reset-pinned-buttons\2026-10-09_job-plan-reset-pinned-buttons.md

Summary:
- [jobId].tsx: the pinned footer (Cancel, admin Reset, Save) now renders when region === 'plan' instead of 'details'. Landing region changed: an unknown or missing deep-link panel, the fallthrough case and the stage-bar "job" tap now go to 'plan'; an explicit panel=details still goes to 'details'.
- [jobId].tsx handleResetTime: calls the repository's resetTimeline when present, else falls back to clearInvestigator; then sets status to new, clears needsPremAt on the local job, and clears local investigation, stage marks and contactedAt state.
- [jobId].tsx confirmResetTime: confirmation text rewritten to say the timeline resets to New and now also lists Prem checklist, stage marks and contacted time as cleared.
- admin-finance-repos.ts: new resetTimeline(jobId) on the job repository: nulls needs_prem_at and contacted_at and empties stage_marks on the job, deletes its job_investigations rows, deletes its investigator job_assignments; throws "resetTimeline failed: ..." on any step error.
- ports.ts: JobRepository gains optional resetTimeline?(jobId) with a doc comment.

Files changed (git diff --stat, 3 files, 31 insertions, 8 deletions):
- app/apps/mobile/app/job/[jobId].tsx: 21 lines changed
- app/apps/mobile/src/lib/admin-finance-repos.ts: +16
- app/modules/admin-finance/src/data/ports.ts: +2
- New files: none.

Evidence:
- Diff and per-file line deltas verified on disk this session with git diff and git diff --stat over exactly these 3 files.
- NOT done: no browser self-check (Jeff's standing instruction; the test plan covers it).
- Commit: pending (Task B scoped commit, 3 files, no push).

Test plan: deferred to the 0.4.0 uber-test-plan at Jeff's instruction (2026-10-09); test items retained in memory jobcore-0-4-0-uber-test-plan-items

Forward contracts: none (resetTimeline is optional on the port and the screen falls back to clearInvestigator, so no later step is obliged to implement it)

## Deviations / Defects
- Scope beyond the title: the default landing region moved from Details to Plan (deep-link fallback, stage-bar "job" tap); shown in the diff.
- resetTimeline runs three separate calls (job update, investigation delete, assignment delete) with no transaction; a mid-way failure leaves a partial reset and throws.
- The fallback path (no resetTimeline) does not clear the Prem checklist, stage marks or contacted time in the database, though local state is cleared.
- Type-check was not run in this report's session; runtime behavior is unverified.
