---BUILD REPORT---

## Method / Tools
Edits made on branch jobcore-role-landing-0.1.3 (not pushed) across three commits. Type-check run per memory jobcore-typecheck-test-runner-quirks. Rule 43 test plan offered, accepted and delivered.

## Request (Jeff)
On screen #0057 (Job Estimate): (1) pin the tab bar at the top, always visible; (2) move Prem Tech, Service Tech, Service Area below and to the right of Check UPS without disturbing anything else; (3) delete the Price Sheet, Line Item and Build from Tasks tabs ("they give no value").

## Changes (files)
- app/modules/admin-finance/src/screens/JobEstimateScreen.tsx: remaining tabs are Contingency, Manual, Fine Print; default tab is contingency; Manual is now unconditional. Price Sheet / Line Item / Build-from-Tasks code and the priceSheets / priceSheetRates / priceSheetAreaAdjustments props removed. The onChrome chrome payload is extended with tabs / activeTab / onTabChange. New techSlot prop renders JobTechFields after the tracking row in the first summary cell. Added summaryCellWide (flexBasis 100%) so the first summary cell spans full width. The "Build lines from tasks" action is gone by Jeff's order.
- app/apps/mobile/app/job/[jobId].tsx: host pins DefaultTabBar (testID estimate-tab-bar) in the JobHeader region when the estimate is embedded.
- app/apps/mobile/src/components/JobHeader.tsx: new exported JobTechFields.
- Reused unchanged: app/packages/ui/src/DefaultTabBar.tsx.

## Commits
- 6329bfa feat(estimate): pin #0057 tab bar, two-column tech fields, drop 3 tabs, persist Materials Onsite
- 722a5ea fix(estimate): true two-column tech fields, real checkmark and stutter-free Materials Onsite
- 09f485e fix(estimate): let the first summary cell span full width so tech fields sit below Check UPS

## Verification
- Type-check per memory jobcore-typecheck-test-runner-quirks.
- Rule 43 test plan delivered (see Test plan field); Jeff has not yet run it.

## Forward contracts:
none

## Deviations / Defects
- Defect in the first commit's output: 722a5ea was needed to fix the two-column layout, the checkmark and the Materials Onsite stutter. Corrected in-series.
- Defect in the first commit's output: 09f485e was needed so the first summary cell spans full width. Corrected in-series.
- Plan said tech fields "right-aligned" in the first cell; delivered as a two-column layout below Check UPS.
- Test-plan caveat: its Label sources block cites JobEstimateScreen.tsx without line numbers.
- Excluded, not owned by this change: untracked .claude/build-reports/jobcore/ui-inventory-0058-regen/.
- No other deviations known.

## Test plan:
E:\Jeff\Desktop\jobcore-0057-job-estimate-test-plan.html (1 test, 10 steps; passes check-test-plan.ps1, exit 0). Status: delivered, results pending.

## Summary
#0057 now has a pinned tab bar, Prem Tech / Service Tech / Service Area laid out in two columns below Check UPS, and only the Contingency, Manual and Fine Print tabs. Two in-series fixes followed the first commit. Unpushed on jobcore-role-landing-0.1.3; test plan results pending from Jeff.
---END BUILD REPORT---
