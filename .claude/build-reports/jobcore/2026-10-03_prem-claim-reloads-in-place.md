---
classification: build-reports/jobcore
comments: "S2 of Prem jobs: claim reloads list in place, button Claim to Record, Submit label rename"
origin: .claude/build-reports/jobcore/2026-10-03_prem-claim-reloads-in-place.md
tags: [build-report, jobcore, tier-a]
---
# Build Report: Prem claim reloads in place (S2)

**Date:** 2026-10-03
**Branch:** jobcore-role-landing-0.1.3
**Commit:** 3bbdd0b (feat(field-tech): prem claim reloads in place, Claim→Record)
**Trigger:** approved plan, slice S2 (S1 = bd55751 test(field-tech): prem card action helpers)
**Tier:** A

## Summary

- After Claim succeeds, PremJobs.tsx reloads the list in place via `load({ isRefresh: true })` (keeps the FlatList mounted; only the pull-to-refresh indicator shows). No post-claim router.push remains. A plain `load()` would set `loading` and hit the full-screen spinner early return, unmounting the list, which is why isRefresh is used.
- The card button flips Claim to Record via `premCardAction(item.claimedByMe)`; tapping Record routes via `router.push(premReportRoute(item.job.id))`; tapping Claim still goes through the confirm dialog then `doClaim`.
- Unique-violation 23505 still maps to "Already claimed by another tech" followed by a full `load()`.
- JobInvestigationScreen.tsx: button/label "Submit Investigation" renamed to "Submit" (two doc comments + the Button label).

## Files Changed

| File | Change |
|------|--------|
| app/modules/field-tech/src/screens/PremJobs.tsx | claim reload in place, Claim/Record button |
| app/modules/field-tech/src/screens/JobInvestigationScreen.tsx | label rename only |

Evidence: `git log -1 --stat` on 3bbdd0b showed exactly 2 files, 18 insertions, 17 deletions. prem-jobs-helpers.ts was NOT modified in S2 (S1 added its tests).

## Explicitly Out of Scope

Other streams' uncommitted work was left unstaged and untouched (scoped pathspec commit `git commit -- <paths>`): AssignmentBoardScreen.tsx, AdminFinanceRoot.tsx, EmployeeDetailScreen.tsx, field-tech DayList/Overview/index/day-list-helpers, sales-marketing Overview/SalesMarketingRoot, packages/ui AppChrome + package.json, apps/mobile layouts, CHANGELOG.md, migration 0074, admin-finance domain hoursBuckets/overview-cards, and the employee-detail test-plan HTMLs.

## Rule 41 — prior forward contracts

Reviewed the project lineage's open Forward contracts: job-detail restyle (2026-09-04: eas dev build + on-device checklist, closeOutJob() unwired, four pre-existing core test failures); redlines (2026-09-20: JD-08, service_task_id/task_id not threaded into commission and edge function, migration 0032/0049 ordering, updated_at on area-adjustment upsert); save follow-ups (2026-09-26: C2 org-consistency constraint, M1 customerAddress input, patchLifecycle idiom, orphan-customer cleanup, customer.saveForJob replay handler). The prem-visit-rename and 2026-10-02 field-tech overview reports declare none. None relate to the Prem claim-reload change, none are resolvable within S2's scope, and none need input for this report.

## Verification (Rule 29-B)

| Claim | Command | Result |
|-------|---------|--------|
| Tests | `npm test` (in app/) | 221 of 221 pass |
| Typecheck | `npm run typecheck 2>&1 \| grep "error TS"` (in app/) | 2 errors, both TS2339 in modules/admin-finance/src/screens/AssignmentBoardScreen.tsx (rowLeft at 423,41; viewSlot at 469,43) — other stream's uncommitted work; S2 files are type-clean |
| Commit scope | `git log -1 --stat` | 2 files, +18/-17 |

## Test plan

Skipped for this slice. Rule 43's closeout gate (asking Jeff whether he wants a test plan) applies at project closeout, not per slice; that gate is still pending with Jeff.

## Deviations / Defects

- No divergence from the approved plan.
- Defect observed, not caused by this change: the 2 TS2339 errors in AssignmentBoardScreen.tsx come from another stream's uncommitted edits. Deliberately NOT fixed and NOT staged (out of scope); mitigated by the scoped pathspec commit.

## Forward contracts

Forward contracts: none

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
