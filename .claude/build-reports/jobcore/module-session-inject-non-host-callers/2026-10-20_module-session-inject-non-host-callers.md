# Build Report: inject admin-finance module session in non-host callers
Date: 2026-10-20. Branch: jobcore-role-landing-0.1.3. Commit: 86a1b1d "fix(mobile): inject admin-finance module session in non-host callers". Not pushed.

## Summary
Screens and callers outside the module host called admin-finance repositories without a module session injected, so requireModuleSession() threw. The session is now injected synchronously in the render body of every non-host caller. admin-finance has two module-session instances: the package/dist copy and the relative source copy at modules/admin-finance/src/lib/module-session. apps/mobile/src/lib/admin-finance-repos.ts reads only the source copy, so the source copy is what these callers inject. Render-body injection is used rather than useEffect because child effects fire before parent effects. The setters are idempotent module-scope writes. Cleanup stays in an effect keyed on [module?.id].

## Files changed (4 files, +31/-1; verify with `git show --stat 86a1b1d`)
- app/apps/mobile/app/m/[moduleId].tsx (+16/-1): module host also injects the source-copy session and ports; cleanup clears both copies on module switch/unmount.
- app/apps/mobile/app/config/test-jobs.tsx (+7): render-body setAdminFinanceSourceModuleSession guarded by session.status === 'authenticated'. Standalone screen, so no cleanup. job-simulator.ts calls estimates.upsertForJob and payments.recordManualPayment through requireModuleSession().
- app/apps/mobile/app/(tabs)/calendar.tsx (+7): import plus render-body inject. Only this fix's hunks were committed.
- app/apps/mobile/app/job/[jobId].tsx (+2): import plus one inject call after the existing setModuleSession(...). Only this fix's hunks were committed.
Session shape: { org, role, userId }, gated on status === 'authenticated'.

## Verification
tsc passed (disk-verified earlier in the session). The commit is BOM-free, carries the Co-Authored-By trailer, left an empty index, and was not pushed. Rule 31: swept, no stale doc and no doc edit needed (app/CHANGELOG.md:27 and handoff/P3-SLICE-LEDGER.md rows 62 and 80 are historical; docs/snapshots/v0.4.0/_tools/screens.json is generated and point-in-time).

## Rule 41 gate
Prior open Forward contracts in this lineage (since 2026-10-18) were evaluated: migration 0089 live-apply status unknown (app/supabase/migrations/0089_estimate_redlines.sql); possibly stale tab/prop refs at AdminFinanceRoot.tsx ~L1032-1047 and admin-finance-repos.ts ~L3026-3036; PayrollButton standing-button contract with about 50 files still on the legacy Button; three paginate overflow screens (ft-Payroll, sm-Payroll, layout) still open; Jeff's app-wide Button.tsx visual pass. None touches module-session injection. They are neither honored nor reopened by this change and stay open as declared. The extractor under-count contract was already superseded by dabf215.

## Forward contracts:
none

## Deviations / Defects
- Nestor's earlier report said +8 for test-jobs.tsx. Disk shows +7. The +7 figure is authoritative.
- An earlier session summary said +3 for [jobId].tsx. The commit shows +2. The +2 figure is authoritative.
- calendar.tsx and [jobId].tsx were partially staged at hunk level. The unrelated in-flight work in those files was left unstaged and uncommitted.
- Unrelated in-flight work remains uncommitted in the working tree and was not touched: JobHeader.tsx, JobPaymentRegion.tsx, screen-registry.json, payout-batch-repo.ts, overview-cards.ts, approve-estimate.ts, AdminFinanceRoot.tsx, JobScheduleScreen.tsx, PlanningScreen.tsx, UniversalCalendar.tsx, PayrollButton.tsx, packages/ui/src/index.ts, docs/snapshots/v0.4.0/*, deleted TimeOffQueueScreen.tsx and DayTimelinePicker.tsx, and untracked CalendarTimeOffSection.tsx, TimeRangePopup.tsx, time-range.ts, time-range.assert.ts and the three 0093 migration/test files.
- LF-to-CRLF git warnings were informational only.

## Test plan:
Declined by Jeff ("no test plan"), Rule 43 answer.

## DEFERRED
none
