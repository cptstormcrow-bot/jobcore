---BUILD REPORT---

# Service Area Error — Fix

**Date:** 2026-09-02
**Project:** JobCore (`E:\Jeff\Codespace\SDAssemblyPros\Jobcore`)
**Branch:** jobcore-job-detail-action-buttons
**Plan:** `E:\Jeff\.claude\plans\flickering-munching-zebra.md` (renamed to "Service Area Error" per user request)

## Goal

User report: "I am still getting 'This job is outside a known service area.' when I try to assign a job to a technician in JobCore. Can we just fix it?"

User selected scope via AskUserQuestion: **Fix existing + new jobs (Recommended)** — three parts:
1. Widen the repo/type layer to carry `serviceAreaId` on job-details patches.
2. Widen the existing-job edit UI to let an already-created job's service area be set/changed.
3. Widen the live job-creation UI to let service area be chosen at creation time (instead of hardcoding `null`).

## Root Cause

No automatic address→service-area resolution exists anywhere in JobCore. `service_area_id` was set to non-null only via the manual picker in `QualifyScreen.tsx` during Lead→Qualify conversion. Every other job-creation path hardcoded `serviceAreaId: null`, so most jobs never had a service area, and the assignment board's warn-only check ("This job is outside a known service area.") fired constantly. The assignment board itself (`AssignmentBoardScreen.tsx`) was confirmed correct and required no changes — it is warn-only per spec `03-P3-admin-finance.md` §4, not the bug source.

Two additional, previously-undiscovered defects in `app/apps/mobile/app/job/[jobId].tsx` compounded the problem — see Deviations / Defects below.

## Changes Made

### 1. `app/modules/admin-finance/src/data/ports.ts`
Added `serviceAreaId?: string | null;` to the `JobDetailsPatch` type, so a job-details-patch update can now carry a service area change:

```diff
 export type JobDetailsPatch = Partial<Pick<Job, 'address' | 'description' | 'houseAgeYears'>> & {
+  serviceAreaId?: string | null;
   permitStatus?: string | null;
   parkingAvailable?: string | null;
   rooms?: string[] | null;
```

### 2. `app/apps/mobile/src/lib/admin-finance-repos.ts`
Wired `JobDetailsPatch.serviceAreaId` through to the Supabase update payload's `service_area_id` column, inside `createJobRepository()`'s details-patch update path:

```diff
           house_age_years: patch.houseAgeYears,
           scheduled_start: patch.scheduledStart,
           scheduled_end: patch.scheduledEnd,
+          service_area_id: patch.serviceAreaId,
         })
```

### 3. `app/apps/mobile/app/job/[jobId].tsx`
The primary file. Implements all three plan-scope items plus fixes the two defects below (58 insertions, 2 deletions total):

- `JobRow` interface: added `service_area_id: string | null;`
- `toJob()`: added `service_area_id: row.service_area_id,`
- `JOB_ROW_COLUMNS` select-string constant: appended `, service_area_id`
- `JobFormState` interface: added `serviceAreaId: string | null;`
- `EMPTY_JOB_FORM`: added `serviceAreaId: null,`
- Existing-job load/seed block: now seeds `serviceAreaId: loaded.service_area_id ?? null,` (previously read a stale `(loaded as any).serviceAreaId` cast — see Defect #2 below)
- Job-details-patch save handler: added `serviceAreaId: form.serviceAreaId,` to the outgoing `JobDetailsPatch` object
- Job-creation handler: changed hardcoded `serviceAreaId: null,` to `serviceAreaId: form.serviceAreaId,`
- Added two new "Service area" picker UI blocks (one in the existing-job edit view, one in the new-job creation view), each rendering an "Unassigned" button plus one button per entry in the existing `serviceAreas` list (`variant="primary"` when selected, else `"outline"`), calling `setForm((prev) => ({ ...prev, serviceAreaId: ... }))` on press. Both blocks are guarded by `{serviceAreas.length > 0 && (...)}`. The `serviceAreas` list itself was already fetched via a pre-existing `createServiceAreaRepository().listForOrganization(org.id)` call (pre-existing infra, originally built for `QualifyScreen.tsx`'s picker) — this fix reused that existing fetch rather than adding new plumbing.

## Verification

- `npm run typecheck` (`tsc --build --verbose`) — **clean, zero errors**, all 8 projects report "up to date," including `apps/mobile/tsconfig.json` after the `[jobId].tsx` edit. Full output re-read and re-confirmed with no `error TS...` lines present.
- `AssignmentBoardScreen.tsx` reviewed and confirmed unchanged/correct — warn-only per spec, not the defect source.
- `app/modules/admin-finance/src/screens/JobScheduleScreen.tsx` — grepped for `serviceAreaId|service_area_id`, zero matches; confirmed no changes needed there.
- `app/packages/core/src/index.ts` (shared `Job` type) — confirmed unchanged; the fix conformed `[jobId].tsx` to the type's existing (anomalous, snake_case) `service_area_id?: string | null;` field rather than modifying the shared type.

## Deviations / Defects

1. **Defect — `JobRow`/`JOB_ROW_COLUMNS`/`toJob()` gap in `[jobId].tsx`.** This file maintained its own local, duplicate `JobRow` interface, `toJob()` function, and `JOB_ROW_COLUMNS` select-string constant, none of which round-tripped `service_area_id` from Supabase. This meant an existing job's service area (even when set) never reached the edit screen. Fixed as part of this change (see file #3 above).
2. **Defect — TS2561 compile error plus a co-located latent runtime data-loss bug.** While implementing the fix, `tsc --build` initially failed with `TS2561: Object literal may only specify known properties, but 'serviceAreaId' does not exist in type 'Job'. Did you mean to write 'service_area_id'?` at `[jobId].tsx(111,5)`. Root cause: the shared `Job` interface in `app/packages/core/src/index.ts` declares this field as `service_area_id` (snake_case), an anomaly versus every other camelCase field on that interface. The pre-fix code also had a stale `(loaded as any).serviceAreaId` cast in the existing-job load/seed path — using the `any` cast silenced the compiler but meant this read was **always `undefined`** at runtime, since the real field is `service_area_id`. Left uncorrected, this would have been a silent data-loss bug: an existing job's service area would never populate into the edit form, and re-saving the job could have overwritten a correctly-set `service_area_id` back to null. Fixed by conforming `toJob()` and the form-seed line to the real field name; no change was needed to the shared `Job` type itself.
3. **Process note.** An earlier attempt at this fix was mis-routed to the wrong write-hound (Spot) and did not complete; the fix was subsequently completed correctly via the "Nestor-ServiceAreaGap" and "Nestor-ServiceAreaCasing" dispatches referenced above. No code defect resulted — the mis-routed attempt made no partial writes.

No other deviations. No rule breaches.

## Forward Contracts

1. **`app/apps/mobile/app/(tabs)/jobs.tsx` likely shares the same gap.** This file was flagged (via a header comment in `[jobId].tsx` found during investigation) as sharing the same fetch-by-id-plus-`toJob()` pattern used by the now-fixed `[jobId].tsx`. It was **not inspected or changed** in this fix — out of the approved plan's scope. If it has its own local `JobRow`/`toJob()` duplicate with the same `service_area_id` omission, it would have the same defect. Deferred; not to be fixed without the user's explicit go-ahead.

No other forward contracts. This report does not describe, and is fully independent of, the separate "Job Estimate Wave 2" lineage (migrations 0032/0036/0037, commits `80f2ed5` and `62ec98f`), which was already closed out earlier in this session.

---END BUILD REPORT---
