---BUILD REPORT---

# Field-tech Today's Jobs list + week calendar with editable time off

Date: 2026-09-04
Project: jobcore
Branch: jobcore-job-detail-action-buttons
Tier: A
Commit: 04bc445
Built via: Ultracode workflow wf_389fab8b-2e5 (21 agents, 0 errors, adversarial review per slice)

## Goal
Today's Jobs = bulleted linked list of jobs scheduled today + weekly calendar showing time off (red, drill-down edit/delete) and jobs (drill-down to job screen); Time Off button = picker into calendar, upcoming entries bulleted above; tech time off appears in admin week calendar in red with tech name.

## Decisions locked
Job drilldown `router.push('/job/'+id)`; admin target = admin week calendar (shared WeekView), not Assignment Board; Today's Jobs only jobs whose scheduledStart is local today; edit = change dates+reason via new update on port/repo + migration 0043; delete = existing cancel RPC; picker reuses TimeOff.tsx create flow; week starts Sunday.

## Files changed (10 files, 552+/84−, `git diff --cached --stat`)
- app/apps/mobile/src/lib/field-tech-repos.ts (+22, update method calling RPC update_time_off_request)
- app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx (+1, skip cancelled/denied in toCalendarTimeOffEvents)
- app/modules/field-tech/src/data/ports.ts (+8, TimeOffRepository.update, isActiveTimeOffStatus, createdByAdminId)
- app/modules/field-tech/src/index.ts (+17, selectedTimeOffId wiring)
- app/modules/field-tech/src/screens/DateRangeCalendar.tsx (+31/−2, markedRanges/onSelectMarkedDay)
- app/modules/field-tech/src/screens/DayList.tsx (+178, isScheduledOnLocalDate, expandTimeOffToEvents, today list + Prev/Today/Next week strip, optional onOpenJob/onOpenTimeOff)
- app/modules/field-tech/src/screens/TimeOff.tsx (+165, initialSelectedId, upcoming red list, marked-range calendar, edit/delete/new, admin-added read-only)
- app/modules/field-tech/src/screens/__assertions__/day-list-helpers.assert.ts (new, 124 lines)
- app/packages/ui/src/WeekView.tsx (+23, tappable red time-off cards, today header bold+underline)
- app/supabase/0043_time_off_update_own.sql (new, 67 lines, RPC update_time_off_request(uuid,date,date,text), audit via calendar_events 'time_off_updated', grant execute to authenticated)

## Verification gates (Rule 29-B)
- `tsc --noEmit` → PASS 0 errors in all 4 package dirs.
- Assertion file execution BLOCKED (no RN-capable runner in repo tooling).

## Rule 41 prior open contracts
2026-09-04 job-detail-screen-restyle OPEN FC "eas build + on-device check" is input-needed (Jeff's device) — carried forward, not resolved; the new smoke-check FC (below) is folded alongside it.

## Forward contracts
- FC1: Migration 0043 NOT yet applied at report time — Jeff applies via Supabase SQL Editor, then verify with `select count(*) as fn_exists, has_function_privilege('authenticated','public.update_time_off_request(uuid,date,date,text)','execute') as authed_exec from pg_proc where proname='update_time_off_request';` expecting 1/true.
- FC2: On-device Expo smoke check: today bullets; week Prev/Today/Next; job tap → /job/[id]; red time-off tap → Time Off with entry selected; add/edit/delete round-trip; admin week calendar shows red tech names; cancelled entries absent.
- FC3: day-list-helpers.assert.ts needs an RN-capable runner before it counts as executed.

## Deviations / Defects
1. Slice 5 onOpenJob/onOpenTimeOff made optional props because callers were frozen uncommitted WIP.
2. Slice 6 review fix: Fragment wrap + loading/loadError wiring applied inside the workflow.
3. Assertion run blocked — tooling gap.
4. `npx supabase@2.116.0 db query --linked --file` cannot apply plpgsql `$`-quoted bodies (42601); local CLI v1.226.4 lacks db query; SQL Editor required.
5. Suspected 0043 dollar-quote defect investigated and REFUTED (byte-identical quoting to applied 0019).
6. Slice 7 landed in field-tech `screens/DateRangeCalendar.tsx`, not `packages/ui` as the plan named (no such packages/ui file exists).
7. Frozen WIP + untracked migrations 0040–0042 deliberately excluded from commit.

## Delivery
Git-tracked in-repo, path reported in chat (no Desktop copy per jobcore-build-report-canonical-root).

---END BUILD REPORT---
