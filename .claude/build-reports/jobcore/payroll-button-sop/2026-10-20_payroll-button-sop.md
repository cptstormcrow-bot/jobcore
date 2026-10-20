---BUILD REPORT---

## Method / Tools
JobCore "Payroll" button style SOP. Tier-A. Date 2026-10-20. Branch jobcore-role-landing-0.1.3. Nothing committed or pushed. Verification by Karen (verify-hound); no self browser-check (Jeff does the visual pass).

## Request (Jeff)
Apply the Payroll button look as the standing button style across JobCore, including app-wide inheritance through Button.tsx (Jeff decision).

## Changes (files)
- app/packages/ui/src/Button.tsx: rewritten (76 lines) to the Payroll look: padding 3 vertical / 11 horizontal plus 1px transparent border, 14px label, radius 6, hitSlop {top:6,bottom:6,left:3,right:3}, no minHeight; outline variant sets borderColor primary. Every importer of Button (about 63) inherits it app-wide (Jeff decision).
- app/packages/ui/src/sand.ts: SandButton stays as the sand variant (selected/testID extras); JSDoc says Button now carries the same look.
- packages/payroll-ui: ReimbursementPanel and ReceiptCapture moved to SandButton; SandButton.tsx in payroll-ui re-points; no PayrollButton hits remain in payroll-ui/src.
- admin-finance screens restyled to the Payroll button: LeadInbox, LeadRow (Needs-info badge removed, phone shown), LeadEdit, AssignmentBoard, EmployeeRoster, PayrollRun, PayrollSettings, AdminFinanceRoot (Jobs header), AxisPicker; payment-review ReconciliationView.
- Review (payment-review) renumbered via scopeOf alias to #0033; no new registry number.
- app/docs/ui-conventions.md updated; LeadRow and lead-inbox.ts comments updated; LeadEditScreen.tsx:130 TS2322 patched.
- Jeff decision: #0063 Payments and Payment Hub left as is; PayoutBatchScreen, PayoutBatchDetailScreen, ReimbursementQueueScreen reverted to HEAD and verified.

## Verification
- Karen (verify-hound): tsc x4 + 3 assertions, 7/7 PASS. The earlier screen-resolve 89!==33 failure came from a registry addition that was reverted.
- Evidence: E:\Jeff\AppData\Local\Temp\claude\E--Jeff-Codespace-SDAssemblyPros-Jobcore\bf509d1c-bfab-4d56-bf82-b7262f2190ce\scratchpad\s17-karen.md
- NOT verified: visual appearance (no self browser-check; Jeff does the visual pass).

## Forward contracts:
1. Payroll button look is the standing SOP: all new buttons use Button or SandButton, no inline one-offs.
2. Jeff owes the app-wide visual pass for Button.tsx inheritance.
3. SOP memory feedback-jobcore-payroll-button-style-sop.md already exists in the project memory.

## Deviations / Defects
- Plan said "Do not touch Button.tsx"; Jeff reversed it during the run (obsolete line).
- Plan's new Review number (89) replaced by alias to #0033.
- #0063 Payments/Hub slices (S12) deliberately not applied per Jeff.
- Open for Jeff, not acted on: (a) unused PayrollButton export at app/packages/ui/src/index.ts:34 keep/delete; (b) job-title drill-in at app/modules/admin-finance/src/screens/PaymentsScreen.tsx:33 keep/drop; (c) screen-registry.json #90/#91 entries near line 770 of unconfirmed origin, NOT to be committed; (d) docs/snapshots/v0.4.0/_tools/routes.json diffs of unconfirmed origin, NOT to be committed.

## Commit plan (not done)
Scoped pathspec only, excluding screen-registry.json #90/#91 hunks, docs/snapshots diffs, and .claude/build-reports/jobcore/ui-inventory-0058-regen/; trailer Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>; no push; awaits Jeff's separate "go".

## Test plan:
Declined by Jeff (Rule 43). Test plan: declined.

## Summary
The Payroll button look is now the app-wide button style via Button.tsx, with SandButton as the sand variant and admin-finance and payment-review screens restyled. #0063 Payments and Payment Hub were left as is per Jeff. Karen verified 7/7 PASS. Nothing committed or pushed.
---END BUILD REPORT---
