---BUILD REPORT---

Tier: A
Project: jobcore
Slug: jobcore-open-items-sweep
Date: 2026-10-24
Branch: jobcore-role-landing-0.1.3 (not pushed)
Commits: 12bc136 (closed-job Close-Out view, Commission Totals, repository layer; 7 files), 7901375 (migration 0108 and pay-column SQL tests; 14 files), b7dbed2 (docs; 3 files)
Status: COMPLETE for the built scope. Migration 0108 is NOT pushed and the pay-column SQL tests are NOT run live; both wait for Jeff's explicit go. Item 3 (UI Inventory regen) excluded by Jeff.
Test plan: Rule 43 question asked 2026-10-24; Jeff declined a test plan. The closed-job Close-Out screen and Reports Commission Totals were not click-checked by anyone. Verification is type-check (both configs exit 0) and npm test 563 of 563 (was 559).

## Scope (Jeff's order: "complete every open item 1-7 except 3")

| # | Open item | Result |
|---|-----------|--------|
| 1 | Run the commission / Close-Out test plan | DONE by Jeff 2026-10-24, 16 of 16 pass |
| 2 | Closed job says "Close-out opens once the job is completed" | BUILT: a closed job now shows the Close-Out review, read-only (commit 12bc136) |
| 3 | UI Inventory regeneration | EXCLUDED by Jeff; another session owns docs/snapshots |
| 4 | Reports "Commission Totals" ignored per-tech commissions | BUILT: totals now add the job_payout_lines commission rows (12bc136) |
| 5 | No DB-level tests for the pay columns | WRITTEN, NOT RUN live: one local file plus 12 single-case hosted files (7901375) |
| 6 | contractor_payouts needs a unique key | WRITTEN, NOT PUSHED: migration 0108; the app insert is also race-safe now (7901375, 12bc136) |
| 7 | No stored-payouts view for an already-closed job | BUILT: same change as item 2 (12bc136) |

## Changes

| File (under app/) | Change |
|-------------------|--------|
| supabase/migrations/0108_contractor_payouts_unique.sql | New. Preflight raises if any (job_id, tech_id) duplicate exists, then adds unique constraint contractor_payouts_job_tech_uniq if absent. NOT pushed. |
| modules/admin-finance/src/data/ports.ts | JobPayoutLineRepository gains listForJob(jobId) and listCommissionLinesForOrganization(organizationId) |
| apps/mobile/src/lib/admin-finance-repos.ts | Implements both reads (uncached); createForJob treats a 23505 duplicate-key error as success when every wanted tech now has a row |
| modules/admin-finance/src/reporting/revenue.ts | New pure helper commissionsFromPayoutLines (sums lines per job) |
| modules/admin-finance/src/reporting/__assertions__/revenue.assert.ts | 4 new tests (per-job fold, empty input, legacy plus lines, first-appearance order and zero-cent) |
| modules/admin-finance/src/screens/AdminFinanceRoot.tsx | Loads the commission lines with the existing Promise.all and concatenates them with the legacy commissions; LoadState.commissions widened to CommissionAmountSource[] |
| modules/admin-finance/src/screens/CloseOutReviewScreen.tsx | readOnly mode for closed jobs (Closed line, no action row or blockers, no photo Remove, notes not editable); "Flat rate" basis; row hint "included in payroll" or "posted - next payroll run"; empty text "No payouts were posted for this job. Hourly technicians are paid through timesheets." |
| apps/mobile/src/components/JobCloseOutRegion.tsx | Closed jobs build their rows from stored job_payout_lines (legacy commissions only when there are no lines) and render the review read-only |
| supabase/tests/0106_profiles_pay_columns_rls.test.sql and supabase/tests/0106_hosted_cases/ (12 files) | New SQL permission tests for the pay columns (0103, 0106, 0107); each ends in rollback. NOT run live. |
| docs/compensation.md, supabase/README.md, packages/ui/src/walkthrough/help-content.ts | Docs ride the change (Rule 31): closed-job payouts view, Commission Totals, 0108, test rows marked "written, NOT yet run" |
| .claude/build-reports/jobcore/close-out-0018-rework/ and .../jobcore-tech-commission-toggle/ reports | Test plan 16 of 16 recorded; FC2, FC4, FC6, FC7 and Commission Totals cross-referenced to this report |
| E:\Jeff memory jobcore-live-state-rollup.md | Rollup updated with the 16 of 16 pass, sweep state, 0108 and SQL tests awaiting Jeff |

## Forward contracts:

Prior contracts carried (Rule 41, evaluated 2026-10-24 against jobcore-tech-commission-toggle FC1-FC7 and the Commission Totals and closed-job items):
- FC1 employee pay posting: HONORED earlier (lines post to job_payout_lines).
- FC2 closed-job stored payouts view: CLOSED by this change (built, tsc and npm test green; Jeff's click check pending, test plan declined).
- FC3 rates $0: PARTLY HONORED, unchanged (policy hourly 2500; Dev commission default 0 until Jeff sets it).
- FC4 browser verification: HONORED by Jeff's 16 of 16 pass.
- FC5 UI Inventory regen: STILL OPEN (item 3, excluded by Jeff).
- FC6 pay-column SQL tests: ADDRESSED, tests written and not run live (contract 2 below).
- FC7 contractor_payouts unique key: ADDRESSED IN PART, 0108 written and not pushed (contract 1 below).
- Commission Totals ignoring per-tech commissions: CLOSED by this change (known limit in contract 4).
- Closed-job message "Close-out opens once the job is completed": CLOSED by this change.

New contracts made by this change (owner in brackets):
1. Migration 0108 is not pushed. Jeff's go must name 0108. The preflight aborts if a duplicate (job_id, tech_id) exists; live has 0 rows and 0 duplicates (read-only query 2026-10-24). Until it is pushed the app relies on check-then-insert plus 23505 tolerance. [Jeff]
2. The pay-column SQL tests are not run live. Run only on Jeff's explicit go: one file at a time with npx -y supabase@2.116.0 db query --linked --file <file>, then confirm Dev Tech (d59e3bc7-691d-4ada-8959-e86f40c1e344) is unchanged: commission_enabled true, commission_percent 2.00, dev_pay_mode hourly, tech_role dev. [Jeff]
3. Finding, NOT fixed: policy profiles_select_own_org lets any employee in the org read other employees' pay columns (hourly rate, commission percent). Hosted case 12 documents it. Needs Jeff's decision on whether to restrict it. [Jeff]
4. Commission Totals can count a job twice if it has both a legacy commissions row and per-tech payout lines (legacy rows are 0 today). [known limit, later build if legacy rows ever reappear]
5. Posted payout lines are immutable; a closed job's screen shows what was posted, not a recomputation. [known behavior, by design]
6. The closed-job read-only Close-Out screen (job #107) and the Reports Commission Totals card are not click-checked. [Jeff, whenever he opens them]
7. UI Inventory regeneration (item 3) stays open; another session owns docs/snapshots. [other session]

Rule 41 statement: the prior open contracts of this lineage were the content of this plan; each is closed by a slice above or named open in the list above with its owner.

## Evidence

| Check | Result | Source |
|-------|--------|--------|
| Type-check, build config | exit 0 | npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing |
| Type-check, mobile | exit 0 | npx tsc -p apps/mobile/tsconfig.json --noEmit |
| Tests | 563 pass, 0 fail (was 559; 4 new in revenue.assert.ts) | npm test, run after the last source edit (help-content.ts) |
| Commits on disk | 12bc136, 7901375, b7dbed2 | git log --oneline -4 |
| Sweep files uncommitted | none | git status --short after the commits (only .gitignore, docs/snapshots and other sessions' report folders remain) |
| 0108 file | 44 lines, preflight plus idempotent constraint | read in full this session |
| SQL test files | structure reviewed only: 8 balanced do-blocks, one begin and one rollback, no BOM; never executed anywhere | read this session |

## Deviations / Defects

1. The plan said createForJob would use onConflict 'job_id,tech_id'. That fails while 0108 is unpushed (no unique key to conflict on), so the code does a check-then-insert and treats a 23505 duplicate-key error as success when every wanted tech now has a row.
2. The 12 hosted SQL cases were written by one hound in a single batch, a declared exception to Rule 33 (one hound, one file, one question).
3. The Reports slice hound left a TS2345 type error at AdminFinanceRoot.tsx(320,24) (CommissionAmountSource[] not assignable to Commission[]). The main session fixed it (LoadState.commissions widened, import adjusted, the unused Commission import removed) and re-ran both type-checks and the tests.
4. The Rule 43 test-plan question was asked after the three code commits had landed, not before them as Rule 43 states; the same ordering slip as Deviation 2 of the jobcore-tech-commission-toggle report. Jeff declined the test plan.
5. No browser check of the closed-job screen or Commission Totals was made (standing order: a delivered test plan covers them; the plan was declined, so they are unchecked).
6. The two live-database questions (push 0108, run the SQL tests) went unanswered, so both default to not authorized. The SQL tests have never been executed anywhere, including locally (no local Postgres; Docker is not used).

## Rule 14 teardown

No ad-hoc process or file was left running. The background type-check and test tasks completed; no autonomy flag was set; the shared dev server on port 8081 is the pre-existing declared one and was not started or stopped by this work. No Desktop copy of this report was made (Jeff order 2026-10-05).

---END BUILD REPORT---
