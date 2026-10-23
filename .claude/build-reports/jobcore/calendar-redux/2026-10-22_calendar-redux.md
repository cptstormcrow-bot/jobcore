---BUILD REPORT---
# Build report: Calendar Redux (#0058 Schedule screen rebuilt around an inline calendar)

Date: 2026-10-22
Project: JobCore
Branch: jobcore-role-landing-0.1.3
Commit: 98303c2 `feat(schedule): rebuild #0058 Schedule screen around an inline calendar` (11 files, +1551/-498, local only, NOT pushed)
Tier: A
Session: 2e2a557e-87be-4df0-8730-eb7ad6960513
Build completed: yes (committed locally; not browser-verified)
Rules: 8 (report), 25 (Forward contracts), 37 (Deviations), 43 (Test plan)

## Request (Jeff, R1-R9)
- R1 Inline calendar on both entry paths (header label, Job menu > Schedule).
- R2 Saved date/time shown in a bold heading above the calendar.
- R3 Remove Prem Tech / Service Tech / Service Area from the top of the screen.
- R4 Save / Clear / Cancel buttons.
- R5 Remove the Technicians / Blackouts / Request-time-off bar on the JOB screen only.
- R6 Show all scheduled jobs and all blackouts.
- R7 Drill-down popup (name, address, phone, description, plus a link that switches focus to that job).
- R8 Options-menu "Blackout Dates?" toggle.
- R9 A changed saved slot asks "Reschedule?" Yes/No (Yes = save + paperwork, No = reset view to saved).

## What changed
Files under `app\` unless noted:
- `apps/mobile/app/job/[jobId].tsx`: host hunks `showBlackouts`, `onOpenJob`, `hideTechFields`.
- `modules/admin-finance/src/domain/schedule-items.ts` (+ `__assertions__/schedule-items.assert.ts`).
- `modules/admin-finance/src/screens/JobScheduleScreen.tsx`: rewrite.
- `packages/ui/src/ScheduleItemPopup.tsx`, `SchedulePicker.tsx`, `schedule-picker.ts` (+ `__assertions__/schedule-picker.assert.ts`), `index.ts` (+14 exports).
- `packages/ui/src/walkthrough/help-content.ts`: `job_reschedule` card.
- `docs/snapshots/v0.4.0/_tools/descriptions.json`: `job-region-schedule` summary/purpose.

## Verification (Karen, Wave 4)
- tsc, all targets: exit 0.
- `npm test`: 446/446 pass, including both new assert files.
- Lint: zero new errors in files touched by this build. `npm run lint` shows 106 problems / 56 errors, all pre-existing in MonthView.tsx, PayrollButton.tsx, StepperPicker.tsx, release-bump.assert.ts, ups-track/index.ts.
- NOT browser-verified.

## Forward contracts
- Host to screen props `showBlackouts` and `onOpenJob` on `JobScheduleScreen`.
- `SchedulePickerProps { value: string | null; onChange(iso | null); items; showBlackouts; onSelectItem; initialMonthIso?; testIDPrefix? }`.
- `SchedulePickerItem { id; kind: 'job' | 'blackout'; startIso; endIso | null; title; subtitle?; isCurrent? }`.
- `ScheduleItemPopup` props `{ visible; detail; onClose; onOpenJob? }` with `ScheduleItemDetail { kind; title; whenLabel; address?; phone?; description?; openJobId? }`.
- `schedule-items.ts` local structural `ScheduleItem` must stay structurally identical to `SchedulePickerItem` (no `@jobcore/ui` import).
- A `calendar_events` row of kind `reschedule` (title `Rescheduled: <old> -> <new>`) is written on Reschedule-Yes and shown on the job Trail (`modules/admin-finance/src/domain/job-timeline.ts:75-77`).

### Rule 41 evaluation of prior open contracts
- FC2 (legacy "Blackouts" / "Request time off" buttons in UniversalCalendar): NARROWED, not closed. R5 removed them from the job screen only; the Calendar tab keeps them. Restyling them to PayrollButton needs Jeff's input, so it stays OPEN (input-needed).
- FC1 (UI Inventory regen): stays open.

## Deviations / Defects
Locked design choices, each flagged for Jeff:
- D1 New inline RN component in `packages/ui` (web + Android), not the native datetime-local input.
- D2 Picker edits START only; END = start + duration (saved end-start if a saved slot, else totalTaskMinutes/standardMinutes, else 60).
- D3 PayrollButton Save / Clear / Cancel. Save enabled only when the draft differs from saved (starts compared). No saved slot: Save persists directly. Saved + changed: "Reschedule?" Yes/No. Saved + empty draft: "Remove from schedule?" Yes/No (replaces the old "Cancel visit"). Clear empties the draft only (Clear-then-Save = unschedule, writes no reschedule event). Cancel / No discard the draft and remount the picker at the saved month.
- D4 Reschedule record is a `calendar_events` row only, written AFTER the persist succeeds (event failure shows a non-blocking notice, no rollback). NO customer notice, status untouched, NO `audit_log` write.
- D5 "Blackout Dates?" is a MenuToggleItem, per-session `useState`, default ON.
- D6 Jobs shown = `scheduledStart != null` excluding terminal statuses (cancelled, archived, closed, declined, paid, completed); `needs_reschedule` NOT excluded; current job included, tagged "This job". Blackouts = all time-off the Calendar tab shows (skip cancelled/denied), every tech, drawn red.

Other deviations and defaults:
- Weekends are muted grey, not red (deliberate vs the screenshot).
- Out-of-month days use textMuted at opacity 0.45.
- No blackout cell tint (red day number + red dot instead).
- Dots: max 2 job dots + 1 red blackout dot, else max 3 job dots.
- Minute step 1.
- Day tap on an empty draft defaults to 9:00 AM; time tap on an empty draft uses today.
- Day items shown as an agenda under the picker; two-pane at width >= 640.
- Heading shows the SAVED slot.
- New buttons added (Save, Clear, Cancel, Yes, No, Back to Job, month arrows), all PayrollButton: button-SOP flag to Jeff.
- Plan hound skipped (persona unresolved).
- `schedule-items.ts` uses local structural types.
- Popup is presentational; the phone is fetched by the screen.
- An unsaved draft is lost when "Open job" navigates away.
- `TimeRangePopup.tsx` and `time-range.ts` are now dead code (exported, no production consumers; only `__assertions__/time-range.assert.ts` imports `time-range.ts`). Follow-up; NOT deleted.
- No `package.json` edit was needed.
- S4 (index.ts exports) was run by Spot though the crib ledger said Nestor.
- `[jobId].tsx` hunks were interleaved with another stream's dirty file; only this build's hunks were committed.
- S6 reused headingBold/h5 styles and added extra dialog lines.
- S8 scope limited to the `job_reschedule` help card and `job-region-schedule` summary/purpose.
- 7 earlier tsc errors fixed: noUncheckedIndexedAccess `?.` in the assert file; `(... ?? '')` at `schedule-picker.ts:115`; `focusParts[0] ?? view.year` at `SchedulePicker.tsx:175`; accepted `ref={scrollRef as never}` cast at `SchedulePicker.tsx:96` for a duplicated @types/react.
- Conformance P1 (onChange widened to `string | null`) and P2/P12 (guarded derived-state pattern) accepted.
- Process lapses: missing Rule 18 narration before several earlier dispatches; status lines announced dispatches without an Agent call in the same message.

## DEFERRED
| Item | Detail | Status |
|------|--------|--------|
| Stale hits in GENERATED v0.4.0 snapshot files | 15 hits for this change in `docs\snapshots\v0.4.0\ui-data.json`, `_tools\screens.json`, `ui-storyboard.html`, `ui-inventory.html`. Not hand-edited; refresh only on UI Inventory regen (FC1, memory `jobcore-ui-inventory-0058-regen.md`). | NOT deferred by Jeff; open (Rule 31 needs his explicit word) |

No live hand-written doc found stale; no test plans hit.

Test plan: declined by Jeff 2026-10-22 ("No test plan. Commit locally and file the build report.").

Commit/push: committed as 98303c2, NO push.
---END BUILD REPORT---
