---BUILD REPORT---

## Method / Tools
Tier-A. Date 2026-10-20. Branch jobcore-role-landing-0.1.3. Committed locally, NOT pushed (memory feedback-no-git-push). Code edits by the main session before this report; verification by Karen (verify-hound agentId a2078c3184eae752e, gate name karen-width-gate): tsc -p packages/ui, tsc -p packages/payroll-ui, tsc -p modules/admin-finance, each exit 0 with 0 `error TS` lines; npm test exit 0, 389 pass / 0 fail / 0 skip. A grep sweep of 18 PayrollButton caller files found no style override that widens the button. Follow-on to the report 2026-10-20_payroll-button-retrofit-and-ui-inventory-regen.md, whose Deviations line "Payout Batches Approve renders full-width (459px)" this change closes.

## Request (Jeff)
"The Payout Batches 'Approve' button renders 459px wide, and I haven't confirmed that's intended." and "I want buttons all to be standardized width (not all the way across the screen) Use only the width that the label fits." Interpreted as: every PayrollButton is exactly its label width plus 14px padding each side and never stretches across a row or column.

## Changes (files)
- app/packages/ui/src/PayrollButton.tsx (+2): added `alignSelf: 'flex-start'` (with a one-line comment) to the base `button` style. Cause of the 459px: a column parent defaults to alignItems stretch and the Pressable had no alignSelf. The `style` prop still merges last.
- app/modules/admin-finance/src/screens/EmployeeDetailScreen.tsx (-1): removed `flex: 1` from the `actionInline` style so the wrapper cannot widen the button.
- app/docs/ui-conventions.md (+1, Rule 31): new bullet "Button width (Jeff 2026-10-20)": a PayrollButton is exactly label width plus 14px padding each side; callers must not pass width, minWidth, flex, flexGrow or alignSelf 'stretch' in `style`.
- SOP memory feedback-jobcore-payroll-button-style-sop.md (in E:\Jeff, own commit there): "Width rule" and its origin line added. MEMORY.md unchanged.
- Callers reviewed, no change needed: PayoutBatchScreen.tsx (Approve and Mark Paid, no style prop; fixed by the component change); PayoutBatchDetailScreen.tsx (Back button, marginBottom only); AssignmentBoardScreen.tsx lines 466-486 (slots confirmSlot/rowActions/kindSlot are column Views, so the button's own alignSelf keeps label width; code-read judgment, not browser-verified).

## Verification
See Method / Tools for the Karen gate. Rendered width was NOT browser-verified (standing rule: no self browser-check). Expected result for the Payout Batches Approve button is label width plus 28px (previously 459x32).

## Forward contracts:
1. PayrollButton is the standing button; about 50 files still use the legacy Button (app/docs/ui-conventions.md:27), so never write "all buttons" as done.
2. UI Inventory extract.mjs under-counts PayrollButton labels (af-employee-roster buttonLabels is []).
3. Three paginate overflow screens remain open: ft-Payroll, sm-Payroll, layout.
4. Callers must not widen a PayrollButton via style (ui-conventions.md rule above); a future screen that needs a full-width action must get a documented exception from Jeff first.

## Deviations / Defects
- Rendered button widths are not browser-verified; Jeff's own visual pass is not done.
- AssignmentBoardScreen no-change verdict is a code-read judgment only.
- React setState-in-render warning (AdminFinanceRoot / ModuleScreen) from the earlier report is still NOT verified as pre-existing.
- Foreign stash stash@{0} left untouched.
- Earlier commits df61726 and cf4bd7d were committed by another actor with the same git identity.
- Many working-tree files are uncommitted and NOT from this task (calendar.tsx, JobPaymentRegion.tsx, approve-estimate.ts, snapshots under docs/snapshots/v0.4.0, CalendarTimeOffSection.tsx, migration 0093 and its tests); they are left unstaged.
- The prior 459px Deviations line in the retrofit report is not edited (reports are immutable); this report supersedes it.

## Commits
One local commit on jobcore-role-landing-0.1.3 with a scoped pathspec: PayrollButton.tsx, EmployeeDetailScreen.tsx, ui-conventions.md and this report. A separate commit in E:\Jeff for the SOP memory file. Nothing pushed.

## Test plan:
Test plan: declined by Jeff (Rule 43).

## Summary
Every PayrollButton now sizes to its label: the base style gets alignSelf flex-start, which fixes the 459px Payout Batches Approve button and every other stretching caller. One wrapper flex was removed in EmployeeDetailScreen, and the rule is recorded in ui-conventions.md and the SOP memory. Karen passed tsc on three packages and 389/389 tests; rendered widths are not browser-verified and Jeff declined a test plan.
---END BUILD REPORT---
