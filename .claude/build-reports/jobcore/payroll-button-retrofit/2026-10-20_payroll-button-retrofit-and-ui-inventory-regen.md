---BUILD REPORT---

## Method / Tools
Tier-A. Date 2026-10-20. Branch jobcore-role-landing-0.1.3. Committed locally, NOT pushed (standing instruction, memory feedback-no-git-push). Verification: Karen (verify-hound) tsc + npm test gate; UI Inventory pipeline run; Payments tabs checked in the built-in browser on dev server http://localhost:8081. Supersedes the earlier report `.claude/build-reports/jobcore/payroll-button-sop/2026-10-20_payroll-button-sop.md` where they differ (that report is partly stale: it describes the Button-carries-the-look design and says nothing was committed).

## Request (Jeff)
Payroll-button SOP retrofit. The standard is PayrollButton (app/packages/ui/src/PayrollButton.tsx, exported from @jobcore/ui): height 32, paddingHorizontal 14, radius 6, label 14/18/700 #000 centred, sand fill, colors.sandInactive when disabled, hitSlop top 6 / bottom 6; props label, onPress, disabled?, accessibilityLabel?, testID?, style?; no selected/children/variants. Legacy Button is deprecated. SandButton deleted 2026-10-20 (sand.ts keeps only SAND_BG/SAND_TEXT).
Scope: Payments #0063 (Reimbursements and Payout Batches tabs only; the "Manually confirmed" card shows `Job #N`, never a raw UUID, each row drills into that job); Edit Lead #0062; Employee Roster #0045; Review #89 (af-review); then a UI Inventory v0.4.0 regeneration and verification.
Naming note (recorded, not rewritten): Registry #0010 = Admin & Finance root (AdminFinanceRoot.tsx); Payroll proper = #88, resolved by SCREEN_NUMBER_KEY (app/modules/admin-finance/src/AdminFinanceRoot.tsx:132). Jeff's wording "#0010 (Payroll)" is annotated, not changed.

## Changes (files)
- 821914b fix(ui): TimesheetApprovalPanel week buttons use PayrollButton (+3/-3). app/packages/payroll-ui/src/TimesheetApprovalPanel.tsx: dropped the `Button` import; "Previous week"/"Next week" are now `<PayrollButton label=... onPress=.../>`. Made by this task.
- df61726 docs(ui-inventory): regenerate v0.4.0 snapshot (HEAD). Touches 6 files under docs/snapshots/v0.4.0/: _tools/pagination.json, _tools/screens.json, ui-data.json, ui-inventory.html, ui-inventory.pdf (8,058,196 bytes, matches the regenerated PDF), ui-storyboard.html. It contains this task's pipeline output but was committed by another actor with the same git identity, not by this task.
- cf4bd7d feat(mobile): Prem Needed checkbox in the job header: FOREIGN to this task (touches app/apps/mobile/app/job/[jobId].tsx, JobHeader.tsx, JobOverviewRegion.tsx). It precedes df61726, so the snapshot is consistent with committed source.
- Lineage context (earlier commits on the branch, same SOP lineage, NOT this task's authorship): 459f9c5 (2026-10-19 20:34, feat(payroll): Payroll button style SOP (#0010) - PayrollButton, My Time cards, Hours tab bar, Pay Period picker), 10de642 (Payroll button style SOP applied app-wide), 2d1233f (retrofit remaining SandButton usages to PayrollButton), c41ed28 (apply Payroll button look app-wide via Button; SUPERSEDED design), 6864d5a (delete the two SandButton definitions), 9545e52 (StepperPicker standard picker, arrows left/right on #0088 Pay Period), fa8f374 (StepperPicker arrows beside the date).
- app/docs/ui-conventions.md (39 lines): no edit owed. Line 27 holds the retrofit status ("roughly 50 files still use the legacy Button", "never write 'all buttons' as done"), line 28 the SandButton deletion, lines 32-38 the StepperPicker convention.

## Verification
Karen gate (crib E:\Jeff\AppData\Local\Temp\claude\E--Jeff-Codespace-SDAssemblyPros-Jobcore\34a73137-c705-4be0-90eb-d39e1dea08f1\scratchpad\wave-cribs\2026-10-20_step5-karen-gate.md): all exit 0, 0 `error TS` lines.
- `tsc -b --force` (core, ui, module-sdk, admin-finance, field-tech, sales-marketing)
- `tsc -p modules/admin-finance --noEmit`
- `tsc -p packages/payroll-ui --noEmit`
- `tsc -p apps/mobile --noEmit`
- `npm test`: 389/389 pass, 0 fail, 0 skipped, 2997 ms.

UI Inventory pipeline (crib ...\wave-cribs\2026-10-20_step5-pipeline.md, which also holds the measurement commands per Rule 29-B): all 7 steps exit 0.
- generate.mjs: "86 screens, 268 edges, 47 redundant claims, 64 missing claims", no WARN.
- assign-screen-numbers.mjs --check: "OK 86 active, 5 retired".
- paginate.mjs --check: "overflow: ft-Payroll, sm-Payroll, layout".
- screens.json SHA256 before 28E6AFEF52A630EBCAE1A90832E67B6FC2BAD7D6C676ACFBA9D6EA205E4167F4, after 094873C874F491894FA8320B44F301332E543ACB8B096DF247B70ABC23F3C2D1.
- ui-inventory.html 3,032,876 bytes; PDF 181 pages.
- numstat: pagination.json +23/-24, screens.json +441/-338, ui-data.json +1544/-4456, ui-inventory.html +1678/-4594, ui-storyboard.html +1551/-4463, PDF binary.

Browser verification (built-in browser, dev server localhost:8081):
- Payments > "Manually confirmed" card shows `Job #N` for all 7 rows (Job #9, #11, #9, #2, #4, #104, #105), no UUIDs; "Open Job #2" navigated to /job/00000000-0000-4000-8000-000000000602?panel=plan.
- Reimbursements tab: Approve 84x32, Reject 68x32, Mark paid 95x32 (x2), all bg rgb(217,199,160), radius 6px, paddingLeft 14px.
- Payout Batches tab: the only real action button is "Approve" 459x32, same sand signature (menu, the ⋮ and the date-range row are chrome).

NOT verified: Jeff's own visual pass; the ⋮ identity (row menu vs overflow); that the 459px Approve width is deliberate.

## Forward contracts:
1. PayrollButton is the standing button; every new button uses it. Legacy `Button` is deprecated and roughly 50 files still use it (app/docs/ui-conventions.md:27): never write "all buttons" as done.
2. UI Inventory extract.mjs (app/docs/snapshots/v0.4.0/_tools/extract.mjs) does not pick up `<PayrollButton label="...">`: af-employee-roster buttonLabels is [] before and after (EmployeeRosterScreen.tsx ~lines 122/124 hold "Add Employee" and "Pending Invitations"). A follow-up session to fix it is proposed.
3. The three paginate overflow screens (ft-Payroll, sm-Payroll, layout) remain open (memory jobcore-ui-inventory-0058-regen).
4. Rule 43 test plan: declined by Jeff; nothing owed.

Carried from payroll-button-sop report, status checked this run (one narrowed read each):
- (a) PayrollButton export at app/packages/ui/src/index.ts:34: the line `export * from './PayrollButton';` is present. Whether it is unused: not re-verified.
- (b) job-title drill-in: app/modules/admin-finance/src/screens/PaymentsScreen.tsx:33 still holds `onOpenJob?: (jobId: string) => void;` (and :66 uses it). Keep/drop decision: not re-verified.
- (c) screen-registry.json #90/#91: still present at app/apps/mobile/src/screens/screen-registry.json:780 (`"number": 90`) and :787 (`"number": 91`). Origin: not re-verified.
- (d) docs/snapshots/v0.4.0/_tools/routes.json diffs: `git status --short` filtered for routes.json showed no pending diff; the file path itself was not located from app/. Otherwise not re-verified.

## Deviations / Defects
- extract.mjs under-counts PayrollButton labels (see Forward contract 2): inventory buttonLabels are incomplete for PayrollButton screens.
- Console warning observed in the browser: React "Cannot update a component (`AdminFinanceRoot`) while rendering a different component (`ModuleScreen`)" (setState-in-render). Not shown to be caused by this change; NOT verified as pre-existing. The console is not claimed clean.
- Three paginate overflow screens remain: ft-Payroll, sm-Payroll, layout.
- About 50 files still use the legacy Button: the retrofit is partial by design (ui-conventions.md:27).
- Payout Batches "Approve" renders full-width (459px), probably a column-layout stretch; not confirmed deliberate.
- df61726 and cf4bd7d were committed by another actor with the same git identity, not by this task; the snapshot was verified consistent with the committed source.
- Foreign stash stash@{0} ("On jobcore-job-detail-action-buttons: fx-06b-baseline") left untouched.
- Rule 43 ordering missed: the test-plan question was not put to Jeff before the commit; recorded here and asked at wrap-up.
- The earlier payroll-button-sop report is partly stale (Button-carries-the-look design, "nothing committed"); this report supersedes it where they differ.
- Plan slices S1-S13 were already applied by earlier commit `10de642` (Payroll button style SOP applied app-wide); S1-S5 were no-ops (PayrollButton already canonical, 0 divergent copies) and S6 (LeadRow badge/phone) was already satisfied. This task's real changes were limited to G1-G3 (Prem Needed checkbox cf4bd7d, TimesheetApprovalPanel PayrollButton 821914b, UI Inventory regen df61726).

## Commits
Committed locally on jobcore-role-landing-0.1.3 (821914b by this task; df61726 contains this task's pipeline output but was committed by another actor; see Changes). No upstream, nothing pushed. This report itself will be committed separately by the main session with a scoped pathspec.

## Test plan:
Test plan: declined by Jeff (Rule 43).

## Summary
The standing button is PayrollButton; this task converted the TimesheetApprovalPanel week buttons (821914b) and regenerated the UI Inventory v0.4.0 snapshot, whose output was committed in df61726 by another actor. The Karen gate passed (all tsc exit 0, npm test 389/389) and the inventory pipeline ran with all 7 steps exit 0. Payments Reimbursements and Payout Batches buttons and the Job #N card were checked in the built-in browser, but Jeff's own visual pass is not done. The retrofit is partial by design (about 50 files still use legacy Button), three overflow screens and the PayrollButton label under-count in extract.mjs remain open, and Jeff declined the Rule 43 test plan.
---END BUILD REPORT---
