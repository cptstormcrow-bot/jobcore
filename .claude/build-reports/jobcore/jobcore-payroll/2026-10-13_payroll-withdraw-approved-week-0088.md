---BUILD REPORT---
GOAL: Let a Field Tech or Sales user withdraw their own APPROVED payroll week back to draft so they can correct and resubmit it (Jeff chose option "B"). Shipped as migration 0088 (0081 was already live) plus the app-side offline op, read-cache patch, port member and a Withdraw week button. A withdrawn week shows as draft to admins and leaves the approval queue until resubmitted. The four layers (SQL filter, canWithdraw UI gate, cache patch, helper text) were edited together; RLS payroll_time_entries_update_own stays draft/rejected only, so only the RPC can reopen an approved week.

RoA: jobcore / BUILD
Plan: payroll withdraw approved week (option B)  |  Date: 2026-10-13  |  Status: COMPLETE
Why: A staff member could not correct an approved week; only an admin Reject could reopen it. Staff can now reopen their own approved week through withdraw_timesheet, which also clears submitted_at, approved_by and approved_at.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\jobcore-payroll\2026-10-13_payroll-withdraw-approved-week-0088.md
Commit: d8aebaf on branch jobcore-role-landing-0.1.3 ("feat(payroll): let staff withdraw an approved week back to draft (0088)")
Forward contracts:
1. 0088 is LIVE (`supabase migration list` showed `0088 | 0088 | 0088`; project ref vogkxkcceahtwyovpxsg, CLI v1.226.4); live is 0076-0088 on both sides.
2. Known gap: a queued offline withdraw can race an admin including the week in a payout run.
3. No payout-run guard on withdraw (admin Reject has the same gap).
4. No confirm tap on Withdraw week.
5. TimeEntryPanelActions dropped clockIn/clockOut/clockedIn: a breaking change for any other host of TimeEntryPanel.
Test plan: offered/declined (Rule 43; Jeff: "Push the 0088 migration now and no test plan please.")


🔧 METHOD / TOOLS USED
- git commit d8aebaf (scoped pathspec, 15 files) — withdraw core plus interleaved payroll work — HEAD held no withdraw code and the hunks share files.
- supabase db push of 0088, then `supabase migration list` — confirmed `0088 | 0088 | 0088`.
- Karen type-check (agentId a025fff4de0104cdc): `tsc -b --force`, `tsc -p apps/mobile/tsconfig.json --noEmit`, `tsc -p packages/payroll-ui/tsconfig.json --noEmit`, each exit 0 / 0 errors — covered the WHOLE working tree, not HEAD-plus-staged-subset; not re-run by the main session.
- Workflow wf_2c8b7563-168 — confirmed the four sibling files are payroll-only.
- Rule 31 doc sweep — app/docs/payroll.md is clean, no doc edit owed.

✅ COMPLETED
| File / Target | Change | Action |
|---|---|---|
| app/supabase/migrations/0088_withdraw_approved_timesheet.sql | replaces withdraw_timesheet(date,date): resets submitted AND approved rows to draft, clears submitted_at/approved_by/approved_at | created |
| app/supabase/migrations/0081_payroll_time_entries.sql | withdraw-related edits plus reject_timesheet changes (MIXED, see Deviations) | edited |
| app/apps/mobile/src/lib/read-cache-patches.ts | payroll_timesheet.withdraw OpPatchSpec | edited |
| app/apps/mobile/src/lib/offline-ops/payroll.ts | withdraw handler and registration | edited |
| app/apps/mobile/src/lib/payroll-repos.ts | withdrawWeek | edited |
| app/packages/payroll-ui/src/port.ts | PayrollSelfPort.withdrawWeek required; rejectWeek? optional reason; PayrollAdminPort.deleteWeek? | edited |
| app/packages/payroll-ui/src/PayrollHome.tsx | Withdraw week button gated on timeActions.canWithdraw; admin Delete week with tap-again confirm | edited |
| app/packages/payroll-ui/src/TimeEntryPanel.tsx | withdraw wiring plus other payroll changes (MIXED, see Deviations) | edited |
| app/apps/mobile/src/lib/payroll-admin-repos.ts | rejectWeek passes p_reason ?? null; new deleteWeek via delete_timesheet (requireOnline); getReceiptUrl path validation; check() throws new Error(error.message) | edited |
| app/packages/payroll-ui/src/ReimbursementPanel.tsx | receipt-guard text | edited |
| app/apps/mobile/src/lib/offline-ops/tech.ts | receipt-upload robustness: URI test widened to ^(file\|content\|blob\|data):, byMime extension map, path ${orgId}/${techId}/${id}.${ext} | edited |
| app/packages/payroll-ui/src/HoursTallyPanel.tsx | sibling payroll change | edited |
| app/packages/payroll-ui/src/TimesheetApprovalPanel.tsx | sibling payroll change | edited |
| app/modules/admin-finance/src/screens/PayrollRunScreen.tsx | sibling payroll change (sand buttons) | edited |
| app/modules/admin-finance/src/screens/PayrollSettingsScreen.tsx | sibling payroll change (sand buttons) | edited |

🧪 VERIFY
- [x] `$staged = @(git -C $repo diff --cached --name-only) | Sort-Object; Compare-Object $staged ($files | Sort-Object)` -> no diff, staged count 15.
- [x] Commit output: `15 files changed, 517 insertions(+), 129 deletions(-)`; `create mode 100644 app/supabase/migrations/0088_withdraw_approved_timesheet.sql`.
- [x] `(git -C $repo show --name-only --format= HEAD | Measure-Object).Count` -> 15.
- [x] BOM check: `($raw -join "`n") -match [char]0xFEFF` on `git cat-file commit HEAD` -> False.
- [x] `supabase migration list` -> `0088 | 0088 | 0088`.
- [x] `git -C $repo diff --stat --ignore-space-at-eol HEAD -- <10 sibling files>` -> 248 insertions, 65 deletions (pre-commit).
- [x] `git grep -l -E "withdrawWeek|payroll_timesheet\.withdraw|withdraw_timesheet|canWithdraw" HEAD -- app` at the pre-commit HEAD -> no output (HEAD held no withdraw code).
- [x] `git grep -n -E "deleteWeek" -- app` on the working tree -> 12 hits in 5 files.
- [x] `git diff --stat` over the 7 withdraw files -> 242 insertions, 65 deletions.

## Deviations / Defects
- Stale comment remains at 0081_payroll_time_entries.sql:217 ("approved untouched"); not fixed in this change.
- The 0081 diff also carries three non-withdraw reject_timesheet changes: p_reason text default null; the "rejection reason required" guard deleted; filter now status in ('submitted','approved').
- TimeEntryPanel.tsx carries non-withdraw changes: deleteWeek/canDelete, clock-in/out removal, draft prefill and save-flow, error banner moved to top, per-day locked logic.
- port.ts carries the rejectWeek optional reason and deleteWeek?.
- payroll-admin-repos.ts carries deleteWeek and getReceiptUrl path validation; ReimbursementPanel carries the receipt-guard text.
- offline-ops/tech.ts was included as a judgment call (payroll-repos.submitReimbursement feeds that op; plan rows 45-46 cover it).
- The four siblings (HoursTallyPanel.tsx, TimesheetApprovalPanel.tsx, PayrollRunScreen.tsx, PayrollSettingsScreen.tsx) ship in the same commit; PayrollSettingsScreen was confirmed payroll-only WITHOUT a symbol grep.
- The commit lands that other payroll work too, because HEAD had no withdraw code and the hunks are interleaved.
- Karen's type-check covered the WHOLE working tree, not HEAD-plus-staged-subset, and was not re-run by the main session.
- Payments-session files deliberately EXCLUDED: offline-ops/admin-finance.ts, admin-finance data/ports.ts, admin-finance-repos.ts, JobPaymentRegion.tsx, payments.ts, record-job-payment.ts and assertions, estimate-layout files, JobCloseOutRegion.tsx, JobHeader.tsx, DayView.tsx, ups-track/, packages/ui job-header files. Migration 0087 is live but untracked locally and belongs to the payments session; 0089_estimate_redlines.sql is untracked and belongs to another session.
- Hound reports were unverified until the main session read the files; Nestor earlier skipped a re-read of 0088, which the main session then did.
- Memory jobcore-supabase-migration-pending.md was stale and is now fixed (owes an E:\Jeff admin-repo commit).
- An empty hound output file (tasks\ae959287fde4a2ade.output) was never attributed.
- Rule 31 doc sweep: app/docs/payroll.md is clean, no doc edit owed.

📊 SUMMARY
Files touched: 15  |  ~Lines +517 / -129  |  Deferred: 0  |  ASSESS: withdraw core live and committed (0088 on both sides); test plan declined by Jeff; five forward contracts and the listed deviations carried.
---BUILD REPORT---
