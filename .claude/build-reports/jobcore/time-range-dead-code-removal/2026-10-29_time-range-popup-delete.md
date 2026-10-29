---BUILD REPORT---
Project: jobcore / time-range-dead-code-removal
Date: 2026-10-29
Tier: A
Plan: Open Item 8 (Jeff AskUserQuestion answer 2026-10-29: "Delete all three files"); plan mode skipped by declaration (trivial deletion of unmounted code)
Branch/repo: E:\Jeff\Codespace\SDAssemblyPros\Jobcore, jobcore-role-landing-0.1.3
Test plan: none (no visible surface; TimeRangePopup was exported but never mounted)
Forward contracts: none

## Goal
Remove the dead time-range popup code left behind by the calendar redux (`.claude/build-reports/jobcore/calendar-redux/2026-10-22_calendar-redux.md:74`): `TimeRangePopup.tsx`, its helper module `time-range.ts`, and the helper's only importer, the `__assertions__/time-range.assert.ts` test file, plus their export lines in the `@jobcore/ui` barrel.

## Changed files
| File | Change |
|---|---|
| `app/packages/ui/src/TimeRangePopup.tsx` | deleted (177 lines; exported, zero consumers) |
| `app/packages/ui/src/time-range.ts` | deleted (82 lines; only importer was the assert file) |
| `app/packages/ui/src/__assertions__/time-range.assert.ts` | deleted (73 lines; nine tests covering the deleted helpers) |
| `app/packages/ui/src/index.ts` | lines 36-52 removed (TimeRangePopup, TimeRangePopupProps, the twelve time-range helpers and the TimeRange type); file 82 -> 65 lines |
| `app/packages/ui/src/ScheduleItemPopup.tsx` | line 4 doc comment: dropped the trailing "Pattern: TimeRangePopup." sentence (Rule 31, stale reference) |

## Consumer sweep (Rule 20-B)
`grep -rw` for every exported name (`TimeRangePopup`, `TimeRangePopupProps`, `TIME_STEP_MIN`, `FIRST_TIME`, `LAST_TIME`, `toMinutes`, `fromMinutes`, `format12h`, `stepTime`, `defaultEnd`, `clampRange`, `isValidRange`, `stepStart`, `stepEnd`, `TimeRange`) across `app/apps/mobile/src`, `app/apps/mobile/app`, `app/modules`, `app/packages/core/src`, `app/packages/ui/src`, excluding `dist/`, `.expo/`, `index.ts` and the deleted files: zero matches. The only other mention was the ScheduleItemPopup.tsx doc comment, tidied above. The `npm test` runner discovers `__assertions__` files by directory, so removing the assert file needs no script change.

## Verification (Rule 29)
- Type check, from `app/`: `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` -> `tsc exit=0` (output `<scratchpad>\item8-tsc.txt`).
- `npm test` -> `# tests 574`, `# pass 574`, `# fail 0`, `test exit=0` (output `<scratchpad>\item8-test.txt`). Baseline before this change was 583 passing; the nine-test delta is exactly the deleted assert file.
- `git status --short -- app/packages/ui/src` after the hound slices: three `D` rows and `M index.ts`; `ls` of the three paths: absent 3 of 3; `grep -c -E 'time-range|TimeRangePopup' app/packages/ui/src/index.ts` -> 0; `wc -l` -> 65.
- Docs sweep (Rule 31): no file under `docs/`, `app/docs/` or `.claude/build-reports/` names TimeRangePopup or time-range.ts other than the calendar-redux report line 74 that recorded the follow-up and generated snapshot html/json; no doc edit owed.

## Closes
Open Item 8 ("Delete or reuse the now-dead time range popup and time-range helper code", source `.claude/build-reports/jobcore/calendar-redux/2026-10-22_calendar-redux.md:74`). All eight items from Jeff's 2026-10-21 Open Items list are now closed.

## Deviations / Defects
1. Plan mode (Rule 1) skipped by declaration for a pure deletion with a zero-consumer sweep; stated to Jeff before the hounds were dispatched.
2. Rule 43 test-plan ask answered by the session as "none" rather than asked: the component was never mounted, so there is nothing Jeff could see or test on screen.

## Deferred
none
