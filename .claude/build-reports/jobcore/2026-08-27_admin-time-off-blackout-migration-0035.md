# Build Report — Admin Time-Off Blackout: Migration 0035 Commit, Live Apply, and Smoke Test

**Project:** JobCore — Supabase backend + admin-finance module
**Date:** 2026-08-27
**Status:** COMPLETE
**Plan:** No formal Plan-Mode plan file — executed under Jeff's standing walkthrough authorization ("lets go walk me thru to completion.") with explicit per-step "go" confirmation, per CLAUDE.md Rule 1's "just do it" / explicit-confirmation carve-out.
**Tier:** A

## Summary

Migration `0035_admin_time_off_blackout.sql` was discovered untracked in the Jobcore working tree alongside two paired frontend screens. Jeff asked for a full walkthrough to completion: commit the migration, apply it to the live hosted Supabase database, and smoke-test both directions of its new trigger logic before calling the work done.

> "lets go walk me thru to completion."

The migration adds `created_by_admin_id` to `time_off_requests` so an org admin can create a time-off row on a tech's behalf (a "blackout"), reusing the existing auto-approve/deny logic in `decide_time_off_request()` — which now also rejects a non-admin tech trying to set that column on themselves. It adds a reverse-direction trigger, `deny_job_assignment_on_time_off()`, firing `BEFORE INSERT ON job_assignments`, which blocks assigning a job to a tech who already has an approved time-off/blackout overlapping the job's scheduled dates. Both functions are `SECURITY DEFINER` with `SET search_path = ''`.

| # | Step | Result |
|---|------|--------|
| 1 | Commit `0035_admin_time_off_blackout.sql` + `BlackoutEditorScreen.tsx` + `PriceEstimatingScreen.tsx` to branch `jobcore-job-detail-action-buttons` | Commit `d5487c5` |
| 2 | Apply migration 0035 to hosted Supabase project `vogkxkcceahtwyovpxsg` | Applied clean |
| 3 | Smoke test: non-admin gate rejection | PASS — `P0001: Only an org admin may set created_by_admin_id`, zero residue |
| 4 | Smoke test: admin fixture creation, auto-approve, calendar event | PASS — `status='approved'`, companion `calendar_events` row created |
| 5 | Smoke test: reverse job-assignment block | PASS — `P0001: Cannot assign job: technician has approved time off/blackout in this date range` |
| 6 | Cleanup fixture rows | PASS — 0 remaining rows across `time_off_requests`, `calendar_events`, `job_assignments` for the test tech |
| 7 | Correct two memory files describing this work | PASS — both re-read and verified after write |

All four live smoke-test assertions passed on the first attempt against production data shape, with the two write-path assertions (steps 4 and 5) cleaned up immediately after and confirmed at zero residue. No schema or trigger-logic changes were needed as a result of the smoke test — 0035 was correct as committed.

## Files changed

This report closes out work already committed in a prior turn; no source files were changed in this closeout turn itself.

- `app/supabase/0035_admin_time_off_blackout.sql` (committed `d5487c5`, prior turn)
- `app/modules/admin-finance/src/screens/BlackoutEditorScreen.tsx` (committed `d5487c5`, prior turn)
- `app/modules/admin-finance/src/screens/PriceEstimatingScreen.tsx` (committed `d5487c5`, prior turn — unrelated screen swept into the same commit at discovery time)
- `E:\Jeff\.claude\projects\E--Jeff-Codespace-SDAssemblyPros-Jobcore\memory\jobcore-time-off-blackout-migration-0035.md` (rewritten this cycle, via Nestor)
- `E:\Jeff\.claude\projects\E--Jeff-Codespace-SDAssemblyPros-Jobcore\memory\MEMORY.md` (index line corrected this cycle, via Nestor)

## Dispatch ledger

- Both memory-file writes (detail memory + `MEMORY.md` index line) were authored by **scribe-hound (Nestor)** per Rule 30, each verified by same-turn re-read; both returned PASS.
- The live SQL smoke-test statements (gate check, fixture insert, calendar-event confirm, reverse-block attempt, cleanup) were run directly against the hosted Supabase project via its SQL execution path, driven from the main session under Jeff's per-step "go" confirmation — not a hound dispatch, since these are live-database statements outside the Edit/Write file-write surface Rule 30 governs.
- This report itself is authored by **scribe-hound (Nestor)** per Rule 30.

## Verification

1. Non-admin gate check raises `P0001: Only an org admin may set created_by_admin_id` and persists nothing — CONFIRMED (single-statement transaction; exception unwound the insert).
2. Admin-created blackout fixture auto-sets `status='approved'` and inserts a companion `calendar_events` row — CONFIRMED via `returning` clause and a follow-up `select` against `calendar_events`.
3. Reverse-direction insert into `job_assignments` for the blacked-out tech/date raises `P0001: Cannot assign job: technician has approved time off/blackout in this date range` — CONFIRMED.
4. Cleanup deletes both fixture rows and a follow-up count query returns 0 across `time_off_requests`, `calendar_events`, and `job_assignments` for the test tech — CONFIRMED, zero residual data.
5. `jobcore-time-off-blackout-migration-0035.md` reflects the committed/applied/smoke-tested state — CONFIRMED via re-read after Nestor's write.
6. `MEMORY.md` index line matches the updated memory file's description — CONFIRMED via re-read after Nestor's write.

## Forward contracts

- none. Migration 0035 is fully committed, applied to the hosted database, smoke-tested clean in both directions, and documented in memory. No follow-up action is owed for this lineage.
- (Unrelated, pre-existing backlog, not opened by this cycle: migrations `0032_price_sheet_task_pricing.sql`, `0033_job_planning.sql`, and `0036_job_estimates.sql` remain pending/untouched per [[jobcore-price-sheet-migration-0032-partial]] and [[jobcore-supabase-migration-pending]] — explicitly out of scope for this cycle.)

## Deviations / Defects

- none. All four smoke-test assertions passed on the first attempt; cleanup confirmed zero residue; both memory corrections verified PASS on re-read.
- Minor process note (no output impact): during report lookup, an initial unscoped `Glob` for existing build reports was blocked by the search-performance hook (scoped-search-first rule); a mis-guessed scoped path (`app\.claude\build-reports`) then cleanly errored "directory does not exist" rather than timing out. The corrected repo-root path (`.claude\build-reports`, not under `app\`) resolved on the next attempt with no further impact.

## Delivery

Commit: `d5487c5` (migration + paired screens, prior turn; this report documents that commit's live-database application and smoke test, and is not itself a code commit).
Report copied to `E:\Jeff\Desktop\Build-Reports\` per Rule 8.
