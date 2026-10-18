---BUILD REPORT---

## Summary
Jeff's #0057 request: (1) pin the tab bar at the top; (2) put Prem Tech / Service Tech / Service Area beside Check UPS; (3) delete Price Sheet, Line Item and Build from Tasks tabs. Follow-up: tech/service-area must be a RIGHT column next to Copy Estimate Link / Tracking Number / Check UPS (a left column, as-is), and the Materials Onsite checkbox must work.

## Changes (files)
- app/modules/admin-finance/src/screens/JobEstimateScreen.tsx: ESTIMATE_TABS now exactly contingency, manual, finePrint; Price Sheet, Line Item, Build from Tasks removed with dead helpers/styles/imports; `techColumns` row (techLeftCol: copy link, tracking field, Check UPS; techRightCol: `props.techSlot`); standalone bar wrapped in `<View testID="estimate-tab-bar">` and rendered outside the ScrollView; embedded mode publishes `EstimateChrome {optionsItems, tabs, activeTab, onTabChange}` via `onChrome`. `serviceAreas` prop kept.
- app/apps/mobile/app/job/[jobId].tsx: host renders `<View testID="estimate-tab-bar"><DefaultTabBar/></View>` before its ScrollView; `hideTechFields={region === 'estimate'}`; passes `techSlot`, `serviceAreas`, `editable`, `onChrome` to JobEstimateScreen.
- app/apps/mobile/src/components/JobHeader.tsx: new export `JobTechFields`; `JobSummaryRest` gains `hideTechFields`.
- app/apps/mobile/src/lib/offline-ops/tech.ts: `ESTIMATE_COLUMNS` now maps materialsOnsite->materials_onsite, trackingNumber->tracking_number, trackingStatus->tracking_status, trackingCheckedAt->tracking_checked_at, finePrint->fine_print, pdfDelivery->pdf_delivery, contingencies->contingencies. Root cause of the Materials Onsite bug: the `jobEstimateUpsert` handler silently dropped unmapped keys.

## Verification
- tsc -b --force on packages/core, packages/ui, packages/module-sdk, modules/admin-finance, modules/field-tech, modules/sales-marketing, then tsc -p --noEmit on the mobile app: clean.
- `npm test` from app/: tests 381, pass 381, fail 0.
- Karen: estimate screen, offline-ops and host all CONFIRMED.
- Test plan rendered, `check-test-plan.ps1` PASS.
- No browser check on shared dev server 8081 was performed (memory feedback-trust-test-plan-no-self-browser-verify).

## Forward contracts:
- Migration 0089 (app/supabase/migrations/0089_estimate_redlines.sql L12-18) adds the columns the new mappings write to; its live-applied status is UNKNOWN. A Materials Onsite write will fail against live Supabase until 0089 is applied. No live push was made; a push needs Jeff's go.
- Possibly stale refs to the removed tabs/props not flagged by tsc: AdminFinanceRoot.tsx ~L1032-1047 and admin-finance-repos.ts ~L3026-3036 (left untouched; JobCloseOutRegion.tsx:202 deliberately left alone).

## Deviations / Defects
- Standalone mode drops the Job header block (the host-only summary) that previously could appear above the estimate.
- Extra deletions beyond the three tabs: dead helpers, styles and imports tied to them.
- testID `estimate-tab-bar` sits on a wrapper View because DefaultTabBar has no testID prop.
- Layout was reworked once after Jeff's feedback: tech fields first stacked below Check UPS; fixed with the two-column `techColumns` wrapper.
- Six columns beyond Materials Onsite were newly mapped in ESTIMATE_COLUMNS (see Changes); behaviour change for offline writes.
- Defect left alone: app/apps/mobile/app/job/[jobId].tsx ~L299 `isTechEstimate = role === 'tech'` and ~L1457 `editable={!isTechEstimate}` make Materials Onsite read-only for the tech role, so the checkbox still cannot be toggled by a tech.
- Not ours / excluded from commit: untracked .claude/build-reports/jobcore/ui-inventory-0058-regen/.

## Test plan:
E:\Jeff\Desktop\2026-10-18_jobcore-0057-estimate-test-plan.html (5 tests, 9 steps; delivered to Jeff; passes check-test-plan.ps1). Results pending from Jeff.
