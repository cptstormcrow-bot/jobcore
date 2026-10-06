---BUILD REPORT---
GOAL: Move the Job Details 15-stage progress bar out of the job header into the job screen, extract it
as a reusable UI component, add an in-progress (yellow) stage state, light the Prem-available stage
green when appropriate, and compact padding across the affected components.

RoA: jobcore / BUILD
Plan: job-stage-bar-compact-inprogress | Date: 2026-10-06 | Status: COMPLETE
Why: The stage bar lived inside JobHeader and wasted vertical space; it could not show a stage that was
started but not finished, and the Prem-available stage did not reflect an assigned investigator.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-10-06_job-stage-bar-compact-inprogress.md

Summary:
- The 15-stage progress bar moved from JobHeader.tsx into apps/mobile/app/job/[jobId].tsx (rendered at
  ~:1354, import ~:11).
- JobProgressBar extracted to packages/ui/src/JobProgressBar.tsx and exported from
  packages/ui/src/index.ts:19.
- Core StageInput gains an optional inProgress flag (packages/core/src/jobStages.ts:37, applied :67 ->
  yellow when incomplete + inProgress).
- premAvailable stage is set green when job.needsPremAt or an investigator is assigned
  ([jobId].tsx:~960).
- Padding compacted on JobDetailsForm, JobProgressBar and JobHeader.
- Duplicate "Next Steps:" prefix fixed in JobProgressBar.

Files:
- Modified: apps/mobile/app/job/[jobId].tsx, apps/mobile/src/components/JobDetailsForm.tsx,
  apps/mobile/src/components/JobHeader.tsx, packages/core/src/__assertions__/jobStages.assert.ts,
  packages/core/src/jobStages.ts, packages/ui/src/index.ts (159 insertions / 23 deletions).
- New: packages/ui/src/JobProgressBar.tsx.

Evidence:
- `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` — exit 0.
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` — exit 0.
- `npm test` — 234 of 234 pass.

Test plan: declined by Jeff ("no test plan"); Rule 43 gate answered.

Forward contracts:
- FC-1 NEXT SLICE (Jeff-approved plan, fresh session): Prem -> Estimate tappable stages. Plan file
  E:\Jeff\.claude\plans\tappable-stages-prem-form-estimate-reuse-existing-screens.md steps 1-5
  (JobProgressBar onStagePress; [jobId].tsx wiring; JobInvestigationScreen * required + Submit
  validation; JobEstimateEditor * required + read-only prem answers; admin "Claimed by <tech>" line).
  No migration (0077 out of scope). Proposed required fields to be confirmed by Jeff.
- Carried unverified from prior reports (Rule 41: none resolvable without input in this change):
  - JD-08 (2026-09-20 report:18).
  - service_task_id not threaded into calculateCommission (commission.ts:103).
  - task_id not threaded into edge function; deploy needs approval.
  - Migration 0032/0049 ordering + stale "0022" header.
  - 2026-09-04 job-detail-restyle: FC1 eas dev build + on-device checklist; FC2 TimeOff.tsx refactor
    before repo-wide typecheck; FC-A1 Jeff re-run of failed test items.
  - Remaining reports not re-read this change: 2026-08-25 sales-marketing-ports-fix:20, 2026-09-02
    job-investigation-estimate-approval:53, 2026-09-04 leads-screen:60, 2026-09-04 field-tech-timeoff:70/106/125.

## Deviations / Defects
none. (Rule 8 Desktop copy skipped per JobCore decision; delivered by committed path.)
