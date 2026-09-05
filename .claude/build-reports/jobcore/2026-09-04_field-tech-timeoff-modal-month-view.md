---BUILD REPORT---

# Field-tech Time Off date-tap modal + calendar week/month toggle

Date: 2026-09-05
Project: jobcore
Branch: jobcore-job-detail-action-buttons
Tier: A
Commit: f68f665
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

---

## Fix Addendum — 2026-09-05 (Rule 8/37)

**Trigger:** Jeff's smoke-test results (`2026-09-05_field-tech-timeoff-modal-month-view-smoke.html`). PASS: A1–A5, B2, B4, B7, C1–C3. FAIL: A6, B1, B3, B5, B6, B8.

**Root cause:** The week/month toggle, Today button, and MonthView were wired into `DayList.tsx` (field-tech module), but the mobile Calendar tab (`app/apps/mobile/app/(tabs)/calendar.tsx`) only offered Day/Week — so B1/B3/B5/B6/B8 (no month toggle, no Today, cannot see month view) failed where Jeff actually tested. A6 was the legacy `#3366ff` filled-circle marker styles in `DateRangeCalendar.tsx`.

**Fix commit:** `3e38a75` — `fix(jobcore): calendar tab month view + Today; time-off calendar Prev/Today/Next with red-bold blackouts`

**Files (2, 46+/22−):**
- `app/apps/mobile/app/(tabs)/calendar.tsx` — mode `'day' | 'week' | 'month'`; Month button; Today button; goPrev/goNext step by mode (±1 day / ±7 days / ±1 month via date-fns `addDays`/`addMonths`); `<MonthView>` from `@jobcore/ui` with day-select dropping into Day mode.
- `app/modules/field-tech/src/screens/DateRangeCalendar.tsx` — Prev/Today/Next header; Sun–Sat weekday labels; blue filled circle removed; blackout/selected dates render red (`#c62828`) bold on a light `#fdecea` tint.

**Verification:** `git diff --stat` (2 files, 46+/22−); `npx tsc --noEmit -p .` from `app/` exit 0. Re-test by Jeff pending against the same HTML plan.

**Not changed (by decision):** the bottom form in `TimeOff.tsx` (A6 second half) is the edit-existing-request form gated on `selectedId !== null`, not a leftover inline form; left in place pending Jeff's call on moving edits into the modal.

**Forward contracts:** FC-fix-1 — Jeff re-runs the smoke plan against `3e38a75`; open until PASS recorded.

## Deviations / Defects (addendum)
- DEV-fix-1: Original build wired month view into the wrong screen (DayList.tsx vs Calendar tab). Fixed in `3e38a75`.
- DEV-fix-2: Legacy marker styling shipped in f68f665 contrary to Jeff's stated preference. Fixed in `3e38a75`.

## Fix Addendum — Round 2 (2026-09-05)

**Trigger:** Jeff's round-2 re-run of `.claude/test-plans/2026-09-05_field-tech-timeoff-modal-month-view-smoke.html` (saved 2026-09-05T16:45Z): 14 PASS, 3 FAIL (B1, B6, B8) plus general note that the Jobs calendar and Time Off date-range calendar diverged and that the orange time-off circles were distracting. Separately reported: Jobs week view overflowed the right edge of the screen.

**Code commit:** `df9b9c3` — `fix(jobcore): unify Jobs + Time Off calendars on shared week/month CalendarHeader; red-bold time-off dates; week view fits screen (round-2 B1/B6/B8)`

| Item | Round-2 result | Root cause | Fix |
|---|---|---|---|
| B1 — week/month toggle on Jobs calendar | FAIL ("nowhere to toggle it") | Mode toggle was a low-contrast text-only control and easily missed | New shared `CalendarHeader` in `@jobcore/ui`: row 1 `‹ Prev · Today · <label> · Next ›`, row 2 segmented Week / Month buttons |
| B6 — Jobs and Time Off calendars should look identical | FAIL | `DateRangeCalendar.tsx` had its own month-only grid | `DateRangeCalendar.tsx` now renders the same `CalendarHeader` + `WeekView` / `MonthView` primitives as `calendar.tsx` |
| B8 — month toggle | FAIL ("no month toggle") | Same as B1 | Same as B1 |
| General note — orange circles distracting | — | `MonthView` painted a primary-colour circle on time-off days | Time-off / blackout dates now render as red bold text (`#D32F2F`, weight 700) in both `WeekView` and `MonthView`; the filled circle is reserved for the selected/anchor day |
| Jobs week view runs off the right edge | Reported in chat | `WeekView` used a horizontal ScrollView with fixed 140px columns | `WeekView` now lays out 7 `flex:1` columns fitting the screen width, with EEE + date headers (today bold/primary) |

**Files changed (6):** `app/packages/ui/src/CalendarHeader.tsx` (new), `app/packages/ui/src/WeekView.tsx`, `app/packages/ui/src/MonthView.tsx`, `app/packages/ui/src/index.ts`, `app/apps/mobile/app/(tabs)/calendar.tsx` (364→218 lines; day mode removed), `app/modules/field-tech/src/screens/DateRangeCalendar.tsx` (289→194 lines).

**Verification:** `npx tsc --noEmit -p .` from `app/` → exit 0. Visual re-check on device is Jeff's (Forward contract FC-R2-1: Jeff re-runs the HTML smoke plan items B1/B6/B8 and confirms the week view fits the screen).

**Deviations / Defects:** none beyond the round-2 failures listed above. `TimeOff.tsx` untouched; the question of moving the edit-existing form into the modal remains open for Jeff.

## Fix Addendum — Round 3 (2026-09-05)
Commit: 96e81df — fix(jobcore): field-tech time-off edit form moved into modal
Changes (app/modules/field-tech/src/screens/TimeOff.tsx, +78/-55 per `git diff --stat`):
- Tapping an upcoming "My requests" row now opens the date-tap modal in edit mode (title "Edit time off", modal DateRangeCalendar keyed per request, prefilled reason, Save + Delete + Cancel).
- Calendar section is new-request only; inline Reason/Save/Delete/"Cancel edit" removed; calendar disabled while modal is open.
- Admin-added requests render read-only in the modal ("Added by your admin", only Close).
- Shared closeModal handles overlay tap, Android back, and Cancel; clears selection and errors.
- Modal sheet wrapped in ScrollView (maxHeight 90%) for small screens.
- tsc --noEmit from app/: exit 0.
Test plan: .claude/test-plans/2026-09-05_field-tech-timeoff-edit-in-modal-smoke.html
Forward contracts: FC-R3-1 — Jeff runs the round-3 HTML smoke plan (C1–C11) on device and returns the saved file. FC-R2-1 remains open (re-run B1/B6/B8; folded into C11).
Deviations / Defects: none.
</content>

## Round 4 Fix Addendum (3f75d2a)

Source: round-3 smoke results saved 2026-09-05T20:48:29Z (`2026-09-05_field-tech-timeoff-edit-in-modal-smoke.html`): C1/C2/C4/C5/C6/C9/C11 pass; C3 FAIL, C8 FAIL, C10 FAIL; C7 unanswered; all comment fields empty.

Code commit: `3f75d2a` — `app/modules/field-tech/src/screens/TimeOff.tsx`, `app/modules/field-tech/src/data/ports.ts` only. `npx tsc --noEmit` exit 0.

| Item | Finding | Action |
|---|---|---|
| C10 (keyboard / small screen: Save/Delete/Cancel unreachable) | Sheet had no keyboard avoidance and fixed layout | Wrapped the sheet in `KeyboardAvoidingView` (`behavior='padding'` on iOS, undefined on Android) inside a new `sheetWrap` style (`width 100%`, `maxHeight 90%`); sheet gets `flexShrink: 1`; ScrollView keeps `keyboardShouldPersistTaps="handled"` |
| C3 (tap upcoming request → prefilled Edit modal) | Data path verified intact: `listForTech` selects `*`, row mapper sets `createdByAdminId`, migration 0035 applied live 2026-08-27. No code defect found | Hardened mapper to `row.created_by_admin_id ?? null` (undefined → null). Retest required |
| C8 (admin-added request → read-only "Added by your admin" modal) | Same data path as C3; `isAdminAdded` derives from `createdByAdminId` | Same hardening; retest required |
| C7 (overlay tap / Android back = Cancel) | Not answered in round 3 | Retest |

Working hypothesis for C3/C8: the device ran a bundle predating `96e81df` (the round-3 refactor), so the old non-modal edit flow was exercised. The round-4 plan requires a bundle reload before testing and asks for a description of what the screen actually shows on any fail.

Forward contracts: Jeff runs `.claude/test-plans/2026-09-05_field-tech-timeoff-round4-retest.html` and returns the saved file.

## Deviations / Defects
none
