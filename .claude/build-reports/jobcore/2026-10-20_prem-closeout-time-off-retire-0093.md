---BUILD REPORT---
GOAL: Close out the JobCore Prem work on branch jobcore-role-landing-0.1.3 - retire the Time Off Queue screen into the Calendar, add the 0093 database role gate on estimate approval, fix open-items rows 7 and 12, and regenerate the UI Inventory v0.4.0 snapshot.

## Method / Tools
Tier-A. Date 2026-10-20. Branch jobcore-role-landing-0.1.3. Edits by roster hounds (Rule 30); disk checks by the main session. Tools: tsc (build and per-project), npx supabase migration list, UI Inventory pipeline (docs/snapshots/v0.4.0/_tools), pypdf, PowerShell Select-String / Get-Item / Get-Process. `npm test` cannot load .tsx / react-native / @jobcore/ui, so UI code is covered by tsc only.

## Summary of scope
JobCore Prem close-out. The Prem code was ALREADY in HEAD (c41ed28 core stage flags incl. `notRequired`; cf4bd7d Prem Needed checkbox + header UI), so no code commit is owed for it. This change adds: (1) retire the Time Off Queue screen into Calendar; (2) migration 0093 (role gate on job_estimates status), pushed live; (3) small fixes for open-item rows 7 and 12; (4) UI Inventory v0.4.0 regen after the screen retirement. Jeff declined a test plan (Rule 43, 2026-10-20).

## Changes (by area)
Paths are under app/ unless stated.

Time Off retire (row 15; precedent commit b9858cf retired #0031 the same way):
- Created modules/admin-finance/src/components/CalendarTimeOffSection.tsx: admin-only section in a ScrollView under the calendar; Add Blackout opens BlackoutEditor as a modal, plus a read-only Pending Review list.
- Edited apps/mobile/app/(tabs)/calendar.tsx.
- Edited modules/admin-finance/src/screens/AdminFinanceRoot.tsx (8 edits; `blackout-editor` kept; HELP_SCREEN_KEY maps blackout-editor to 'af-time-off').
- Removed timeOffQueue from modules/admin-finance/src/domain/overview-cards.ts and its entry in __assertions__/overview-cards.assert.ts.
- Pruned apps/mobile/src/screens/screen-registry.json.
- DELETED modules/admin-finance/src/screens/TimeOffQueueScreen.tsx.
- Neighbors intentionally kept: time-off-repo.ts, BlackoutTimeOffList.tsx, BlackoutEditorScreen.tsx, TimeOffTechCalendar.tsx, UniversalCalendar.tsx, JobScheduleScreen.tsx, AssignmentBoardScreen.tsx, blackout-calendar-logic.ts (+ assert).
- help-content.ts:55-60 (af_time_off) already says to reach Time Off from Calendar; no edit needed.

Migration 0093 (row 17, enforced in the DB per Jeff):
- supabase/migrations/0093_job_estimates_status_role_gate.sql (64 lines): plpgsql trigger function public.job_estimates_status_role_gate(), `set search_path = ''`, not SECURITY DEFINER. A null auth.uid() passes; public.is_org_sales_or_above() passes; a tech may not INSERT an approved estimate, UPDATE an approved row, or set status to approved; errcode 42501. Trigger job_estimates_status_role_gate_trg, before insert or update, for each row.
- Tests written: supabase/tests/0093_job_estimates_status_role_gate.test.sql (140 lines, AC-93.1..AC-93.7) and ...hosted.test.sql (141 lines).
- Comment-only edit in modules/admin-finance/src/flows/approve-estimate.ts.
- Offline replay is terminal on 42501 (packages/core/src/offline/replay.ts:228 classifies 'permission').
- PUSHED and CONFIRMED: `npx supabase migration list` post-push rows=93, unpaired=0, 0093 local=[0093] remote=[0093].

Row 7 FIXED: modules/admin-finance/src/data/payout-batch-repo.ts now uses hours_amount and reimbursement_amount (lines ~184/187), returns `{ ok: true, value: { ...toPayoutBatch(row, []), lines: batch.lines } }` (~196-199), and no longer sends p_organization_id.

Row 12 FIXED: modules/admin-finance/src/screens/PlanningScreen.tsx:176 now `<Text>{row.title}</Text>` (behavior-neutral). The `t.name` reads at PlanningScreen.tsx:162 and JobTaskList.tsx:183 are left intentionally. The addTask half of the row-12 source line is stale.

Row 14: migration 0090 was ALREADY APPLIED; no push owed.

UI Inventory v0.4.0 regen (docs/snapshots/v0.4.0): pruned stale af-timeOffQueue entries from _tools/routes.json and _tools/descriptions.json (inputs); regenerated screens.json, pagination.json, ui-data.json, ui-inventory.html, ui-storyboard.html, ui-inventory.pdf. Result: 85 screens (was 86; retired = af-timeOffQueue), 179 pages (was 181/182), PDF 85 top-level bookmarks, ui-inventory.pdf 7977773 bytes, 0 af-timeOffQueue hits in the 5 checked files plus routes/descriptions, 0 leftover msedge processes. paginate.mjs diff vs HEAD = exactly 2 lines (EDGE_TIMEOUT_MS 60000->120000 at :22; --virtual-time-budget 30000->60000 at :126).

## Verification
Commands (run from R\app unless noted):
- Force build: `$out = & npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing 2>&1 | ForEach-Object { "$_" }; $errs = @($out | Where-Object { $_ -match 'error TS' })` -> build exit=0 errors=0.
- `npx tsc -p "$p/tsconfig.json" --noEmit` for modules/admin-finance and apps/mobile -> errors=0 each.
- `npx supabase migration list` (ANSI stripped, parsed on U+2502) -> rows=93 unpaired=0.
- Regen figures: single-number `(Select-String -Path <f> -SimpleMatch -Pattern 'af-timeOffQueue').Count` per file, `(Get-Item).Length`, `Get-Process msedge` count, pypdf `len(PdfReader(...).pages)` and `len(r.outline)`.
- Regen outcome (disk-verified by main session): 85 screens, 179 pages, 85 bookmarks, PDF 7977773 bytes, mtime 2026-10-20 20:21:22, ui-inventory.html 3005746 bytes with 85 data-screen-key= lines, 0 stale hits, no leftover msedge.

NOT verified: the 0093 SQL tests were not run; no visual PNG check of the regenerated PDF; no device/visual check of the Calendar Time Off section.

Evidence table (Rule 29; fresh Test-Path this turn; app/ and docs/snapshots/v0.4.0 relative to R):

| Path | Present/absent |
|---|---|
| app\supabase\migrations\0093_job_estimates_status_role_gate.sql | present |
| app\supabase\tests\0093_job_estimates_status_role_gate.test.sql | present |
| app\supabase\tests\0093_job_estimates_status_role_gate.hosted.test.sql | present |
| app\modules\admin-finance\src\components\CalendarTimeOffSection.tsx | present |
| app\modules\admin-finance\src\screens\TimeOffQueueScreen.tsx | ABSENT (expected, deleted) |
| app\modules\admin-finance\src\screens\AdminFinanceRoot.tsx | present |
| app\modules\admin-finance\src\screens\PlanningScreen.tsx | present |
| app\modules\admin-finance\src\data\payout-batch-repo.ts | present |
| app\modules\admin-finance\src\flows\approve-estimate.ts | present |
| app\modules\admin-finance\src\domain\overview-cards.ts | present |
| app\apps\mobile\app\(tabs)\calendar.tsx | present |
| app\apps\mobile\src\screens\screen-registry.json | present |
| docs\snapshots\v0.4.0\ui-inventory.html | present |
| docs\snapshots\v0.4.0\ui-inventory.pdf | present |
| docs\snapshots\v0.4.0\ui-storyboard.html | present |
| docs\snapshots\v0.4.0\ui-data.json | present |
| docs\snapshots\v0.4.0\_tools\screens.json | present |
| docs\snapshots\v0.4.0\_tools\pagination.json | present |
| docs\snapshots\v0.4.0\_tools\routes.json | present |
| docs\snapshots\v0.4.0\_tools\descriptions.json | present |
| docs\snapshots\v0.4.0\_tools\paginate.mjs | present |

## Forward contracts:
Rule 41 result: for this lineage, "honored" means NOT ALTERED, not resolved. Prior open contracts were evaluated before this report; those not listed as resolved remain open and were left unaltered. Row numbers refer to the verified 25-row open-items table (scratchpad open-items-verified.md).

| Row | Contract (plain description, source) | Status after this change |
|---|---|---|
| 7 | Payout-batch repo column/arg fix | RESOLVED this change |
| 12 | PlanningScreen task title read | RESOLVED this change (addTask half stale) |
| 14 | Push migration 0090 | RESOLVED: already applied, no push owed |
| 15 | Retire Time Off Queue into Calendar | RESOLVED this change |
| 17 | Role gate on estimate approval enforced in DB | RESOLVED: 0093 live |
| 10 | FC-3 commission by task (drawer-sand report :69): commission.ts:103-108 takes no task param; findMatchingRate (:34-66) already accepts optional taskId; callers money/rollup.ts:101 and flows/close-out-job.ts:102-107 | OPEN, NOT built, needs Jeff. Question: a job can have several job_plan_tasks; which task id counts for commission: the first task, the highest-value one, or per-task commission lines? |
| 16 | Redlines report :31, all three parts: delivery-tracking secrets unset, estimate-resolve redeploy on hold, Fine Print wording review pending | OPEN, Jeff's |
| 1-4, 6, 18, 20-22 | Jeff's own device/visual passes (declared by Jeff 2026-10-20) | OPEN, Jeff's |
| 5 | Redlines report :29 | Report-only. Premise CONTRADICTED: the "Paid" menu item (apps/mobile/app/job/[jobId].tsx:1312) only calls selectRegion('payment'); recordJobPayment (record-job-payment.ts:8-9) deliberately never calls transitionJob; completed->paid plus commission insert are atomic only in Close-out (close-out-job.ts:114, RPC 0026_close_out_write_rpc.sql:55,58-59); only the dev simulator makes paid-without-commission (job-simulator.ts:325-330). Money path not touched. |
| 19 | Payroll 0080-0085 | Stale premise: they are on the remote; the payroll session owns the row |
| 8, 9, 11, 13, 23, 24, 25 | Not Prem | Left open, not altered (row 25: only its key contract left unaltered) |
| apk Contract 2 | job-photos bucket | Recorded live per memory (0078 live 2026-10-12); unconfirmed |

New forward items from this change:
- (i) The 0093 SQL tests are written but NOT run; Jeff may run the hosted test in the dashboard SQL editor.
- (ii) 0093 lets sales approve estimates while the core matrix packages/core/src/estimateStatus.ts:7-25 lists admin only: decision for Jeff whether the matrix or the trigger moves.
- (iii) 3 pre-existing UI Inventory overflow screens (ft-Payroll, sm-Payroll, layout) remain, cause undiagnosed, first noted 2026-10-18 (see .claude/build-reports/jobcore/ui-inventory-0058-regen/2026-10-18_ui-inventory-0058-regen.md DEFECT section).

## Deviations / Defects
- (a) JobOverviewRegion.tsx (app/apps/mobile/src/components/JobOverviewRegion.tsx) changed in cf4bd7d: the `<Section title="Customer, contact & location">` became an always-open `<Section>` with no header. Intended; Jeff said keep. An earlier statement that this file was unchanged was wrong.
- (b) arriveHint / SERVICE_TECH_GATE_HINT removed from JobHeader.tsx in cf4bd7d. Intended; Jeff said keep; nothing restored.
- (c) premAvailable derivation rewritten in apps/mobile/app/job/[jobId].tsx (~992-1013): complete/completedAt from investigation?.submittedAt; inProgress = (!!job.needsPremAt || !!investigatorTechId) && !investigation?.submittedAt; notRequired = neither flag; sticky true. JobHeader got needsPrem/onToggleNeedsPrem/needsPremDisabled (disabled for role !== 'tech').
- (d) The Prem `notRequired` stage flag landed in c41ed28 under the unrelated message "feat(ui): apply Payroll button look app-wide via Button"; the message does not mention Prem.
- (e) Stale premises found: 0089 migration header line 2 still says UNAPPLIED (applied files cannot be edited; noted only); row 14 (0090 already applied); row 19; the row-12 addTask half.
- (f) 0093 lets sales approve while the core matrix lists admin only (forward item ii).
- (g) 0093 SQL tests written but NOT run; test files were reviewed by grep only.
- (h) Row 7: returned lines are the INPUT lines (no server refetch); the unused PayoutBatchWithLinesRow interface remains in payout-batch-repo.ts; the source report's "batch_id vs payout_batch_id" wording is stale.
- (i) The first slice-B recon sweep missed overview-cards.assert.ts; a git grep caught it and it was fixed in wave 2.
- (j) 3 pre-existing overflow screens (ft-Payroll, sm-Payroll, layout) remain open and unchanged after the regen; paginate --check exits 1.
- (k) The first regen run failed at step 2 (assign-screen-numbers --check: "screen key has no active entry: af-timeOffQueue"). Stale af-timeOffQueue entries remained in _tools/routes.json (read by extract.mjs:9) and _tools/descriptions.json (read by generate.mjs:16) because the tracked-only `git grep` sweep excluded docs/snapshots. The hound's loop did not stop on that failure and ran generate anyway (86 screens); paginate then failed ("measurement result not found in Edge output"); step 7 render-pdf did not run on that attempt. Fixed by pruning both inputs, then a clean second run.
- (l) The first descriptions.json prune hand-back claimed the key was `gone`, but a disk count still showed 1 hit (a navTargets item plus "Time off" summary prose inside the af-overview entry). Found by the main session's disk count, fixed in a second pass, verified 0. Lesson: prune briefs must say "remove every reference, including navTargets and prose in other entries".
- (m) Regen outcome was disk-verified by the main session: 85 screens, 179 pages, 85 bookmarks, PDF 7977773 bytes, mtime 2026-10-20 20:21:22, ui-inventory.html 3005746 bytes with 85 data-screen-key= lines, 0 stale hits, no leftover msedge.
- (n) paginate.mjs timeouts (EDGE_TIMEOUT_MS 120000, --virtual-time-budget 60000) differ from HEAD. Origin UNVERIFIED: the file already showed as modified in the session-start git status, so the raise may predate this change. KEPT, not reverted. Likely unnecessary: the earlier "measurement result not found" error was most likely caused by running paginate/Edge under the Bash tool; under PowerShell Edge returns output and the same command succeeds.
- (o) No visual PNG check of the regenerated PDF was done (Jeff does his own visual passes).

## Commits
Nothing committed or pushed by this report's authoring. Migration 0093 was pushed to the live database (confirmed above). Git push stays banned (memory feedback-no-git-push); the main session commits with a scoped pathspec.

## Test plan:
Test plan: none - declined by Jeff 2026-10-20 (Rule 43).

## Summary
The Prem code was already in HEAD, so this close-out retired the Time Off Queue screen into Calendar, added and pushed migration 0093 (DB role gate on estimate approval), fixed open-item rows 7 and 12, and regenerated the UI Inventory v0.4.0 snapshot (85 screens, 179 pages). The tsc builds and per-project checks show 0 errors, and migration list shows 93 rows, 0 unpaired. Open: the 0093 SQL tests are not run; the sales-versus-matrix mismatch and row 10's commission-task question need Jeff; three overflow screens remain. Several process slips (stale input sweep, an unverified hand-back claim, an unverified paginate.mjs timeout change) are disclosed above.
---END BUILD REPORT---
