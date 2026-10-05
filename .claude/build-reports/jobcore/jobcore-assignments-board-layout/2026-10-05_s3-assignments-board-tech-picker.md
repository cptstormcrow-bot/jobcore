---BUILD REPORT---
Project: jobcore
Date: 2026-10-05
Tier: A
Branch: jobcore-role-landing-0.1.3
Commit: 5ac1943 (feat(ui): assignments board picker reflects assigned techs, tighter cards); 4 files, +172/-23
Plan: E:\Jeff\.claude\plans\jobcore-030-test-fixes-v040-8-sessions.md (slice S3)
Summary: v0.4.0 slice S3 - Assignments board: Service/Prem buttons reflect assigned techs, Real button hidden by default, tighter buttons, job description upper right (test items 5.1 and 5.3).
Test plan: deferred to the v0.4.0 closeout (Rule 43)
Forward contracts:
- Test plan item 5.3 must quote the real job text "Drywall patch and paint touch-up" (not "nothing") so Jeff can find the card.
- When the test-jobs preference (showTestJobs) is on, the Real/Beta/Test/All row still shows and still has "Real"; this slice only hides the row when the preference is off. Unchanged by design; flag in the test plan.

## Goal
Jeff's 0.3.0 test results (crib w4-test-results-0.3.0.md): 5.1 asked for Service/Prem buttons that reflect what is assigned (clicking Service shows the assigned service tech in the picker, Prem shows the assigned prem tech, and Jeff can toggle between them to reassign even when they are different techs), no "Real" button at the top, closer text margins, and shorter buttons. 5.3 asked for the summarized job description at the upper right of the card, black normal text, filling existing whitespace without adding any.

## What changed vs the request
| Request | Change | Where |
|---------|--------|-------|
| 5.1 buttons reflect assigned techs | Active kind defaults to Prem only when no Service tech and a Prem tech exist, else Service; picker value is the pending pick, else the active kind's assignee; confirm button shows only when a pick differs from that assignee | assignment-board-helpers.ts (defaultKind, pickerValue, needsConfirm); AssignmentBoardScreen.tsx |
| 5.1 toggle to reassign | Service and Prem presses clear any pending pick, then switch kind; row confirm reads the same derived kind, so Service and Prem reassign independently | AssignmentBoardScreen.tsx (handleRowConfirm, button handlers) |
| 5.1 picker options | "Unassigned" is prepended except for Prem with a current assignee (Prem cannot be unassigned from the picker) | techOptionsFor(kind, techs, currentId) |
| 5.1 Real hidden by default | Real/Beta/Test/All row renders only when showTestJobs is true | AssignmentBoardScreen.tsx |
| 5.1 tighter padding | actionButton paddingHorizontal spacing.xs (was spacing.sm) | styles.actionButton |
| 5.1 shorter buttons | actionButton paddingVertical 0, minHeight 32 (board-only override of the 2026-08-30 44px standard, commented); kindSlot minWidth 56 (was 72); confirmSlot minWidth 64 (was 72); picker compact, assignSelect basis/min 120 (was 160) | styles |
| 5.3 description upper right | New rowTop row: customer left (flexShrink 1), description right; colors.text, regular weight, small size, right-aligned, numberOfLines 2, maxWidth 55%; shown only when non-empty; no added vertical block | AssignmentBoardScreen.tsx, styles.rowTop/rowDescription |

Files (from `git show 5ac1943 --stat`): app/modules/admin-finance/src/screens/AssignmentBoardScreen.tsx (66 lines), new assignment-board-helpers.ts (72), new __assertions__/assignment-board-helpers.assert.ts (55), app/package.json (test script, 1 line).

## Verification
Run from app/ this slice (results as handed over by the main session; not re-run by the report writer):
- `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` : exit 0
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` : exit 0
- `npm test` : 225/225 pass (includes the new 4 helper tests: defaultKind, pickerValue, needsConfirm, techOptionsFor)
- Read on disk by the report writer: `git show 5ac1943` diff and assertion file confirm the helper cases above.
- Not browser-checked by design (Jeff's standing rule: trust the test plan; dev server 8081 untouched).

## Rule 41 pre-write gate (jobcore lineage)
Scanned `.claude\build-reports\jobcore\*.md` Forward contracts for Assignments board / picker / title bar relevance.
- 2026-10-01_field-tech-gear-and-r3-assignments-overview.md FC3 (module-session injection fallback UX): unrelated to the board layout; remains CARRIED, needs Jeff input, not touched here.
- 2026-10-01_test-employees-retest-fixes.md (revert of 8042668 regresses Tech: label/unassign; re-judge create() delete-then-insert when 0072 lands): this slice does not touch create() or the unassign wiring; Prem picker semantics rely on it unchanged. Honored (not disturbed); still CARRIED.
- 2026-09-04_job-detail-screen-restyle.md FC-A3 (legacy installer-kind investigator rows, DEV only): unrelated; CARRIED.
- Title-bar and picker contracts: S1/S2 (packages/ui, TechSelect) own those; this slice consumes TechSelect with `compact` only. None needing Jeff input from this slice.

## Deviations / Defects
- Docs not in the S3 commit: the plan lists `docs/jobcore-basics-admin-finance.html` and `fragments/03-ch3.html` as S3 docs (Rule 31), but commit 5ac1943 touches no docs. Doc update owed in this slice's follow-up or the v0.4.0 doc sweep.
- Plan said `techOptionsFor(kind, techs)`; implemented with a third `currentId` argument to support the Prem no-Unassigned rule.
- Plan exit step (walk 5.1-5.4 on 8081) replaced by the no-browser-check standing rule; verification is tsc plus unit tests only.
- Not part of S3, not staged: docs/snapshots/v0.3.0/*, .claude/build-reports/INDEX.md, the apk-0-3-0 report, .claude/state/.
- No defects found in the change's own output on the diff read.
