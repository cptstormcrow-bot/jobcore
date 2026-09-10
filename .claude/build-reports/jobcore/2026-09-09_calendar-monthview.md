---BUILD REPORT---

# Calendar MonthView — Admin & Finance Default View Switch

**Date:** 2026-09-09
**Branch:** jobcore-job-detail-action-buttons
**Commit:** `5b896c03b14f3a78e1c31c64c1b4e46d2dba83e7`

## Goal

Switch the Admin & Finance Calendar from WeekView to MonthView as the default view, reusing
Field Tech > Time Off's `DateRangeCalendar.tsx` styling for the month grid.

## What changed

- **`app/packages/ui/src/MonthView.tsx`** (feature-complete calendar month grid component,
  lint-clean; +112/-5 diff before commit) — new/expanded month-grid component styled after
  `DateRangeCalendar.tsx`.
- **`app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx`** (+17/-3 diff before commit) —
  wires `MonthView` in as the default `calendarMode`, adds `calendarAnchorDay` and
  `selectedCalendarTechId` state.

## Feature detail

- Monthly view is now the DEFAULT Calendar view (previously WeekView).
- Shows ALL assigned jobs per day (not just time off), rendered as bulleted one-line text.
- Multiple same-day schedules for different techs are distinguished by tech in the bullet text.
- Live-populates: a newly scheduled job or time-off appears without manual refresh.
- Tapping a job bullet navigates to Job Details (`app/job/[jobId].tsx` via Expo Router).
- **Follow-on 1:** added "All Techs" option to the tech filter so all techs can be shown on the
  calendar again (not just one at a time).
- **Follow-on 2:** labeled the tech sort/filter dropdown "Technicians".

## Verification

Jeff visually confirmed live in the running dev server (port 8081, not restarted) — his own
words: "nice! looks good" and "no need to verify. I can see it and testing it now. works as
advertized." No automated/browser-tool verification was performed by Claude; confirmation is
Jeff's direct observation.

## Test plan

Declined by Jeff (Rule 43 gate — Jeff selected "Skip it").

## Forward contracts

none

## Deviations / Defects

1. **Fixed:** `MonthView.tsx` initially had 4 `@typescript-eslint/no-explicit-any` lint errors
   (project lint rule: no-explicit-any is an error, not a warning). Fixed by introducing a
   `TimeOffEventWithRange` type alias to replace `any` usage. Result: repo-wide lint problems
   dropped from 33 to 29, errors from 6 to 2. The remaining 2 pre-existing errors are in
   `DateRangeCalendar.tsx` (the Field Tech > Time Off component being reused for styling) and are
   OUT OF SCOPE for this change — pre-existing, not introduced by this work.
2. **Pre-existing/unrelated:** a TS7053 type error in `ReportsJobDetailScreen.tsx` (formerly
   referenced as `ReportsScreen.tsx`) was investigated via `git blame` and traced to pre-existing
   commit `3eb4a8f`, unrelated to this session's Calendar change. Not fixed as part of this change
   (out of scope).

## Commit scope (Rule 42)

Only the two files above were staged/committed (git hygiene Rule 42 confirmed via
`git status --porcelain=v1` — all other working-tree changes, including unrelated
modified/deleted/untracked files, were left untouched).

## Commit

```
commit 5b896c03b14f3a78e1c31c64c1b4e46d2dba83e7
Author: Jeff Sheets <sheetsj@jbsheets.com>
Date:   Wed Sep 9 15:03:46 2026 -0700

    feat(admin-finance): switch Calendar to MonthView with job overlay

    - Default Calendar view is now Monthly (was WeekView), reusing
      DateRangeCalendar.tsx styling from Field Tech > Time Off
    - Shows all assigned jobs per day, not just time off, as one-line
      bulleted entries distinguished by tech for same-day overlaps
    - Live-populates when a job or time-off is scheduled
    - Tapping a job bullet navigates to Job Details
    - Added "All Techs" option to restore multi-tech view
    - Labeled the technician sort filter "Technicians"

    Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

 .../admin-finance/src/screens/AdminFinanceRoot.tsx |  20 +++-
 app/packages/ui/src/MonthView.tsx                  | 117 ++++++++++++++++++++-
 2 files changed, 129 insertions(+), 8 deletions(-)
```

---END BUILD REPORT---
