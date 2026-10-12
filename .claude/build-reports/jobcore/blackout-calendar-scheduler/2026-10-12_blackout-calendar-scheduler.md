---BUILD REPORT---
GOAL: #0056 Add Blackout becomes a Month/Week calendar scheduler, looking like #0031 Field Tech Time off request.

RoA: jobcore / BUILD
Plan: distributed-mapping-plum (E:\Jeff\.claude\plans\distributed-mapping-plum.md) | Date: 2026-10-12 | Status: COMPLETE
Why: Jeff's request (verbatim): "Add blackout screen #0056 should allow scheduling of time off by clicking into the Monthly default calendar with the list of time-offs underneath. It should look more like #0031 Field Tech Time off request and should default to monthly but persistent to weekly if chosen."
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\blackout-calendar-scheduler\2026-10-12_blackout-calendar-scheduler.md

Summary:
- One commit on branch jobcore-role-landing-0.1.3: 266c3ee (11 files, 754 insertions, 307 deletions). No push, no migration, no tag.
- Month is the default view; choosing Week is remembered on this device (local preference key 'admin-finance.blackout.week-view', true = weekly) and is not synced across devices.
- The screen now has a tech picker (All Techs default), a Month calendar with a Week option, tap a day to open the schedule modal, the time-off list underneath, and a Done button.
- Verification: full tsc -b --force clean; per-project tsc --noEmit for admin-finance, field-tech and ui all exit 0; npm test from app/ = 300 pass, 0 fail (field-tech day-list-helpers suite unchanged). No browser check by the agent.

Files (all under app/):
New:
  packages/ui/src/DateRangeCalendar.tsx (201 lines, moved verbatim from field-tech),
  modules/admin-finance/src/screens/blackout-calendar-logic.ts (71 lines, no React: week-view key, mode read/write, tech filter, blackout-to-calendar-event expansion for pending and approved only),
  modules/admin-finance/src/screens/BlackoutTimeOffList.tsx (46 lines),
  modules/admin-finance/src/screens/BlackoutRangeModal.tsx (118 lines),
  modules/admin-finance/src/__assertions__/blackout-calendar-logic.assert.ts (106 lines, 6 tests)
Modified:
  packages/ui/src/index.ts (+1 line, exports DateRangeCalendar),
  modules/field-tech/src/screens/DateRangeCalendar.tsx (now a 3-line re-export shim, so TimeOff.tsx #0031 is untouched),
  modules/admin-finance/src/screens/BlackoutEditorScreen.tsx (rewritten, 291 lines, new optional onChanged prop),
  modules/admin-finance/src/screens/AdminFinanceRoot.tsx (+1 line, onChanged={refreshJobs}),
  package.json (1 line, adds the new assertion file to the test script),
  modules/admin-finance/src/data/time-off-repo.ts (comments only, 10 insertions, 11 deletions, fixes stale approve/deny comments)

Test plan: Jeff declined a test plan at the Rule 43 gate (2026-10-12). Non-Tier-A no-self-check caveat applies: the screen has not been visually checked by anyone; the on-device Month/Week persistence and the tap-day-to-save flow are unverified by eye.

Forward contracts:
- The field-tech DateRangeCalendar.tsx is now a re-export shim of @jobcore/ui. Any later removal of the shim must first repoint field-tech/TimeOff.tsx (#0031) to import from @jobcore/ui.
- Rule 41 check done 2026-10-12: the lineage's open contracts (0.4.0 release step, estimate role gating FC-2, service_task_id in commission FC-3, payout-batch parameter mismatch, and the rest listed in 2026-10-11_apk-0-4-0-build.md) are unrelated to this change and none was resolvable here; they remain open and untouched.

## Deviations / Defects
- Plan premise false: the plan said the screen registry carries a per-screen description to edit. It has no description field, so no registry edit was made (app/apps/mobile/src/screens/screen-registry.json not committed).
- app/apps/mobile/src/screens/screen-registry.json has a pre-existing 2-line diff belonging to other work; deliberately excluded from the commit, as were admin-finance/package.json, package-lock.json and every other dirty file.
- Rule 31 doc sweep covered only md, txt, mdx, rst and html files; it found nothing stale and there was no version-history page to update.
- Migration 0035's live status (applied and smoke-tested 2026-08-27) comes from a 45-day-old memory and was not re-verified today. No new migration was needed.
- The DB does not block overlapping blackouts for one tech; accepted, not changed.
- DEFERRED (Jeff's choice, 2026-10-12): regeneration of the v0.4.0 UI Inventory snapshot, so the inventory still shows the old #0056 form. Generator: docs/snapshots/v0.4.0/_tools/ (generate.mjs, render-pdf.py).
