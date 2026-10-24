---BUILD REPORT---

Tier: A
Project: jobcore
Slug: jobcore-commission-totals-dedupe
Date: 2026-10-24
Branch: jobcore-role-landing-0.1.3 (not pushed)
Commits: 910d5ae (fix); not pushed
Status: COMPLETE; nothing applied live, no migration.
Test plan: none - Jeff answered "No test plan" to the Rule 43 question (AskUserQuestion) this session; the change is pure logic covered by unit tests.
Plan: E:\Jeff\.claude\plans\jobcore-commission-totals-dedupe.md

## Scope

Jeff's order (verbatim): "Yes, plan the Commission Totals double-count fix (open item 4). Use plan mode, and do not apply anything live."

Jeff then approved the plan and said "go".

Root cause: the two commission sources were concatenated at AdminFinanceRoot.tsx:320, and commissionTotals sums every record with jobCount = records.length. A job with both a legacy commissions row and commission lines in job_payout_lines (status not void) was therefore counted twice (dollars and Job Count) while the drill-down (ReportsScreen.tsx:133-138, Sets keyed by jobId) showed one job. Legacy rows are still written by close_out_job_write when a price sheet is active (0106_tech_commission.sql:176-182), so the overlap could appear at the next Close Out. Legacy rows are 0 today. Rejected rule: summing both into one record (it keeps the dollar double count).

## Changes (paths under app/)

| File | Change |
|------|--------|
| modules/admin-finance/src/reporting/revenue.ts (lines 119-133) | New exported mergeCommissionRecords(legacy, lines). Payout lines win; one record per job; a zero-cent line still covers its job; returns kept legacy rows first, then folded line records. commissionsFromPayoutLines (109-117) and commissionTotals unchanged. |
| modules/admin-finance/src/reporting/__assertions__/revenue.assert.ts | The old test asserting the double count (3750 / 3 / 3, "a documented limit") replaced; 7 merge tests at lines 98-193. |
| apps/mobile/src/lib/admin-finance-repos.ts (lines 982-986) | The legacy commissions read now has .is('voided_at', null). |
| modules/admin-finance/src/screens/AdminFinanceRoot.tsx | Line 41 import now { mergeCommissionRecords, type CommissionAmountSource }; line 320 now commissions: mergeCommissionRecords(commissions, commissionLines). Call-site sweep found no other merge site; ReportsScreen.tsx:123 and ReportsJobDetailScreen.tsx:76 only call commissionTotals on the already-merged list, so they are fixed at the root. |
| docs/compensation.md (lines 261-265) | "known limit" bullet replaced by the new rule. |
| E:\Jeff memory jobcore-live-state-rollup.md (line 69) | Now says Commission Totals counts each job once (admin repo, uncommitted at report time). |
| E:\Jeff\.claude\plans\ (admin repo, uncommitted) | jobcore-commission-totals-dedupe.md new; old pay-masking plan ok-next-on-screen-pure-boole.md restored to HEAD content. |

Commit 910d5ae: 5 files, 117 insertions, 22 deletions, not pushed.

## Forward contracts:

1. Nothing is applied live and there is no migration; the fix ships with the next normal build.
2. Open item 5 - Jeff's click-check of the Reports Commission Totals card and of closed job #107's Close-Out screen - stays open and is Jeff's.
3. If a later change starts writing the earning technician onto commissions (it holds only the closing admin's user_id today), revisit whether legacy rows can be matched per technician instead of dropped per job.

Rule 41 statement: the only prior open contract of this lineage was item 4 itself (Commission Totals double count), which this change closes.

## Evidence

| Check | Result | Source |
|-------|--------|--------|
| Tests | 575 tests, 575 pass, 0 fail, 0 cancelled, 0 skipped, exit 0 (baseline before change: 569) | npm test --prefix E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app |
| Type-check, build config | exit 0 | from app\: npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing |
| Type-check, mobile | exit 0 | npx tsc -p apps/mobile/tsconfig.json --noEmit |
| Call sites | commissionsFromPayoutLines / mergeCommissionRecords in AdminFinanceRoot.tsx appear only at lines 41 and 320 | Grep `commissionsFromPayoutLines\|mergeCommissionRecords` |
| No remaining spread | `...commissions` / `commissionsFromPayoutLines(` appear only at revenue.ts:109,130 and revenue.assert.ts:72,88,202 | Grep `\.\.\.commissions\|commissionsFromPayoutLines\(` over app\ ts/tsx |
| Repo clean after commit | status empty; HEAD is 910d5ae | git -C E:\Jeff\Codespace\SDAssemblyPros\Jobcore status --short; git log -1 |
| Old plan restored | SHA256 of the new plan matched its copy before git checkout HEAD; then no status and no diff for the old plan | git -C E:\Jeff status --short -- .claude/plans/ok-next-on-screen-pure-boole.md; git diff --stat HEAD (both printed nothing) |
| Docs swept | 2 hits for twice\|double, 0 need an update: docs/compensation.md:162 (posting would double-pay approved timesheets - unrelated); docs/versioning-guide.html:119 (fix(login): stop double submit example - unrelated). supabase/README.md had no hits. The filed sweep report jobcore-open-items-sweep/2026-10-24_open-items-sweep.md line 58 is a historical record and is intentionally NOT edited. | Select-String -Pattern 'twice\|double' over app\docs and app\supabase\README.md, Select-Object -First 15 |
| NOT verified | The optional read-only live count (non-voided commissions rows; jobs holding both sources) was NOT run (the fix is correct whatever the answer). No browser check of any app screen (Jeff's standing order). Nothing applied live; no migration; no git push. | - |

## Deviations / Defects

1. The plan named Spot for S3, but the main-session Edit was hook-blocked (the 220-char edit exceeded Rule 30's 200-char threshold; not retried or routed around), so Nestor made the edit.
2. Nestor's S2 hand-back said it had not re-read its edited bodies although the brief required it; the main session verified by its own Read of the test file and by npm test.
3. The harness handed the session the plan path ok-next-on-screen-pure-boole.md, which held the committed pay-masking plan (commit 23268df); the new plan overwrote it, was copied byte-for-byte to jobcore-commission-totals-dedupe.md, and the old plan was restored from HEAD. The ExitPlanMode hook did not rename the plan.
4. The plan's restore check (line count of 101) was invalid because both plans are 101 lines, so a clean git status on the file was used instead.
5. S3 (the voided_at filter) goes beyond the literal wording of open item 4 (flagged in the plan; Jeff approved the plan).
6. The optional live read-only evidence was skipped (see NOT verified).

7. Nestor's scanner run (-Root) was not read-only: it wrote a stray INDEX.md here (deleted). Scanner: Forward-missing 0, TestPlan-missing 0.

Defects: none known.

## Open items

1. CLOSED 2026-10-24: Commission Totals double count (open item 4), fixed in 910d5ae, not pushed.
2. The closed-job Close-Out screen (job #107) and the Commission Totals card are not click-checked; Jeff's.

## Rule 14 teardown

No process or file left running. No Desktop copy of this report was made (Jeff order 2026-10-05).

---END BUILD REPORT---
