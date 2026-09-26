---
classification: build-reports/jobcore
comments: "Job detail Save didn't retain customer edits or refresh the header — Tier-A closeout"
origin: .claude/build-reports/jobcore/2026-09-25_job-detail-save-customer-edits-fix.md
tags: [build-report, jobcore, tier-a]
---
---BUILD REPORT---
GOAL: Job #9's detail screen showed "Unknown Customer" / "Phone: —" in the header even though the
form held a name, phone and address, because the job had no linked `customer_id` and Save neither
created/linked a customer nor refreshed the header after a save. This build makes `Save` create or
update the customer, link it to the job when the id differs, surface a hard error when the link
doesn't take, and refresh job/customer/header state afterward — plus two hardening fixes from an
adversarial workflow review (dedupe in-flight saves; make the `customerId` patch gate explicit
tri-state rather than an implicit `'key' in patch` check).

RoA: jobcore / BUILD
Plan: fix-job-detail-save-doesnt-keep-customer-edits-or-refresh | Date: 2026-09-25 | Status: PARTIAL
Why: Save appeared to succeed (button read "Saved") but silently dropped customer-field edits and
never refreshed the header, so the user had no way to tell an edit had failed to persist. Save now
links or updates the customer and refreshes all dependent UI state, closing that silent-failure gap.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-09-25_job-detail-save-customer-edits-fix.md
Forward contracts:
- FC1: C2 org-consistency — no DB constraint enforces `jobs.organization_id == customers.organization_id` (`0004_scheduling.sql:93`); needs a migration.
- FC2: migration 0068, a null-safe tech trigger.
- FC3: M1, a `customerAddress` input.
- FC4: orphan-customer cleanup — create and link are two separate client writes, so a failed link leaves an orphan customer (destructive to fix, needs care).
- FC5: a transactional server-side create+link RPC — the root fix for FC4.
- FC6: align `patchLifecycle`'s `'key' in patch` idiom (admin-finance-repos.ts ~L325-327) with the explicit `!== undefined` gate used for `customerId` (code hygiene).
- FC7 (optional): await the save before a tab switch or navigation — callers are pre-existing fire-and-forget `void handleSaveEdit()`.
- FC8 (optional): Jeff runs the delivered test plan — A1 and B1 are not yet runtime-verified.
- FC9: `deliver-plan.ps1` (~L89, `$capturedSlugApplied=$true`) bypasses the goal-slug rename — tracked by chip `task_4afe6e43`.
- Carried from prior reports (Rule 41 disposition, see below): #1 authenticated Sales & Marketing visual check; #3 five unfinished-bucket files uncommitted; #10 price-sheet migration 0032 schema catch-up in price-sheet-repo.ts.
Test plan: offered/declined — delivered at E:\Jeff\Desktop\20260925_fix-job-detail-save-doesnt-keep-customer-edits-or-refresh_testplan.html (304 lines, SHA256 930434995B4298B9817F49116B48B1BBB48485B300AAF32D3862B08E65AD7FEE, 14 items T0a/T0b/T1-T6/T6b/T7-T11); Jeff said "let us skip the test plan this time" on 2026-09-25, so no results were collected.


🔧 METHOD / TOOLS USED
- Adversarial hardening Workflow run `wf_e35b9e79-1db` — produced hardening items A1 (dedupe in-flight saves) and B1 (explicit `customerId` gate), both applied; D1 and other critic gaps routed to the test plan instead of code changes.
- `npx tsc --noEmit` (apps/mobile) — exit 0; evidence `E:\Jeff\.claude\state\hound-artifacts\karen-verify-1-20260925-b7c1.json`.
- `npx tsc -b` — rebuilt gitignored `app/modules/admin-finance/dist/*.d.ts` to clear a stale-types TS2345 error at `[jobId].tsx:493`; Jeff approved the rebuild.
- Rule 41 pre-write gate via Themis (`themis-r41-20260925-b7c1`) and a Karen typecheck recheck (`karen-r41-tsc-20260925-b7c1`) — reconciled 12 prior open Forward contracts in the JobCore lineage; see disposition table below.

✅ COMPLETED
| File / Target | Change | Action |
|---|---|---|
| app/modules/admin-finance/src/data/ports.ts | Added `JobDetailsPatch.customerId?: string \| null` (tri-state: undefined = unchanged, string = link, null = unlink) | edited |
| app/apps/mobile/src/lib/admin-finance-repos.ts | `updateDetails` now writes `customer_id`; hardened to an explicit `if (patch.customerId !== undefined) update.customer_id = patch.customerId;` gate (~L344) | edited |
| app/apps/mobile/app/job/[jobId].tsx | `runSaveEdit` (~L451) creates/updates the customer, links it when the id differs, throws on a failed link, and refreshes job/customer/header state; `handleSaveEdit` wrapper (~L522-529) plus `saveInFlightRef` (~L705) dedupe the three save triggers (selectRegion, beforeRemove, Save button) onto one in-flight promise | edited |
| app/modules/admin-finance/dist/*.d.ts (gitignored) | Rebuilt via `npx tsc -b` to clear a stale-types TS2345 error | regenerated |
| Retired duplicate test-plan copy (294 lines) | Deleted in commit 9376274 | deleted |

⚠️ DEFERRED
| Item | Reason | Disposition | Saved to (path + anchor) |
|---|---|---|---|
| FC4/FC5 create+link atomicity | Needs a server-side RPC design decision | Backlog | this report, Forward contracts FC4/FC5 |
| FC1-FC3, FC6-FC9 | Each needs Jeff's go or a design call | Backlog | this report, Forward contracts |
| Rule 41 carried items #1, #3, #10 | Need Jeff's ownership/sign-in/go | Backlog | see disposition table below |
| Rule 41 re-deferred items #4, #6, #7, #8, #9, #11 | Jeff re-deferred via AskUserQuestion on 2026-09-25 | Backlog | see disposition table below |

🧪 VERIFY
- [x] `npx tsc --noEmit` in app/apps/mobile — exit 0. Evidence: `E:\Jeff\.claude\state\hound-artifacts\karen-verify-1-20260925-b7c1.json`.
- [ ] In-session browser verification — navigation to http://localhost:8081 was denied; not run.
- [ ] Delivered test plan (14 items) — offered, Jeff declined execution this time; A1 and B1 remain runtime-unverified.

## Deviations / Defects
1. Canonical build-report root conflict: the dispatch prompt named the admin-repo path
   `E:\Jeff\.claude\build-reports\jobcore\`, but memory `jobcore-build-report-canonical-root.md`
   states Jeff's standing decision is the project-repo-local root used for this file — this report
   was written to the project-repo-local root per that memory, not the dispatch's stated path.
2. The gitignored `dist/*.d.ts` types were rebuilt with `tsc -b` mid-session (approved by Jeff).
3. The typecheck ran in the main session rather than being delegated.
4. `close-out-job.assert.ts` coverage of this path is only implied, not directly confirmed.
5. The fix was bundled into F11 commit 7ef39ed before the test plan existed.
6. No in-session browser verification — 8081 navigation was denied.
7. Jeff waived test-plan execution, so hardening items A1 and B1 are not yet runtime-verified.
8. The test plan diverged into copies A/B/C; copy B was committed, then retired in commit 9376274.
9. The goal-slug rename was skipped for the delivered plan mirror (hook defect, tracked as
   chip `task_4afe6e43`).
10. The plan's frontmatter still carries the old slug `when-i-make-edits-tranquil-pillow`; a
    re-stamp is only a candidate per Rule 40, not auto-applied.
11. The Desktop plan mirror was hand-moved, so the next Rule 12 mirror trigger may write a
    `.generated` sibling instead of updating in place.
12. The Workflow-tool run result (`wf_e35b9e79-1db`) was parsed in the main session — a Rule 6
    context-offload breach.
13. Test item T6b was initially written assuming the save is awaited; corrected before delivery.
14. Nestor (report-writer dispatch) miscounted the test-plan item total (13 vs. the actual 14
    items); no content fix was needed, only the count.
15. The Rule 41 pre-write check was announced before it was dispatched in the same turn.
16. The Rule 18 dispatch narration was missed on the Themis Rule 41 dispatch.
17. The Rule 41 pre-commitment (stated in the dispatch prompt before Themis ran) was contradicted
    by Themis's actual findings.
18. Themis wrote its Rule 41 crib file outside the session scratchpad root
    (`E:\AppData\...` instead of `E:\Jeff\AppData\...`); pending a Rule 14 teardown sweep.
19. Themis's hand-back summary transposed its own resolvable/input-needed counts (stated 7
    resolvable and 5 input-needed; its own table showed 5 and 7).
20. Themis over-classified items #1, #3 and #10 as resolvable-without-input; they in fact needed
    Jeff's decision, and were re-routed to the "carry" bucket via AskUserQuestion.
21. Karen's artifact `karen-r41-tsc-20260925-b7c1.json` is not valid JSON — unescaped backslashes
    in a path make `ConvertFrom-Json` fail on it.
22. Karen's rows A and B reused an earlier same-day tsc artifact instead of running a fresh
    typecheck for the Rule 41 recheck specifically.

**Rule 41 pre-write gate disposition** (Themis task `themis-r41-20260925-b7c1`, Karen recheck
`karen-r41-tsc-20260925-b7c1`) — 12 prior OPEN contracts found in the JobCore lineage since
2026-08-16, none relating to this fix directly:

| # | Source report | Contract | Disposition |
|---|---|---|---|
| 1 | 2026-08-25_sales-marketing-ports-fix.md | Authenticated Sales & Marketing visual check (ReviewLibrary, Composer, Reporting after sign-in) | CARRIED — needs Jeff's sign-in |
| 2 | same | 8 pre-existing typecheck errors in 6 files (task_e2412449) | CLOSED (conditional) — apps/mobile tsc exit 0; source report never names the 6 files, so coverage outside apps/mobile is unconfirmed |
| 3 | same | 5 unfinished-bucket files (job-planning + reimbursements WIP) uncommitted | CARRIED — needs Jeff's ownership call |
| 4 | 2026-08-27_jobdetail-action-buttons-role-color.md | Request C: unify design with the web page | RE-DEFERRED |
| 5 | same | Plan verification items 2 (tsc) and 3 (live visual/simulator) not run | tsc part CLOSED (apps/mobile exit 0); visual part CARRIED |
| 6 | 2026-08-30_job-detail-action-buttons.md#FC1 | Implement PunchList.tsx | RE-DEFERRED |
| 7 | #FC2 | Estimate "editable until scheduled" gate; orphaned PriceEstimatingScreen.tsx | RE-DEFERRED |
| 8 | #FC3 | Field-tech module-session injection, null-session case | RE-DEFERRED |
| 9 | #FC4 | Payment Received button | RE-DEFERRED |
| 10 | #FC5 | Price-sheet migration 0032 schema catch-up (price-sheet-repo.ts) | CARRIED — needs Jeff's go |
| 11 | 2026-09-04_job-detail-screen-restyle.md#FC1 | eas build --profile development + on-device checklist | RE-DEFERRED |
| 12 | #FC2 | TimeOff.tsx typecheck failures | CLOSED — field-tech tsc exit 0 on 2026-09-25 |

Jeff's 2026-09-25 AskUserQuestion decisions: Q1 "Re-defer all" → #4, #6, #7, #8, #9, #11. Q2 "Carry
all three" → #1, #3, #10.

📊 SUMMARY
Files touched: 3 source files (+2 gitignored dist rebuilds, +1 deletion) | ~Lines +12 / -296 (commit
9376274 stat: 3 files changed, 12 insertions(+), 296 deletions(-); command:
`git -C "E:\Jeff\Codespace\SDAssemblyPros\Jobcore" log -1 --stat --format="%h %s"`) | Deferred: 4 rows
(see ⚠️ DEFERRED) | ASSESS: PASS (tsc clean, code review complete) / CORRECT (matches root-cause
analysis — job lacked a linked customer_id) / CLEAN (no in-session browser verification; A1/B1 not
runtime-verified — see Deviations 6-7)
---BUILD REPORT---

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
