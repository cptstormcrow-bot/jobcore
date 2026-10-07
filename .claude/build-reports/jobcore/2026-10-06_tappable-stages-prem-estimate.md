---BUILD REPORT---
GOAL: Make the Prem and Estimate stages on the Job Details stage bar tappable, open the existing Prem form
and Estimate editor from them, and require key fields before each form can be submitted.

RoA: jobcore / BUILD
Plan: tappable-stages-prem-form-estimate-reuse-existing-screens | Date: 2026-10-06 | Status: COMPLETE
Why: The stage bar was display-only; techs had to hunt for the Prem form and Estimate editor, and both
could be submitted with empty fields. The estimate also gave no view of what the tech wrote on the Prem form.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-10-06_tappable-stages-prem-estimate.md

Summary:
- Commit 51b50be on branch jobcore-role-landing-0.1.3. 4 files, +77/-21. No migration, no new screens, no push.
- JobProgressBar gains an optional onStagePress; a stage is Pressable only when the handler is set and the
  stage state is green or yellow.
- Job screen: completePrem opens the estimate only when investigation.submittedAt is set, otherwise the Prem (evisit) checklist (yellow tap fixed in commit 8e8c0b5; checklist later rearranged with every field required and estimate schedule pickers added in 552bc0e); an admin-only
  "Claimed by <tech>" line shows on the evisit region; the investigation is passed to JobEstimateEditor.
- Prem form: four labels end " *"; Submit is blocked unless ingressNotes, logisticsNotes, parkingNotes and
  stateAssessment are all non-empty (error "Please complete all fields marked *."). Save Draft unchanged.
- Estimate editor: new investigation prop; read-only "Prem form (for reference when estimating)" section;
  section titles "Materials planning *", "Completion schedule *", "Payment outlay *"; Submit blocked unless
  at least one line item, scheduledStart, scheduledEnd and totalCost > 0.

Files:
- Modified: app/packages/ui/src/JobProgressBar.tsx, app/apps/mobile/app/job/[jobId].tsx,
  app/modules/field-tech/src/screens/JobInvestigationScreen.tsx,
  app/modules/field-tech/src/screens/JobEstimateEditor.tsx (77 insertions / 21 deletions).
- New: none.

Evidence:
- `npx tsc -b --force` of the packages — exit 0.
- `npx tsc -p apps/mobile` — exit 0.
- `npm test` — 234 of 234 pass.
- NOT done: runtime/UI check on a device or the dev server (8081). Still not exercised on the dev server (8081) as of 552bc0e; verification = tsc clean + npm test 234/234 only.

Test plan: declined by Jeff (Rule 43, 2026-10-06).

Forward contracts:
- FC-1: The required-field sets are PROPOSED and unconfirmed (prem: all 4 free-text fields; estimate: one line
  item, schedule start and end, total > 0). Jeff to correct.
- FC-2: Runtime/UI tap-flow check still owed, now including the fixed yellow Complete Prem tap (opens the Prem checklist,
  region 'evisit'): empty-submit errors, Complete Prem going green, green tap opening the estimate showing the prem
  answers, incomplete-estimate Submit blocked, claimed-job behaviour, and the admin "Claimed by" text style against its
  neighbours (all unchecked). Also: schedule pickers for scheduledStart/scheduledEnd now exist (added in 552bc0e); confirm at
  runtime that the estimate can be submitted under the proposed required fields.
- FC-3 (Rule 41, prior lineage): JD-08 needs Jeff (2026-09-20_jobcore-redlines-stabilize.md:3); restyle FC1
  device checklist needs Jeff (2026-09-04_job-detail-screen-restyle.md:136); restyle FC2 TimeOff.tsx resolved
  in practice (commit ec46136); the previous report's FC-1 is honored by this change.

## Deviations / Defects
One defect found AFTER commit 51b50be, fixed and committed as 8e8c0b5: in
app/apps/mobile/app/job/[jobId].tsx handleStagePress, the completePrem case read
`if (investigation?.submittedAt) selectRegion('estimate');` with no else, so tapping a yellow Complete Prem did nothing
and the Prem checklist never opened. Fixed with `selectRegion(investigation?.submittedAt ? 'estimate' : 'evisit');`.
Root cause: the earlier delivery was verified by type-check and unit tests only, no runtime check. Type-check clean,
234/234 tests pass after the fix; runtime check still owed (FC-2).
Earlier in-flight defect: a stray whitespace change in JobEstimateEditor.tsx ("?<Text") was restored before commit.
Git's CRLF warning on JobProgressBar.tsx (LF->CRLF) is cosmetic.
Also recorded: memory note jobcore-prem-checklist-evisit-already-built (region 'evisit' IS the Prem checklist, already built) so these features are not rebuilt.
(Rule 8 Desktop copy skipped per JobCore decision; delivered by committed path.)
