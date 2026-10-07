---BUILD REPORT---
GOAL: Polish the job header and the Prem checklist screen: drop the paid hint, relabel the claim line, and tighten the checklist layout.

RoA: jobcore / BUILD
Plan: prem-header-fields-polish | Date: 2026-10-06 | Status: COMPLETE
Why: The header carried a hint nobody needed, the claim label was unclear, and the Prem checklist wasted whitespace with labels and inputs stacked.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-10-06_prem-header-fields-polish.md

Summary:
- JobHeader.tsx: removed the "Complete the job before marking it paid" hint (paidHint render and its consts).
- [jobId].tsx (~L1411): label "Claimed by" changed to "Prem Claimed by: xx", indented (paddingLeft 16). The two alert strings containing "Complete the job before marking it paid." (~L1129, ~L1210) were deliberately left alone: they are alert messages, not the header hint.
- JobInvestigationScreen.tsx: header row is now left-justified small "Date created", centered "Not yet submitted"/"Submitted...", right-justified "Job #". Action buttons moved up to reclaim whitespace. New local FieldRow component puts label and input on one horizontal line for 8 fields (Room name, Work, Measurements, Ingress, Logistics, Parking, State assessment, Instructions for tech).

Files:
- Modified (under E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app): apps/mobile/src/components/JobHeader.tsx, apps/mobile/app/job/[jobId].tsx, modules/field-tech/src/screens/JobInvestigationScreen.tsx.
- New: none.

Evidence:
- Karen CONFIRMED npx tsc --noEmit clean and npm test 234/234 (task a8af3ada2c68240ca).
- NOT done: runtime appearance check (Jeff's trust-the-test-plan rule).

Test plan: declined by Jeff (Rule 43, 2026-10-06).

Forward contracts: none

## Deviations / Defects
- A dead paidHint style entry remains in JobHeader.tsx styles (~L236); harmless.
- Layout appearance is unverified at runtime.
- Section/cardActions margin values were not re-tuned.
