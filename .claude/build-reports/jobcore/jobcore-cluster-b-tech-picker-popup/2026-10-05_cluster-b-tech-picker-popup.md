---BUILD REPORT---
Project: jobcore
Date: 2026-10-05
Tier: A
Branch: jobcore-role-landing-0.1.3
Commit: 4779834 (feat(ui): narrower field-tech picker popup), building on 11668ff (feat(ui): shared title-bar fill/padding and TechSelect picker with heading); not pushed
Plan: E:\Jeff\.claude\plans\jobcore-030-test-fixes-v040-8-sessions.md
Summary: v0.4.0 cluster B - field-tech picker popup (0.3.0 test 6.1): heading "Choose a Field Tech", centered larger text, gray dividers between choices, narrower popup; applies to every tech picker instance.
Test plan: deferred to the v0.4.0 closeout (Rule 43)
Forward contracts:
- Device pass of the popup on Jeff's Android (65% / max 240 width, centered 18pt text, dividers, heading) goes into the v0.4.0 test plan.
- Inspect EmployeeEditorScreen.tsx:424,431 and PriceSheetEditorScreen.tsx Select usages to confirm none is a tech list.

## Goal
Jeff's 0.3.0 test 6.1: the field-tech picker popup was too wide and the choice text was not centered. He wants the heading "Choose a Field Tech", larger text, and gray lines between choices, global across every tech picker instance.

## What changed
Note: 11668ff landed AFTER the v0.3.0 tag, so the tested 0.3.0 APK predates it.
- 11668ff (app/packages/ui/src/Select.tsx, TechSelect.tsx, index.ts, AppChrome.tsx): heading, centered text, 18pt text, #CED4DA dividers in Select; new TechSelect wrapper (defaults to "Choose a Field Tech"), exported from app/packages/ui/src/index.ts.
- 4779834 (Select.tsx, TechSelect.tsx): tech-only `narrow` prop (sheetNarrow width 65%, maxWidth 240); TechSelect passes narrow, so only tech pickers get the narrower popup.

## Scope
Call sites inheriting the change (via TechSelect):
- apps/mobile/src/components/AssignTechRegion.tsx:43
- JobHeader.tsx:144
- admin-finance: AdminFinanceRoot.tsx:1388, AssignmentBoardScreen.tsx:455, BlackoutEditorScreen.tsx:117
- field-tech: TimeOff.tsx:327
Plain Select sites confirmed non-tech (unchanged width): JobScheduleScreen.tsx:403, JobEstimateScreen.tsx:608, PlanningScreen.tsx:160, JobDetailsForm.tsx:138.
Not yet inspected (likely non-tech): EmployeeEditorScreen.tsx:424,431; PriceSheetEditorScreen.tsx.

## Verification
Run from app/ before commit:
- `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing`: EXIT 0.
- `for p in packages/ui modules/admin-finance modules/field-tech modules/sales-marketing apps/mobile; do npx tsc -p $p/tsconfig.json --noEmit; done`: EXIT 0 for all five, no output.
- No device or visual check done (Jeff's Android pass is a forward contract).

## Docs (Rule 31)
Grep over Jobcore\docs\*.md for `TechSelect|tech picker|field-tech picker|Choose a Field Tech` returned no matches; no docs affected.

## Rule 41 pre-write gate (jobcore lineage)
- HONORED: apk-0-3-0 "deferred AppChrome shared title-bar bump" (done by 7826612).
- OPEN, not resolvable without input: 2026-10-01 field-tech-gear FC3 (session-injection fallback UX, needs Jeff); 2026-10-01 test-employees-retest (re-judge create() delete-then-insert when migration 0072 lands); 2026-09-04 job-detail-restyle FC-A3 (DEV-only legacy installer rows); apk-0-3-0 FC-2 (iOS item, carried as listed there).
- Cluster A's open contracts carry unchanged: device pass; field-tech job-detail branch lacks AppChrome (cluster D); Calendar tab native header deferred; other titleBar callers visual check.

## Deviations / Defects
The work was split across two commits (11668ff before the tag, 4779834 after). The "too wide" gap was not covered by 11668ff and was closed by 4779834. No other deviations or defects.
