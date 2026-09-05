---BUILD REPORT---

# Field-tech Time Off date-tap modal + calendar week/month toggle

Date: 2026-09-05
Project: jobcore
Branch: jobcore-job-detail-action-buttons
Tier: A
Commit: (filled by closeout commit — see git log for "feat(jobcore): time-off date-tap modal + week/month calendar toggle")
Built via: Rule 38 rolling slices S1–S6 (Nestor scribe hound per slice, Marmanduke crib), Ultracode ON

## Goal
Jeff's smoke-test feedback on the field-tech Today's Jobs / Time Off feature (commit 04bc445):
- B5/C2: Time Off calendar date tap opens a modal with the selected range, a reason field, and Submit; a single tap defaults end = start (replaces the "big blue circle then scroll to bottom" flow).
- B1/B2: field-tech calendar gains a week/month view toggle, prev/next arrows in both views, and a Today button.

## Decisions locked
Modal is a React Native `Modal` inside TimeOff.tsx driven by `showRequestModal`, opened from a new `onDayTapped` callback on DateRangeCalendar; MonthView is a new shared component in packages/ui (WeekView untouched); DayList holds `viewMode: 'week' | 'month'` state with shared Prev/Today/Next controls; date math via date-fns ^4.4.0; week starts Sunday (unchanged).

## Files changed (5 files; 4 tracked 127+/27−, `git diff --stat -- <4 tracked files>`; 1 new untracked)
- app/modules/field-tech/src/screens/DateRangeCalendar.tsx (+19, onDayTapped callback)
- app/modules/field-tech/src/screens/TimeOff.tsx (62 diff lines, showRequestModal + Modal with range/reason/Submit, single tap end=start)
- app/modules/field-tech/src/screens/DayList.tsx (72 diff lines, viewMode toggle, MonthView wiring, Prev/Today/Next for both views)
- app/packages/ui/src/MonthView.tsx (NEW, 159 lines, 4357 bytes)
- app/packages/ui/src/index.ts (+1, export MonthView)

## Verification gates (Rule 29-B)
- `cd app && npx tsc --noEmit -p . 2>&1 | wc -l` → `0` (EXIT=0). Note: memory jobcore-themis-2026-09-04-leads-screen-findings recorded "TimeOff.tsx refactor blocks typecheck"; typecheck now passes.
- `git diff --stat -- app/modules/field-tech/src/screens/DateRangeCalendar.tsx app/modules/field-tech/src/screens/TimeOff.tsx app/modules/field-tech/src/screens/DayList.tsx app/packages/ui/src/index.ts` → 4 files changed, 127 insertions(+), 27 deletions(-).
- `git diff -- app/packages/ui/src/WeekView.tsx | wc -l` → `0` (WeekView untouched; consumers calendar.tsx / AdminFinanceRoot.tsx / EmployeeDetailScreen.tsx unaffected).
- `git status --short app/packages/ui/src/MonthView.tsx` → `??` (present, untracked until closeout commit).
- On-device Expo check: NOT run this session (see FC1).

## Rule 41 prior open contracts
Prior lineage report 2026-09-04_field-tech-today-jobs-week-calendar:
- FC1 (apply migration 0043): HONORED — applied and verified 2026-09-04 (memory jobcore-themis-2026-09-04-field-tech-findings).
- FC2 (on-device Expo smoke check): HONORED by Jeff 2026-09-05 — his results (B1/B2/B5/C2) are the input to this change.
- FC3 (RN-capable runner for day-list-helpers.assert.ts): input-needed, carried forward unchanged.
Prior lineage 2026-09-04_job-detail-screen-restyle OPEN FC "eas build + on-device check": input-needed (Jeff's device), carried forward unchanged.

## Forward contracts
- FC1: On-device Expo smoke check of this change: Time Off date tap opens modal; single tap end=start; range tap shows both dates; Submit creates request; calendar Week/Month toggle; Prev/Next in both views; Today returns to current period; job and time-off drilldowns still work in month view.
- FC2: MonthView.tsx has no assertion file; add one when an RN-capable runner exists (rides prior FC3).

## Deviations / Defects
- DEV1: Report dated 2026-09-04 in filename for lineage continuity; authored 2026-09-05.
- DEV2: Frozen uncommitted WIP (migrations 0040–0042, JobDetail components, app.json, package.json, tokens.ts, etc.) deliberately excluded from the closeout commit; not part of this change.

## DEFERRED
none
</content>
