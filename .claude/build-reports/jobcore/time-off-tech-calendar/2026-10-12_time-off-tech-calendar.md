---BUILD REPORT---
GOAL: #0047 admin Time Off queue gains a per-tech Blackout calendar (month view, pick a tech or All Techs) below the queue.

RoA: jobcore / BUILD
Plan: distributed-mapping-plum (E:\Jeff\.claude\plans\distributed-mapping-plum.md) | Date: 2026-10-12 | Status: COMPLETE
Why: Jeff's request (verbatim): "now I want the same treatment for job screen #0047, except as logged in admin, you can choose which tech (or all techs) to show current blackouts on a month calendar below it." #0047 is the admin Time Off queue (key af-timeOffQueue), not a job screen.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\time-off-tech-calendar\2026-10-12_time-off-tech-calendar.md

Summary:
- One commit on branch jobcore-role-landing-0.1.3: 8788fb5 "feat(admin-finance): #0047 Time Off queue gains a per-tech Blackout calendar" (6 files, 145 insertions, 11 deletions). No push (branch has no upstream), no migration, no tag.
- New read-only calendar below Upcoming Blackouts: Month by default, Week remembered; a tech picker offers All Techs plus each active tech; events are titled with the tech name (orphans show "Unknown tech"); pending and approved blackouts only.
- Verification (provenance: Karen verify-hound hand-back, CONFIRMED; the main session did not re-run it): 7 tsc -p --noEmit projects exit 0; npm test from app/ = 303 pass, 0 fail, including all 9 blackout-calendar-logic cases. The main session itself ran tsc -b --force for the six packages, exit 0. No browser check by the agent.

Files (under app/modules/admin-finance/src/screens/ unless noted):
New:
  TimeOffTechCalendar.tsx (93 lines: read-only Month default / Week remembered, tech picker, tech-name titles)
Modified:
  blackout-calendar-logic.ts (expandBlackoutsToEvents gains optional techNameById; without a map it keeps "Day Off", so #0056 is unchanged),
  __assertions__/blackout-calendar-logic.assert.ts (+3 title cases, 9 total),
  TimeOffQueueScreen.tsx (optional techs prop; calendar rendered below Upcoming Blackouts at both render sites),
  AdminFinanceRoot.tsx (activeTechs const hoisted, passed at the #0047 and #0056 mounts),
  docs/snapshots/v0.4.0/_tools/descriptions.json (af-timeOffQueue summary)

Test plan: Jeff declined a test plan at the Rule 43 gate (2026-10-12, "No, skip it"). Non-Tier-A no-self-check caveat applies: the new calendar has not been visually checked by anyone.

Forward contracts:
- The optional techNameById param on expandBlackoutsToEvents is now a contract: #0056 must keep calling it without a map and keep "Day Off".
- #0047 and #0056 SHARE BLACKOUT_WEEK_VIEW_KEY ('admin-finance.blackout.week-view'), so choosing Week in one carries to the other. Splitting them needs an optional key param on readCalMode/writeCalMode plus tests.
- Rule 41 check done 2026-10-12: the #0056 lineage's open contracts (0.4.0 release step, estimate role gating FC-2, service_task_id in commission FC-3, payout-batch parameter mismatch, DateRangeCalendar.tsx shim contract tied to #0031) were reviewed before writing; none is resolvable by #0047 and none needs Jeff's input. The shim contract is not triggered because #0047 does not touch field-tech/TimeOff.tsx. Honored: yes, nothing dangling.

## Deviations / Defects
- Commit was a plain pathspec-less `git commit` of the index, not an explicit-pathspec commit, because a pathspec commit takes working-tree content and would have swept in another session's read-cache hunks in TimeOffQueueScreen.tsx. Those hunks (useReadCacheRevision import, rev const, hasLoadedRef, useRef import, loading-state guard, deps [session, timeOffAdmin, rev]) and the untracked modules/admin-finance/src/lib/read-cache.ts remain UNSTAGED/UNCOMMITTED, owned by that session.
- TimeOffTechCalendar's "Blackout calendar" heading falls back to fontSize 16 / weight 600 copied from BlackoutEditorScreen.tsx:280-284, whereas the Queue screen's Upcoming heading uses colors/typography tokens, so the two headings differ slightly.
- Plan Premise 9 (screen remounts on return from #0056) was NOT confirmed; the existing rev dependency refetches either way, no change made.
- The other session's AdminFinanceRoot.tsx hunks were already committed in 2d23971, not in 8788fb5.
- DEFERRED: generated v0.4.0 snapshot files not regenerated (ui-data.json af-timeOffQueue node, ui-storyboard.html, ui-inventory.html, _tools/pagination.json, routes.json, screens.json). docs/snapshots/v0.3.0 is historical, untouched.
- DEFERRED: the af-blackout-editor description in descriptions.json is stale and out of scope (also recorded in #0056's report).
- Migration 0035 status is from a 45-day-old memory (applied and smoke-tested 2026-08-27), not re-verified today; #0047 reads existing rows only, no migration.
- Minor: the #0056 plan's S8 registry/snapshot lines vs its report (which records the snapshot DEFERRED) were not reconciled beyond this note.

Out of scope, untouched: field-tech/TimeOff.tsx and expandTimeOffToEvents, any migration or DB change, admin-finance/package.json and package-lock.json, handleCancel, screen numbers/keys/titles, the Pending Review and Upcoming Blackouts cards.
