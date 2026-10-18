---BUILD REPORT---
# Build report: Assignment pool two-way sort, Unassigned toggle, dimming removed

## Request
Jeff: "The assignments sort feature was badly implemented, lets remove the dimming and concentrate on sort. Last to first and first to last. Make the button a toggle for "unassigned" Remove the other button."

## What changed
Commit 3fdd19f `feat(assignments): two-way pool sort, Unassigned toggle, remove dimming`, branch jobcore-role-landing-0.1.3, 3 files. Follow-up commit c056680 `fix(assignments): Unassigned toggle sorts to top`. Not pushed.

- `app/modules/admin-finance/src/domain/assignment-pool-sort.ts`: `SortMode` replaced by `SortDirection` ('asc' | 'desc'); `sortPoolJobs(jobs, direction)` no longer groups assigned jobs; new `filterUnassigned(jobs, isAssigned)` (first commit), later replaced by `unassignedFirst(jobs, isAssigned)`, a stable partition (unassigned first, relative order inside each group kept, input not mutated), applied after `sortPoolJobs`, per the follow-up commit `fix(assignments): Unassigned toggle sorts to top`.
- `app/modules/admin-finance/src/domain/__assertions__/assignment-pool-sort.assert.ts`: asserts asc, desc, nulls last, no input mutation, no grouping of assigned jobs, and (after the correction) `unassignedFirst`.
- `app/modules/admin-finance/src/screens/AssignmentBoardScreen.tsx`: the Soonest/Newest pair became one sort button that flips between "First to Last" and "Last to First"; the other button is now an "Unassigned" toggle (primary variant when on, outline when off) that, after the correction, puts unassigned jobs at the top (screen state `unassignedOnTop`; the button no longer hides assigned jobs); assigned rows are no longer dimmed (the 0.5 opacity is gone; only the 0.6 press-feedback opacity remains); empty state reads "No unassigned jobs." or "No jobs.".

Interpretation (Jeff did not specify): "Make the button a toggle for unassigned" was first read as a filter that shows only unassigned jobs; that read was wrong. Jeff's clarification ("thats what I mean") confirmed sort-to-top: `filterUnassigned` was replaced by `unassignedFirst(jobs, isAssigned)`, a stable partition (unassigned first, relative order inside each group kept, input not mutated), applied after `sortPoolJobs`. The screen state is `unassignedOnTop` and the button no longer hides assigned jobs. "Unassigned" still means no assignedTechId and no investigator tech for the job.

## Verification (2026-10-18)
`npm test` 380/380 pass. `tsc -b --force` of packages and modules exit 0; admin-finance `tsc -p --noEmit` exit 0. Not browser-verified by Claude.
After the correction: `npm test` 381 pass / 0 fail (exit 0); `tsc -b --force` on packages and modules exit 0; `tsc -p modules/admin-finance/tsconfig.json --noEmit` exit 0.

Forward contracts: none.

Rule 41: prior open Forward contracts in the jobcore lineage (2026-10-16_job-header-estimate-redlines.md, 2026-10-16_prelim-0061-polish-service-area.md) do not touch the assignment pool, so none is honored or reopened; all stay open as declared in their own reports. This change supersedes the Soonest/Newest sort of 2026-10-18_service-tech-gate-and-pool-sort.md, which declared no forward contracts.

## Deviations / Defects
The first commit (3fdd19f) implemented Unassigned as a filter, which Jeff rejected. Corrected by the follow-up commit `fix(assignments): Unassigned toggle sorts to top`; this report amended in place.

## Left alone on purpose
Uncommitted and unrelated: `app/modules/admin-finance/src/screens/EmployeeInvitationsScreen.tsx`; `docs/snapshots/v0.4.0/{_tools/paginate.mjs,_tools/pagination.json,_tools/screens.json,ui-data.json,ui-inventory.html,ui-inventory.pdf,ui-storyboard.html}`.

## DEFERRED
none

Test plan: declined — Jeff declined the Rule 43 test plan on 2026-10-18.

Commit/push: committed as 3fdd19f and c056680, NO push.
