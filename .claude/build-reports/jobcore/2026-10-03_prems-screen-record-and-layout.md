# Build Report: Prems screen - Record button and layout (S1-S4 close)

**Date:** 2026-10-03
**Branch:** jobcore-role-landing-0.1.3
**Commit:** S1 bd55751, S2 3bbdd0b, S3 none (satisfied by prior 33883ff), S4 see git log - commit message docs(jobcore): Prems Record button, layout - test plan + build report
**Trigger:** approved plan E:\Jeff\.claude\plans\jobcore-prems-screen-record-and-layout.md (Rule 38, four slices, 8 ledger rows)
**Tier:** A

## Goal

Field-tech Prem jobs screen: after Claim the list reloads in place and the card button flips Claim to Record; Record opens the Prem report; the report screen's submit button reads Submit; the Jobs/AppChrome title-bar layout offset.

## Summary

- S1 (bd55751 test(field-tech): prem card action helpers): prem-jobs-helpers (premCardAction, premReportRoute, formatNeedsPremSince) plus assertions.
- S2 (3bbdd0b feat(field-tech): prem claim reloads in place, Claim to Record): PremJobs.tsx line 80 `load({isRefresh:true})` after claim success; line 164 `router.push(premReportRoute(item.job.id))` when `item.claimedByMe`; line 166 label `premCardAction(item.claimedByMe)`; 23505 maps to "Already claimed by another tech" plus a full `load()`. JobInvestigationScreen.tsx "Submit Investigation" renamed "Submit". 2 files, 18 insertions, 17 deletions. Per-slice report: 2026-10-03_prem-claim-reloads-in-place.md.
- S3 (ledger row 6, AppChrome title-bar offset): satisfied by prior commit 33883ff (app/packages/ui/src/AppChrome.tsx, 13 lines changed). Verify-only; no edit, no commit in this run. Effect versus the pre-33883ff build: bar 20pt lower, pill 32pt wider.
- S4 (rows 7-8): test plan (row 7) and this report (row 8), carried by one docs commit together with the S2 report.

## Files Changed

| File | Change |
|------|--------|
| app/modules/field-tech/src/domain/prem-jobs-helpers (plus assertions) | S1 helpers and tests |
| app/modules/field-tech/src/screens/PremJobs.tsx | S2 claim reload in place, Claim/Record button |
| app/modules/field-tech/src/screens/JobInvestigationScreen.tsx | S2 label rename only |
| .claude/test-plans/2026-10-03_prems-record-button-and-layout.html | S4 test plan |
| .claude/build-reports/jobcore/2026-10-03_prem-claim-reloads-in-place.md | S2 report |
| .claude/build-reports/jobcore/2026-10-03_prems-screen-record-and-layout.md | this report |

## Explicitly Out of Scope

Other streams' uncommitted files, left untouched and unstaged: employee-detail test plans, apps/mobile _layout files, admin-finance AdminFinanceRoot / AssignmentBoardScreen / EmployeeDetailScreen, hoursBuckets and overview-cards domain files, migration 0074, and the AppChrome.tsx working-tree edits.

## Rule 41 - prior forward contracts

Prior lineage report 2026-10-02_hide-payment-review-from-module-switcher-v021.md (line 43 "Forward contracts: none."; lines 45-55 table): every earlier item is FIXED (commits 5bb25c9, b84a23a, 7c08180), closed-as-superseded, or Dropped. No open prior Forward contracts remained; nothing to resolve before writing this report.

## Verification (Rule 29-B)

| Claim | Command | Result |
|-------|---------|--------|
| Tests | `npm test` (cd app) | 221 of 221 pass |
| Typecheck | `npm run typecheck 2>&1 \| grep "error TS"` (cd app) | 2 errors, both in app/modules/admin-finance/src/screens/AssignmentBoardScreen.tsx (rowLeft 423,41 and viewSlot 469,43); another stream's uncommitted file, out of scope, not touched |
| S2 scope | `git log -1 --stat` on 3bbdd0b | 2 files, +18/-17 |

## Test plan

Test plan: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\test-plans\2026-10-03_prems-record-button-and-layout.html (5 tests, 11 steps; check-test-plan.ps1 PASS exit 0). Desktop copy E:\Jeff\Desktop\2026-10-03_prems-record-button-and-layout.html delivered via SendUserFile. Rule 43 satisfied by plan approval (the test plan was a planned row). Results pending Jeff's phone run.

## Deviations / Defects

1. S3 hunk landed via commit 33883ff before plan approval, so S3 became verify-only instead of an edit slice.
2. The working tree holds another stream's uncommitted AppChrome.tsx safe-area edits (useSafeAreaInsets, paddingTop: insets.top; 8 changes), so the plan's S3 empty-diff expectation did not hold; those edits were NOT staged.
3. The plan named the report file 2026-10-02_prems-screen-record-and-layout.md; it is dated 2026-10-03 (today) to match the S2 report.
4. The S2 report declared "Test plan: Skipped, Rule 43 gate pending"; this report's S4 test plan closes that.
5. Typecheck carries 2 out-of-scope errors in AssignmentBoardScreen.tsx (see Verification).

## Forward contracts

Forward contracts:
- FC-1: ADDRESSED 2026-10-03: the field-tech manual app/docs/jobcore-basics-field-tech.html now has the section "Prem Jobs: Claim and Record" (id ch4-prem-record) using the labels Claim / Record / Submit.
- FC-2: iOS safe-area top is unverified for the fixed 24pt paddingTop in AppChrome.
- FC-3: (tabs)/jobs stacks a native header on the AppChrome offset, and settings is now 40pt; revisit if the phone check shows crowding.
- Any further bump (paddingTop 24 to 32, pill margin 0) waits for Jeff's phone check of the test plan.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
