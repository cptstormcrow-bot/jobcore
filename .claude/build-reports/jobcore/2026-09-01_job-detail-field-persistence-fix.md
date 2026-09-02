# Job Detail Field Persistence Fix

**Date:** 2026-09-01
**Branch:** claude/nice-lovelace-3d5d2c
**Trigger:** User bug report — `JobRepository.updateDetails()` silently dropped five job-detail fields on save.

## Root cause

`JobDetailsPatch` (`app/modules/admin-finance/src/data/ports.ts`, ~lines 145-153) declares five optional fields — `permitStatus`, `parkingAvailable`, `rooms`, `panelInfo`, `considerations` — and `app/apps/mobile/app/job/[jobId].tsx`'s `handleSaveEdit` populates all five on every edit-mode save. However, `JobRepository.updateDetails()`'s Supabase `.update({...})` object in `app/apps/mobile/src/lib/admin-finance-repos.ts` (~lines 256-277) never mapped these five fields to their snake_case columns, so any edit to them was silently discarded on write. `create()`'s `.insert({...})` object had the identical omission for the same five fields.

A symmetric read-side bug existed in the shared `toJob()` mapper (`ports.ts`, ~lines 90-117): it correctly mapped `service_area_id` but had no return-value mappings for `permit_status`, `parking_available`, `rooms`, `panel_info`, or `considerations` — so even a correctly-written value would not round-trip back into the `Job` domain object a caller reads after `updateDetails()`/`create()`.

`JobRow` already declared all five snake_case columns, and `JobDraft` (`app/modules/admin-finance/src/domain/qualify.ts`, lines 53-73) already declared all five camelCase fields as optional-nullable — no type changes were needed anywhere.

## Fix (commit d5fa8d865f349a6e62d3113d9c5190571ebee956 — fix(jobcore): persist permit/parking/rooms/panel/considerations on job update+create)

**`app/apps/mobile/src/lib/admin-finance-repos.ts`** — added the five snake_case keys to both the `updateDetails()` `.update({...})` object and the `create()` `.insert({...})` object, mirroring the existing `house_age_years: patch.houseAgeYears` pattern:

```diff
@@ -263,6 +263,11 @@ export function createJobRepository(): JobRepository {
           address: patch.address,
           description: patch.description,
           house_age_years: patch.houseAgeYears,
+          permit_status: patch.permitStatus,
+          parking_available: patch.parkingAvailable,
+          rooms: patch.rooms,
+          panel_info: patch.panelInfo,
+          considerations: patch.considerations,
           scheduled_start: patch.scheduledStart,
           scheduled_end: patch.scheduledEnd,
         })
@@ -296,6 +301,11 @@ export function createJobRepository(): JobRepository {
           scheduled_end: rest.scheduledEnd,
           address: rest.address,
           description: rest.description,
+          permit_status: rest.permitStatus,
+          parking_available: rest.parkingAvailable,
+          rooms: rest.rooms,
+          panel_info: rest.panelInfo,
+          considerations: rest.considerations,
           assigned_tech_id: rest.assignedTechId,
           service_area_id: serviceAreaId,
         })
```

**`app/modules/admin-finance/src/data/ports.ts`** — added the five camelCase mappings to `toJob()`, mirroring the existing `houseAgeYears: row.house_age_years ?? null` pattern:

```diff
@@ -112,6 +112,11 @@ export function toJob(row: JobRow): Job {
     createdAt: row.created_at,
     isBeta: row.is_beta ?? false,
     houseAgeYears: row.house_age_years ?? null,
+    permitStatus: row.permit_status ?? null,
+    parkingAvailable: row.parking_available ?? null,
+    rooms: row.rooms ?? null,
+    panelInfo: row.panel_info ?? null,
+    considerations: row.considerations ?? null,
     service_area_id: row.service_area_id,
   };
 }
```

No other lines changed in either file. `app/modules/admin-finance/src/domain/qualify.ts` was inspected and required no changes — `JobDraft` already declared all five fields correctly.

## Verification

- **Diff review**: both diffs confirmed minimal and isolated (10 insertions in `admin-finance-repos.ts`, 5 insertions in `ports.ts`; zero deletions in either).
- **Typecheck**: `npm install --no-audit --no-fund` (required — this worktree had no `node_modules`) completed successfully (1429 packages), then `npm run typecheck` (`tsc --build --verbose`) completed with **zero errors** across all 8 workspace projects (`packages/core`, `packages/module-sdk`, `packages/ui`, `modules/admin-finance`, `modules/field-tech`, `modules/sales-marketing`, `apps/mobile`, root).
- **Call-site tracing**: `app/apps/mobile/app/job/[jobId].tsx` was confirmed by inspection to already correctly wire all five fields end-to-end — local type fields, row→domain mapper, select-column-list string, form-state type, default form-state initializer, edit-form hydration, and save-payload objects for both edit and create paths. No changes needed there.
- **Live Supabase exercise**: skipped, matching the precedent set by `2026-08-31_add-employee-duplicate-invitation-fix.md` — this is a native Expo mobile app with no browser/simulator target available in this environment for interactive exercise.

## Rule 41 pre-write gate (lineage check)

Searched `.claude/build-reports/jobcore/` for prior reports touching `admin-finance-repos.ts`, `ports.ts`, `JobDetailsPatch`, `updateDetails()`/`create()`, or `toJob()`. Three candidates were read in full:

- `2026-08-27_employee-detail-screen-ux-fixes.md` — Forward contracts: "None." Its Deviations section noted an unrelated uncommitted price-sheet/task-pricing diff present in the working tree at that time; that diff is not present in the current working tree and is unrelated to this lineage.
- `2026-08-30_job-detail-action-buttons.md` — 5 Forward contracts (PunchList.tsx implementation, Estimate-flow editable-until-scheduled gate, field-tech null-session UX reconciliation, Payment Received scoping, price-sheet migration 0032 schema catch-up). None touch `JobDetailsPatch`, `updateDetails()`/`create()`, `toJob()`, or the five target fields. The migration-0032 item is already resolved (applied+smoke-tested 2026-09-01, per memory `jobcore-price-sheet-migration-0032-applied.md`). This report's typecheck failure list is attributable entirely to the price-sheet-repo.ts schema gap, a different already-resolved root cause — unrelated to this fix's clean typecheck run.
- `2026-08-31_add-employee-duplicate-invitation-fix.md` — Forward contracts: "none from this change itself"; carries forward 7 unrelated items plus a migration-0033 note, now resolved (0033_job_planning.sql applied, per Job Estimate Feature Wave 2, 2026-09-01). None relate to this lineage.

**Conclusion**: no genuinely open Forward contract in this project's lineage pertains to `JobDetailsPatch`, `updateDetails()`/`create()`, `toJob()`, or the five target fields. This is a first-time bug-fix lineage — nothing to resolve or ask the user about before authoring this report.

## Deviations / Defects

- An earlier working assumption that "no test runner is configured anywhere in the repo" was incorrect: the repo has a lightweight native test runner (Node's built-in `--test` over `*.assert.ts` files under each module's `__assertions__/` directory, wired via `app/package.json`'s `test` script). This does not change the user's explicit decision to skip automated tests for this fix (see Forward contracts) — noted here only as a correction to the record.
- The `npm run typecheck` verification run used `/tmp/typecheck-out.txt` as a `tee` target rather than the designated scratchpad directory. No practical effect — the authoritative output was read via the harness's task-output mechanism, not the `/tmp` file. The stray file was not part of this repo and was not committed.
- `app/package-lock.json` was modified as a side effect of the required `npm install` (this worktree had no `node_modules`). Diagnosis: benign, pre-existing drift — four `package.json` files (`app/apps/mobile`, `app/modules/admin-finance`, `app/modules/field-tech`, `app/modules/sales-marketing`) already declared `expo-clipboard: ~7.0.0` as a committed dependency, but the lockfile had not been regenerated to match. This session's `npm install` simply caught the lockfile up to already-committed `package.json` state; none of those four `package.json` files show as modified in `git status`. Included in this fix's commit rather than left out of sync.
- The live Supabase exercise described in the approved plan's verification section was skipped (see Verification above) — decision made in-session, matching prior precedent for the same environmental constraint (no interactive target available for a native Expo app).

## Forward contracts

None from this change itself.