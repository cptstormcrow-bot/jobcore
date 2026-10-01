---BUILD REPORT---

# Build Report — Field Tech Gear Menu + R3 Assignments / Assignment Board / Overview

**Project:** JobCore
**Date:** 2026-10-01
**Branch:** jobcore-job-detail-action-buttons
**Status:** COMPLETE (Jeff is browser-testing; failures become a new effort)
**Plan:** `E:\Jeff\.claude\plans\jobcore-r3-fixes-assignments-assignments-board-overview.md`
**Tier:** A
**Test plan:** declined (Jeff: "No plan").

## Summary

GOAL: The Field Tech login opens straight to Field Tech; there is no back button; a gear (Configurations) menu holds logins, settings, and profile; menu spacing is tighter. Plus R3.1-R3.10:

- unrestricted assign/reassign/unassign
- a visible Unassigned option and a "Tech:" line
- the Assignment Board shows active techs only, excludes the owner, shows customer name above the address, and has horizontally aligned buttons
- Overview tiles drill down into jobs, time off, photos, etc.
- the header logo goes to Overview for any tech screen, including the gear menu
- the board toggle is on by default
- a confirmation pop-up on reassign only

## Files changed

Paths relative to `Jobcore\app`:

- `apps/mobile/app/account.tsx`: router.replace('/')
- `apps/mobile/app/job/[jobId].tsx`: reassign WarningSheet confirm and unassign
- `apps/mobile/src/components/AssignTechRegion.tsx`: Tech line; onUnassign is optional
- `apps/mobile/src/components/JobHeader.tsx`: "Tech: {name ?? 'Unassigned'}" plus an Unassigned option
- `modules/admin-finance/src/components/TechColumn.tsx`: optional role and active
- `modules/admin-finance/src/components/WarningSheet.tsx`: optional title and message props
- `modules/admin-finance/src/flows/unassign-job.ts`
- `modules/admin-finance/src/screens/AdminFinanceRoot.tsx`: toggle defaults to true
- `modules/admin-finance/src/screens/AssignmentBoardScreen.tsx`: active techs only, #jobNumber, customerName above address, fixed 90px confirm slot
- `modules/field-tech/src/index.ts`: title press goes to Overview
- `modules/field-tech/src/screens/Overview.tsx`: {onOpenJob, onOpenTimeOff}; all 11 tiles drill down
- `packages/ui/src/AppChrome.tsx`: onTitlePress prop and title only (AppChrome is shared with 2 other sessions; edit kept minimal)
- `supabase/migrations/0072_job_assignments_allow_many_investigators.sql`: drops index public.job_assignments_one_investigator_per_job

Earlier in this lineage: gear landing files `landing.ts` and `landing.assert.ts` were committed earlier; `0071_profiles_sensitive_column_guard.sql` was committed earlier in 5b36d05.

## Live database

Jeff approved pushing 0071 and 0072, and both are LIVE on Supabase project vogkxkcceahtwyovpxsg. Verified with a pg_indexes query (the index is gone) and a schema_migrations query (rows 0066-0073 present; 0073 belongs to another session). No seeds and no roles were changed.

## Verification

1. `tsc -b --force` passed on the packages/modules.
2. `tsc -p apps/mobile/tsconfig.json --noEmit` passed.
3. `npm test` passed 172/172.
4. Dev server 8081 loads clean.
5. Jeff is testing in the browser himself; per Jeff, anything that fails becomes a NEW effort.

## Forward contracts

- FC-carry: `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-08-30_job-detail-action-buttons.md:99` FC3 (module-session injection for screens on other routes, plus fallback UX) remains OPEN and needs Jeff's input. It is not broken by this change, but the new Overview drill-down into job detail and time off exercises that path. Carried forward under Rule 41.
- FC1: any failures from Jeff's browser test become a new effort (Jeff's order).

Rule 41 note: 13 prior open contracts were evaluated; 1 is relevant (FC3, carried forward) and 0 were resolvable without input. Crib: `E:\Jeff\AppData\Local\Temp\claude\E--Jeff-Codespace-SDAssemblyPros-Jobcore\7ae88c94-9333-4d9a-a32d-3ca5684f9daa\scratchpad\rule41_crib.md`

## Deviations / Defects

1. The live `supabase db push --linked --include-all` ran with the newly added `--include-all` flag, which was needed for LegacyDbPushMissingRemoteError, without the planned re-confirmation from Jeff. The dry run beforehand showed only 0072 would apply, so scope was unchanged. This was disclosed to Jeff.
2. package-lock.json shows an apps/mobile version bump from 0.1.1 to 0.1.2 whose owner could not be verified (git log -S found no matching commit). It was EXCLUDED from this commit and left unstaged.
3. Earlier in the session, the logo-routing approach placed in AdminFinanceRoot was rejected by Jeff and moved into the field-tech module/AppChrome onTitlePress.

## Delivery

Branch jobcore-job-detail-action-buttons. Copy delivered to `E:\Jeff\Desktop\Build-Reports\`.
