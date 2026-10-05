---BUILD REPORT---
Project: jobcore
Date: 2026-10-05
Tier: A
Branch: jobcore-role-landing-0.1.3
Commit: 7826612 (feat(ui): title bar balanced padding, wider fill, Assigned Jobs subtitle); not pushed
Plan: E:\Jeff\.claude\plans\jobcore-030-test-fixes-v040-8-sessions.md
Summary: v0.4.0 cluster A - universal title-bar SOP (0.3.0 test items 3.1, 7.1, 8.1, 10.1): balanced equal padding, pill widened toward the menu buttons, Field Tech subtitle reads "Assigned Jobs".
Test plan: deferred to the v0.4.0 closeout (Rule 43)
Forward contracts:
- Device pass on Jeff's Android (pill width, vertical text balance) carried into the v0.4.0 test plan.
- Field Tech job-detail branch (field-tech index.ts ~82-95) has no AppChrome: deferred to cluster D.
- Calendar tab native header (app/apps/mobile/app/(tabs)/_layout.tsx:8, headerShown:true) deferred.
- Visual-regression check item for the v0.4.0 test plan: other titleBar callers are affected by the padding change (list under Scope).

## Goal
Jeff's 0.3.0 test results: every header uses the Admin & Finance style - blue pill fills the row between hamburger and options menu, equal blue above and below the text, and the title names the screen ("Field Tech-Assigned Jobs").

## What changed
Files (commit 7826612): app/packages/ui/src/AppChrome.tsx, app/modules/field-tech/src/index.ts, app/modules/field-tech/src/screens/Overview.tsx.
- AppChrome.tsx: titleBar paddingTop 14 / paddingBottom 14 / marginHorizontal 0 (was 10/8, margin 2); controlsRow paddingHorizontal spacing.xs; iconButton paddingHorizontal 2, paddingVertical spacing.xs.
- Field Tech: Overview lifts its drill label via an onDrillChange callback prop to FieldTechRoot (index.ts, drillLabel state); subtitle reads "Assigned Jobs" (regex-normalised from "Assigned jobs") when the Assigned tile is drilled; cleared on sub-view change.

## Scope: other titleBar callers affected (visual-regression check item)
- sales-marketing SalesMarketingRoot.tsx:175
- mobile (tabs)/jobs.tsx, account.tsx, config/settings.tsx, config/test-jobs.tsx, job/[jobId].tsx:1161, profile.tsx:124
- JobHeader.tsx:64

## Verification
Run from app/ (results as handed over by the main session; not re-run by the report writer):
- `npx tsc -b --force` on core, ui, module-sdk, admin-finance, field-tech, sales-marketing, then per-project `--noEmit`: exit 0.
- Not browser-checked by design (standing rule: trust the test plan).

## Docs (Rule 31)
Repo docs sweep for 'title bar|titleBar|Field Tech-Overview' found nothing stale. Memory SOP updated: feedback-jobcore-header-title-bar-sop.md (2026-10-04 update section).

## Rule 41 pre-write gate (jobcore lineage)
Scanned the three most recent reports (S3 board picker 2026-10-05, prem-claim-reloads 2026-10-03, apk-0-3-0 2026-10-03).
- HONORED: apk-0-3-0 carried "deferred AppChrome shared title-bar bump" - done by this commit.
- OPEN, none resolvable without input here: 2026-10-01 field-tech-gear FC3 (session-injection fallback UX, needs Jeff); 2026-10-01 test-employees-retest (re-judge create() delete-then-insert when 0072 lands); 2026-09-04 job-detail-restyle FC-A3 (DEV-only legacy installer rows); apk-0-3-0 FC-2 (iOS safe-area top unverified); apk-0-3-0 FC-3 (Jobs-tab native header stacking, adjacent to this change, needs device pass).
- Open prior contracts: 5. None fixed in this change.

## Deviations / Defects
none
