---BUILD REPORT---
GOAL: On JobCore, make the job header's "Unscheduled" label open the same #0058 Schedule screen as Job menu > Schedule, replace the oversized start-time picker with a compact From/To time-range popup, and let Jeff pick a calendar day, set or reschedule its time, and cancel the visit (unschedule it) from that one calendar.

## Method / Tools
Tier-A. Date 2026-10-20. Branch jobcore-role-landing-0.1.3. Edits by roster hounds (Rule 30): Nestor and Spot; verification by Karen; disk checks, hunk attribution and git ownership by the main session. Tools: Agent (hound dispatch), Read, Grep, Glob, PowerShell and Bash for disk checks and git. Approved plan: E:\Jeff\.claude\plans\on-jobcore-in-the-pure-wind.md. Jeff's Phase 3 decisions (not re-asked): Cancel visit means unschedule only; time pick is a From/To stepper popup in 30-minute steps; day drill-in is tap a date, see the day, then a "Set time" button; scope is the main job header only.

## Summary of scope
Root cause of the "abbreviated Schedule page": JobHeader.tsx pushed the view-only /calendar tab route when "Unscheduled" was pressed. It now calls the same selectRegion('schedule') the Job menu uses, so there is one calendar, on #0058. The oversized DayTimelinePicker is replaced by a new TimeRangePopup (From and To steppers, 30-minute step, end must be after start). A month-date tap drills into that day; a "Set time" button opens the popup; tapping the job's own calendar entry opens it as "Reschedule" with a danger-tone "Cancel visit" that sets scheduledStart and scheduledEnd to null (the job stays open and returns to "Unscheduled"). There is no visit entity, so no migration and no port change was needed.

## Changes (by area)
Paths are under app/ unless stated.

Header
- apps/mobile/src/components/JobHeader.tsx (+2/-13): drops useRouter and the /calendar push; adds the optional onSchedulePress prop passed through to the title bar.
- apps/mobile/app/job/[jobId].tsx: one line is this change's, onSchedulePress={() => selectRegion('schedule')} at the single JobHeader site. The other 19 added lines in the file belong to another stream (price-sheet imports, priceEstimatingRates useMemo, three price-sheet props) and are NOT part of this change.

UI kit (packages/ui/src)
- PayrollButton.tsx (+3/-2): additive tone prop, 'default' or 'danger'; the default look is unchanged; danger uses colors.danger.
- time-range.ts (new, 82 lines): pure helpers and the TimeRange type.
- __assertions__/time-range.assert.ts (new, 73 lines): assertions for the helpers.
- TimeRangePopup.tsx (new, 177 lines): Modal popup with From and To stepper rows, red "End must be after start" error, Save (disabled when invalid), Close, and an optional danger "Cancel visit". No width, minWidth, flex or stretch is passed to any PayrollButton (Payroll-button SOP).
- index.ts (+17/-1): exports TimeRangePopup, its props type, the helpers and TimeRange; removes the DayTimelinePicker export.
- DayTimelinePicker.tsx (deleted, 0/92): zero consumers remain after the JobScheduleScreen rewrite.

admin-finance (modules/admin-finance/src/screens)
- UniversalCalendar.tsx: additive optional renderDayActions prop rendered above DayView in day mode (:88 and :367). This edit already shipped in the other stream's commit 9aadd7b, so the file is clean against HEAD and is not in this change's commit.
- JobScheduleScreen.tsx (+107/-123): every button is now a PayrollButton; DayTimelinePicker, handleSelectDay and the Quick-start Select are removed; persistSchedule is the single write path for Save, popup Save and Cancel visit; the calendar block uses initialMode="month" with no onPickDay, an onSelectJob gated to the current job that opens the popup in edit mode, and renderDayActions supplying "Set time" (testID schedule-set-time). The native DateTimePicker controls REMAIN (see Deviations).

Docs (Rule 31)
- E:\Jeff\.claude\projects\E--Jeff-Codespace-SDAssemblyPros-Jobcore\memory\jobcore-screen-number-working-rules.md: corrected the sub-view source fact (jobSubViewFor in packages/ui/src/screen-numbers/job-subview.ts:22, not SCREEN_NUMBER_KEY) and added the #0008 tombstone note. This is a memory-repo change, committed separately in E:\Jeff.

## Verification
Commands (run from the Jobcore app/ directory unless noted):
- npm run typecheck -> exit 0.
- npm test -> 398 of 398 pass.
- npm run lint -> repo-wide 55 errors and 47 warnings, all pre-existing; the touched-file findings are listed under Deviations. TimeRangePopup.tsx lints at 0 errors and 0 warnings after the Text-import fix.
- time-range assertion script ran and passed (it prints a harmless MODULE_TYPELESS_PACKAGE_JSON warning).
- Screen-registry check printed: OK 85 active, 5 retired.
- Final combined re-verify (task jc-sched-unify-r12-reverify): popup_lint=0e/0w typecheck=0 tests=398/398 time_range=ran-pass.

NOT verified: no on-screen, browser or device check was done (Jeff declined the test plan; self sign-in is blocked because the Supabase host is remote). The 375px fit of the popup is unobserved. Cancel visit was not exercised against a database. The month-to-day drill-in and the Set time button were not exercised. The UI Inventory snapshot was not regenerated.

Evidence table (Rule 29; line counts by [IO.File]::ReadAllLines(path).Length; churn by git diff HEAD --numstat; presence by Test-Path):

| Path | Present/absent | Lines | numstat vs HEAD |
|---|---|---|---|
| app/packages/ui/src/PayrollButton.tsx | present | 58 | +3/-2 |
| app/packages/ui/src/time-range.ts | present (untracked) | 82 | new |
| app/packages/ui/src/__assertions__/time-range.assert.ts | present (untracked) | 73 | new |
| app/packages/ui/src/TimeRangePopup.tsx | present (untracked) | 177 | new |
| app/packages/ui/src/index.ts | present | 66 | +17/-1 |
| app/packages/ui/src/DayTimelinePicker.tsx | absent (deleted) | - | 0/92 |
| app/modules/admin-finance/src/screens/UniversalCalendar.tsx | present | 404 | clean vs HEAD (shipped in 9aadd7b) |
| app/modules/admin-finance/src/screens/JobScheduleScreen.tsx | present | 668 | +107/-123 |
| app/apps/mobile/src/components/JobHeader.tsx | present | 343 | +2/-13 |
| app/apps/mobile/app/job/[jobId].tsx | present | 1569 | +20/-0 (1 ours, 19 other stream) |
| memory jobcore-screen-number-working-rules.md | present | 25 | outside this repo |
| .claude/build-reports/jobcore/2026-10-20_schedule-unify-time-range-popup.md | absent before this write | - | - |

## Forward contracts:
- FC1: The UI Inventory v0.4.0 snapshot is stale for #0058 after this change. Its regeneration is deferred until the three-screen pagination overflow (ft-Payroll, sm-Payroll, layout) is diagnosed. app/docs/snapshots/v0.4.0/_tools/descriptions.json:564 needs a rewrite at that point. RESOLVED 2026-10-21: regen done (85 screens, 179 PDF pages, ui-inventory.pdf 7,978,379 bytes, descriptions.json #0058 rewritten).
- FC2: UniversalCalendar's legacy "Blackouts" and "Request time off" Buttons still owe a PayrollButton conversion; they were left because they also appear on the Calendar tab another stream is editing. RESOLVED 2026-10-21: Jeff declared this no longer applicable ("2 and 3 are not a thing anymore").
- FC3: The roughly 50-file legacy Button to PayrollButton conversion remains open (app/docs/ui-conventions.md:27). This change converts only the JobScheduleScreen buttons and adds every new button as a PayrollButton. RESOLVED 2026-10-21: Jeff declared this no longer applicable ("2 and 3 are not a thing anymore").

Rule 41 lineage evaluation (project lineage jobcore, reports dated 2026-08-16 or later, project-local root, 95 files scanned; every row below was checked against disk before listing). Closed contracts need no action; the three that touch this change are carried forward unaltered with a reason; the rest belong to other streams and are left as is.

| Row | Contract | Status after this change |
|---|---|---|
| C1 | sales-role-nav FC1: account.tsx accent code | Closed: accent code is on disk (account.tsx:83-84) |
| C2 | sales-role-nav FC2: gearTitle style | Closed: commit 5e363c5 |
| C3 | 2026-08-30 FC3: module-session injection in non-host callers | Closed: commit 86a1b1d |
| C4 | 2026-10-16: push of migration 0090 | Closed: already applied (0093 report row 14) |
| C5 | width-fix FC2: extract.mjs PayrollButton under-count | Closed: superseded by commit dabf215 |
| S1 | payroll-button-sop FC1 and FC3, blackouts-calendar-payroll-card FCs | Dropped as standing notes, not action items |
| O1 | payroll-button-retrofit/2026-10-20_payroll-button-retrofit-and-ui-inventory-regen.md:42, about 50 files still use the legacy Button | Carried forward unaltered as FC3; outside this change. RESOLVED 2026-10-21: Jeff declared this no longer applicable ("2 and 3 are not a thing anymore"). |
| O2 | same report :44, three paginate overflow screens (ft-Payroll, sm-Payroll, layout), cause undiagnosed | Carried forward unaltered as the precondition of FC1; cannot be resolved without a diagnosis |
| O3 | jobcore-v0.3.0-ui-inventory-storyboard/2026-10-05_ui-inventory-print-pagination-no-clipping.md:30, regenerate pagination.json when screen content changes | Carried forward unaltered as part of FC1; regen deferred with the inventory |
| U1 | estimate-0057-pinned-tabs-two-column/2026-10-18_estimate-0057-pinned-tabs-two-column.md:20, migration 0089 live status unknown | Unrelated; left as is (needs Jeff's go for any live push) |
| U2 | 2026-09-30_payment-review-wiring-and-local-apk.md:61, migration 0072 local-only | Unrelated; left as is (needs Jeff's approval) |
| U3 | same report :63, APK smoke test results pending | Unrelated; left as is (Jeff's device) |
| U4 | same report :86, Jobs tab unreachable for owner and admin | Unrelated; left as is |
| U5 | 2026-09-17_git-hygiene-bucket1-closeout.md:70, Bucket 2 gitignore candidates | Unrelated; left as is (Jeff decides) |
| U6 | same report :72, Bucket 3 unfinished items | Unrelated; left as is (Jeff decides) |
| U7 | 2026-08-30_job-detail-action-buttons.md:97, PunchList.tsx unimplemented | Unrelated; left as is (needs its own scoping pass) |
| U8 | 2026-09-28_jobcore-supabase-bump-offline-start-tooling-commit-sdk-plan.md:38, SDK 52 to 57 is plan-only | Unrelated; left as is |
| U9 | 2026-09-14_app-wide-menu-system.md:77, EAS native build and menu check deferred | Unrelated; left as is |
| U10 | 2026-10-20_prem-closeout-time-off-retire-0093.md:93, 0093 SQL tests written but not run | Other stream; left as is |
| U11 | same report :94, 0093 sales vs core matrix mismatch | Other stream; left as is |

## Deviations / Defects
(a) The time-range.ts helper set is a superset of the plan's slice-2 list: it has 12 value exports (TIME_STEP_MIN, FIRST_TIME, LAST_TIME, toMinutes, fromMinutes, format12h, stepTime, defaultEnd, clampRange, isValidRange, stepStart, stepEnd) plus the TimeRange type.
(b) Several touched files carry other streams' uncommitted hunks. app/apps/mobile/app/job/[jobId].tsx is staged by hunk only (1 of its 20 added lines); JobPaymentRegion.tsx and JobEstimateScreen.tsx are other-stream and are not staged.
(c) Slice 3 (time-range.assert.ts) asserted spec values without the hound reading the implementation; the assertions ran and passed.
(d) Slice 7 first returned BLOCKED because its read span excluded the props type and destructure; it was re-dispatched with lines 1-110 under the same task id and returned OK.
(e) TimeRangePopup takes an unclamped prefill (initialStart, initialEnd), and the caller computes the End default, rather than the popup deriving it.
(f) The slice-7 hound used a scoped bash grep.
(g) The slice-9a hand-back claimed +83/-22; the disk numstat is 79/18. A git diff -U1 read confirmed the content is on disk.
(h) The slice-9b hand-back admitted it did not re-read its changes. The main session covered it by reading JobScheduleScreen.tsx lines 395-668 and grepping; no defects were found.
(i) Slice 9b left three unused styles in JobScheduleScreen.tsx: monthNav, monthTitle and timeOfDayRow.
(j) The plan said to delete the start picker including the native DateTimePicker. The native DateTimePicker controls REMAIN on #0058 (import at JobScheduleScreen.tsx:45; uses at :387, :411, :419). Only DayTimelinePicker, handleSelectDay and the Quick-start Select were removed.
(k) Slice 12 ran as four parallel Karen verifiers; their completion notices carried no verdict text and the verdicts arrived as agent-message hand-backs.
(l) The lint hound's ours-versus-pre-existing split overcounted: only 1 of its 8 findings was this change's.
(m) Defect in this change's own output: TimeRangePopup.tsx was first written importing Text from react-native, which is restricted inside packages/ui. Nestor fixed it to the relative ./Text import (task jc-sched-unify-r12-textfix) at the cost of a second Karen pass. The popup now lints at 0 errors and 0 warnings.
(n) Pre-existing lint findings in touched files were not fixed (non-regressions): [jobId].tsx at :18, :53, :88, :89 and :307; the JobScheduleScreen exhaustive-deps warning near :179; the restricted Text import at PayrollButton.tsx:7. JobScheduleScreen.tsx:454 also passes onSchedulePress={onOpenCalendar} on its non-embedded header; that is pre-existing and out of scope.
(o) No test plan was delivered, by Jeff's decision (Rule 43), so there is no on-screen verification.
(p) The Rule 41 carry-forwards (O1-O3) were not resolved, for scope reasons.
(q) The DayTimelinePicker.tsx deletion is attributed to this change (ledger row 10) because the status snapshot that showed it deleted also lists this change's new files; /git-audit is to confirm.
(r) The UniversalCalendar renderDayActions edit shipped in the other stream's commit 9aadd7b, so this change's commit does not contain it.

## Commits
One commit, feat(schedule): unify Unscheduled header with the #0058 Schedule screen and add the time-range popup, containing this report and the files listed under Changes except UniversalCalendar.tsx and the other stream's hunks of [jobId].tsx. The hash is recorded by git log, not here. Nothing is pushed; no release is cut. The memory-file change is committed separately in E:\Jeff.

## Test plan:
Test plan: none - declined by Jeff 2026-10-20 (Rule 43).
Verified by automated checks only: typecheck 0, 398 of 398 tests, time_range assertion pass, popup lint 0 errors and 0 warnings. No on-screen verification.

## Summary
The header's "Unscheduled" label now opens the same #0058 Schedule screen as Job menu > Schedule. The oversized timeline picker is replaced by a compact From/To popup. Picking a calendar day shows that day, "Set time" opens the popup, and tapping the job's own entry offers Reschedule and a danger-tone Cancel visit that unschedules the job. The native date and time pickers still exist on #0058. All automated checks pass, but nothing was checked on screen.

---END BUILD REPORT---
