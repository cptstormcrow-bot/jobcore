---BUILD REPORT---
# Build report: Service-tech gate on job header + assignment pool Soonest/Newest sort

## Request
Gate service-tech assignment on the job header until the estimate allows it, and add Soonest/Newest sorting to the Assignment Board pool.

## What changed
Commit d152b66 `feat(assignment): service-tech gate on job header + pool Soonest/Newest sort`, branch jobcore-role-landing-0.1.3, 7 files, +204/-14. Not pushed.

New:
- `app/modules/admin-finance/src/domain/service-tech-gate.ts`: `canAssignServiceTech(estimate)` and `SERVICE_TECH_GATE_HINT`; assertions in `__assertions__/service-tech-gate.assert.ts`.
- `assignment-pool-sort.ts`: `sortPoolJobs` and `SortMode` ('soonest' | 'newest'); assertions in `__assertions__/assignment-pool-sort.assert.ts`.

Wired:
- `app/apps/mobile/app/job/[jobId].tsx`: `serviceGateOpen`.
- `app/apps/mobile/src/components/JobHeader.tsx`: shows the hint when the gate is closed and there is no serviceTechId.
- `app/modules/admin-finance/src/screens/AssignmentBoardScreen.tsx`: `sortMode` state, Soonest/Newest buttons, `sortPoolJobs` wrapping the filtered pool using the isAssigned predicate.

## Verification (2026-10-18)
`npm test` 379/379 pass. `tsc -b --force` of packages and modules exit 0. Mobile `tsc -p --noEmit` exit 0. Not browser-verified by Claude.

Forward contracts: none.

Rule 41: reviewed the Forward contracts of 2026-10-16_job-header-estimate-redlines.md (items 1-9) and 2026-10-16_prelim-0061-polish-service-area.md (migration 0090 unrun; job #3 address unconfirmed). None relates to the service-tech gate or assignment pool, so none is honored or reopened by this change; all stay open as declared in their own reports.

## Deviations / Defects
none

## Left alone on purpose
Unstaged and unrelated to the gate: `app/packages/ui/src/AppChrome.tsx`; `app/modules/admin-finance/src/screens/{AdminFinanceRoot,LeadInboxScreen,EmployeeInvitationsScreen}.tsx`; `docs/snapshots/v0.4.0/{_tools/descriptions.json,_tools/screens.json,ui-data.json,ui-inventory.html,ui-storyboard.html}`.

## DEFERRED
none

Test plan: declined by Jeff (Rule 43, asked 2026-10-18); none authored.

Commit/push: committed as d152b66, NO push.
