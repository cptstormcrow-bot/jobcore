---BUILD REPORT---
# Build report: Service Tech picker tap note

Date: 2026-10-21
Project: jobcore (Jobcore repo, branch jobcore-role-landing-0.1.3)
Commit: 528cb51 "feat(jobs): explain the locked Service Tech picker with a tap note" (not pushed)
Tier: non-Tier-A closeout (two files, no forward contracts). Tier was not defined by the protocol text read, so this report carries every Tier-A field anyway.

## Method / Tools
- Plan: E:\Jeff\.claude\plans\snuggly-cuddling-church.md (Plan-slug: service-tech-blocked-note), approved by Jeff.
- Edits: Spot applied 6 anchored edits to JobHeader.tsx (reported CONFIRMED 6/6); the 1-line copy change was made in service-tech-gate.ts.
- Verification: Karen (task_id karen-service-tech-blocked-note-20261021) returned CONFIRMED on `tsc -b --force` over packages and modules, `tsc -p apps/mobile --noEmit`, and `npm test`. This proves compilation and the existing gate assertions only, not on-screen behavior.
- Size: `git diff --numstat` gave 37/20 for JobHeader.tsx and 1/1 for service-tech-gate.ts; the commit stat reads 2 files changed, 38 insertions(+), 21 deletions(-). Rule 38 Gate 1 did not fire.

## What changed
- app/modules/admin-finance/src/domain/service-tech-gate.ts L9: SERVICE_TECH_GATE_HINT is now "Cannot assign Service Tech until materials arrive onsite." (Jeff's quote, leading space trimmed). The predicate canAssignServiceTech is untouched.
- app/apps/mobile/src/components/JobHeader.tsx: TechRow takes a blockedMessage prop. While the gate is closed, no tech is assigned and the row is not busy, a Pressable overlay (absoluteFill) over the disabled picker opens a note under the row. Picking a different tech while one is assigned and the gate is closed also shows the note. Picking "Unassigned" never does. The note clears when the gate opens. Only the Service row passes blockedMessage, so Prem Tech is unchanged.
- The gate logic and its four enforcement layers are unchanged.

## Rule 31 doc sweep
Command: PowerShell Get-ChildItem -Recurse over *.md, *.ts, *.tsx, *.html, *.json (excluding node_modules, dist, .git, .expo) piped to Select-String 'Mark Materials Onsite on the estimate first'. Result: zero matches. Not covered: the manual's .generated.md sibling and other file extensions or roots.

## Forward contracts:
none

## Deviations / Defects
- Deviation: no Plan or Explore agents were used (declared in the plan; Jeff approved it anyway).
- Defects: none found in the change's own output. Behavior on screen is unverified (see below).

## Test plan
none requested (Jeff declined at the Rule 43 gate, 2026-10-21). Caveat: this is a non-Tier-A closeout and the change may be simple enough to verify without a plan.

## Unverified (covered by Jeff's manual check)
- Whether the picker is admin-only in the job-details layout (verified for the Estimate layout only).
- Whether ticking Materials Onsite reaches the screen right away (live unlock and note clearing).
- Overlay tap behavior on web at 8081.
- Whether the estimate region has room for the extra line.
- Job #5's own Materials Onsite flag.

## Manual check (Jeff)
As an admin, open a job with Materials Onsite unticked and tap the grayed Service Tech picker. The note appears under the row, in both the details area and the Estimate #0057 tech area. Ticking Materials Onsite unlocks the picker and clears the note. If the picker stays grayed after the tick, reopen the job and report whether it unlocked only after reopening.

## Out of scope / left as is
- The walkthrough text at walkthrough-content.ts:84 and :111 names Service Tech without the Materials Onsite prerequisite.
- Other Service Tech entry points; Job #5's data.
- Another session's uncommitted files stay unstaged.
---END BUILD REPORT---
