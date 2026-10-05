---BUILD REPORT---

# Build Report: JobCore v0.3.0 UI mockup exactness

Plan slug: jobcore-v0.3.0-ui-inventory-storyboard
Date: 2026-10-05
Tier: A

## Method / Tools

Plan: E:\Jeff\.claude\plans\jobcore-ui-inventory-v0-3-0-closeout.md. Generator and self-check (generate.mjs, verify.mjs) under docs/snapshots/v0.3.0/_tools/. Page counts measured on PDFs with pypdf.

## What was built

The v0.3.0 ui-inventory and ui-storyboard mockups were made exact: real current labels (label exactness 1989/1989), the real AppChrome header, seed-derived sample data (no lorem ipsum), slice S4d name/role rotation widening (approved by Jeff: "yes, widen the scope a slice"), a print layout (one screen per page; phone frame 390px, pad frame 820px), and the Desktop/page title "JobCore UI Inventory v0.3.0".

Files changed in this closeout (git status --short -- docs/snapshots/v0.3.0), all under docs/snapshots/v0.3.0/:
- _tools/generate.mjs (modified)
- _tools/verify.mjs (modified)
- _tools/refuted.json (new)
- _tools/verify.json (new)
- ui-data.json (modified)
- ui-inventory.html (modified)
- ui-storyboard.html (modified)

Earlier slices (extract.mjs, render-mockup.mjs, screens.json, sample-data.json, ui-kit-styles.json) were already committed before this closeout (git log: c803c76 "rework v0.3.0 mockup extractor and renderer for exact labels (WIP)", cd444cc "skip dev-owner profile in v0.3.0 mockup name rotation (WIP)").

Print fix (@media print in generate.mjs): per-device zoom on .mock .jc-device phone=1.05 pad=0.78; .info zoom 0.6 phone / 0.5 pad; card height 188mm with an overflow:hidden guard; .toolbar and header.top hidden in print (the first attempt gave 75/74 pages because header.top spilled onto an extra page).

Commit: scoped to docs/snapshots/v0.3.0/ plus this report only; no push; other sessions' dirty files untouched. Delivery is by committed path (Desktop\Build-Reports is discontinued for JobCore).

## Verification

- node verify.mjs in docs/snapshots/v0.3.0/_tools: 20/20 checks pass.
- grep -c "Item title" ui-inventory.html = 0; grep -c "9:41" ui-inventory.html = 0.
- PDFs (phone, pad): each exactly 74 pages = 74 screens, A4 landscape (pypdf).
- Pre-patch baseline (Karen): threw=0, sample=614, unresolved=1141, data-empty-screen=8, label exactness 1989/1989.
- Desktop copy E:\Jeff\Desktop\JobCore UI Inventory v0.3.0.html equals repo ui-inventory.html (2,643,643 bytes both).

Forward contracts:
(a) Offer (not start) storyboard renderMiniNode thumbnail exactness after S8; out of scope here.
(b) Rule 41 lineage open items carried forward unchanged (none resolvable by this change):
- jobcore-assignments-board-layout\2026-10-03_assignments-board-layout.md:63 persistentScrollbar only code-reviewed on Android tablet; same file :65 FC4 offline ops replayable once repos carry client IDs.
- jobcore-cluster-a-title-bar-sop\2026-10-05_cluster-a-title-bar-sop.md:11-14 device pass in v0.4.0 test plan; Field Tech job-detail branch without AppChrome (cluster D); Calendar tab native header at (tabs)/_layout.tsx:8; visual-regression of other titleBar callers.
- jobcore-cluster-b-tech-picker-popup\2026-10-05_cluster-b-tech-picker-popup.md:11-12 device pass in v0.4.0 test plan; inspect EmployeeEditorScreen:424,431 and PriceSheetEditorScreen Select usages.
- admin-finance-overview-cards\2026-10-03_admin-finance-overview-cards.md:44 partly honored (title-bar bump landed in commits 7826612 and b0ce412).
- jobcore-assignments-board-layout\2026-10-05_s3-assignments-board-tech-picker.md:11-12 test plan 5.3 must quote "Drywall patch and paint touch-up"; the Real/Beta/Test/All row still shows "Real" with showTestJobs on.
(c) The prior report 2026-10-04_ui-inventory-storyboard.md declared `none`, so nothing from it is owed.

Test plan: declined by Jeff 2026-10-05 ("no test plan"); no self-check caveat applies (Rule 43).

## Deviations / Defects

1. Process: Nestor edited generate.mjs via Python/sed in Bash rather than the Edit tool.
2. Rule 43 test plan declined by Jeff.
3. Print pixel-fit NOT visually verified: no PDF rasteriser on this machine (pdftoppm, ghostscript, ImageMagick, fitz absent). Evidence is page count 74/74 plus CSS audit only; Jeff's "no clipping, reduce graphic first, use space below" requirement is satisfied structurally, not by eye.
4. 8081 app spot-check of af-employee-job-detail, admin-finance, af-jobs, config-test-jobs, ft-PremJobs, index, jobs, tabs-layout: the dev server redirects to /sign-in (no credentials used), so these were NOT visually compared. The page also showed a console message 'Duplicate module registration: a module with id "field-tech" is already registered.' (from another session's dirty app/modules/field-tech/src/index.ts; not touched).
5. Known limitations: null createdAt/completedAt/tech/scheduledStart fields in seed; role+status ternary labels stay whole-label unresolved (seed has no `active` flag); Calendar header data-unverified; Phone|Pad toggle vs the .mock flex basis and 390/820px frames.

## Summary

The v0.3.0 UI inventory and storyboard mockups now use exact current labels (1989/1989), seed-derived data and the real header, and print one screen per page (74/74). verify.mjs passes 20/20; print pixel-fit and the 8081 spot-check were not visually verified.

---END BUILD REPORT---
