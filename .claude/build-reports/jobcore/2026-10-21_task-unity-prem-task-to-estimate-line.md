---BUILD REPORT---

## Method / Tools
Edits made on branch jobcore-role-landing-0.1.3 in commit 954117d (not pushed, per standing no-git-push order). Report filed at the admin build-reports root under slug task-unity as dispatched; not copied to Desktop. Rule 41: no prior task-unity lineage report exists (checked E:\Jeff\.claude\build-reports\task-unity, absent), so there are no prior forward contracts to honor.

## Request (Jeff)
Tie premium-job tasks to estimate lines: a line keeps a live link to its task plus a price/description snapshot, with a 3-way line save (Save / Save as new line / Save to price sheet).

## Changes (files)
12 files, +851/-64.
- app/supabase/migrations/0094_task_unity.sql (new, 181 lines, NOT applied live): service_task_id on the line, content_updated_at touch trigger on job_plan_tasks, RPC save_estimate_line_to_price_sheet(p_line_id), SECURITY DEFINER with is_org_admin() check. It inserts a NEW service_tasks row (dedupe by normalized name) and relinks; it never overwrites the catalog.
- app/modules/admin-finance/src/lib/estimate-line-helpers.ts and .test.ts (new; node --test; test excluded from tsc via modules/admin-finance/tsconfig.json).
- admin-finance and field-tech src/data/ports.ts.
- apps/mobile/src/lib/admin-finance-repos.ts (saveLineAsNew, saveLineToPriceSheet, updateLineItem whitelist), field-tech-repos.ts, offline-ops/admin-jobs.ts, offline-ops/tech.ts.
- modules/admin-finance/src/screens/JobEstimateScreen.tsx: Save / Save as new line / Save to price sheet, stale badge with Refresh from task, assembly picker, save-to-sheet toggle, Build-from-tasks (one line per task).
- apps/mobile/src/components/JobTaskList.tsx: unit/area/materials on prem tasks.
- Stale flag is computed at read time: job_plan_tasks.content_updated_at vs the line's task_snapshot_at.

## Commits
- 954117d feat(estimate): tie prem tasks to estimate lines with 3-way line save

## Verification
- Workspace tsc -b: clean.
- Mobile tsc --noEmit: exit 0.
- node --test: 8 pass / 0 fail.
- S6 (JobTaskList) typecheck-only. NOT browser-tested. Migration 0094 not applied live.

## Forward contracts:
- 0094 may be applied live only on Jeff's explicit go, after `supabase migration list` and a column comparison.
- The held assembly seed (5 assembly labor items: Desk $89, Nightstand $89, Dresser $129, Bed basic $89, Bed with desk $129) was authored as 0096_assembly_labor_seed.sql (local 0095 belongs to the Job Archive & Flags session); both 0095 and 0096 were pushed and verified live on 2026-10-22 -- forward contract HONORED.
- S7 optional unit field in PriceSheetEditorScreen: not done.
- UI Inventory regen for the new buttons: deferred (only if Jeff says "do it").
- Stale memory lines fixed in a companion step (P12).

## Deviations / Defects
1. updateLineItem sets task_snapshot_at = now on EVERY update, not only the overwrite Save (admin-finance-repos.ts ~:2538-2541).
2. Catalog-path Save to price sheet does overwrite-then-RPC; Refresh from task does not set taskSnapshotAt (JobEstimateScreen.tsx ~:644-723).
3. Quick-add link: planMatch matches on serviceId and likely never matches a plan task (JobEstimateScreen.tsx ~:344-346); quick-add unit-cost prefill is not converted from row.rate; the selected toggle uses colors.primary rather than the blue-underline SOP; save-to-sheet visibility is gated on a function-existence check.
4. Build-from-tasks split keys on serviceTaskId rather than kind==='misc'; the legacy fold line is detected by the description prefix "Hourly — billed by clock".
5. Open question: whether assembly items also need price_sheet_rates rows (affects the assembly seed, authored as 0096_assembly_labor_seed.sql and pushed and verified live on 2026-10-22 with 0095, and the picker).
6. S6 photo UI skipped (no photo callback prop on JobTaskList); whether field-tech-repos.ts passes the five new fields at the job_estimate_line_item.add writeThrough (~:918) is unverified.
7. A notes-only prem task edit marks a line stale (accepted risk).
Out of scope kept: no live push, no git push, no Docker, parallel-session files untouched.

## Test plan:
Declined by Jeff (Rule 43: "No, skip it").

## Summary
Prem tasks now tie to estimate lines (live link plus snapshot) with a 3-way save and a stale badge. The migration is written but not applied live, and the work is type-checked and unit-tested but not browser-tested.
---END BUILD REPORT---
