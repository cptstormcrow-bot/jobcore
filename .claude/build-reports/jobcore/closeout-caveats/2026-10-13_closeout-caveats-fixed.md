---BUILD REPORT---
GOAL: Fix the five caveats left by "Close-out moved from A&F to the Job menu".

RoA: jobcore / BUILD
Date: 2026-10-13 | Status: COMPLETE
Why: Follow-up to the 2026-10-12 closeout-to-job-menu build report (Flag items).
Decisions (Jeff, 2026-10-13): with no compensation policy, show "no compensation policy configured" and write nothing; closeOutJob is the only completed->paid path.
Out of scope: git push, Supabase push (none pending in this work tree).
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\closeout-caveats\2026-10-13_closeout-caveats-fixed.md

## Summary
Fixed the five caveats left by "Close-out moved from A&F to the Job menu". Not pushed. No Supabase push.

## Changes (all under app/)
1. Caveat 1 - JobCloseOutRegion.tsx: the empty catch is replaced by inline photoError state; failures on add photo, remove photo and close-out are shown, and cleared on the next attempt.
2. Caveat 2 - the picker is platform-aware. Web: file input, no permission request. Native: requests media-library permission and shows a message if denied. Cancel is a silent return.
   - WEB CHECK NOT DRIVEN: the 8081 dev app uses the hosted Supabase and sign-in was not performed by Claude, so file-chooser and cancel behaviour were verified by code and typecheck only.
   - Open: whether web blob: URIs need data-URI conversion at apps/mobile/src/lib/photo-files.ts:28 for offline replay is undecided.
3. Caveat 3 - new pure helper apps/mobile/src/lib/photo-asset-meta.ts (photoMetaFrom: mimeType, then fileName ext, then uri ext, then jpg/image/jpeg) plus photo-asset-meta.assert.ts, added to the apps/mobile package.json test script.
   - closeOutPhotos.add(jobId, uri, meta?) widened in modules/admin-finance/src/lib/module-ports.ts.
   - admin-finance-repos.ts uses meta.ext / contentType.
   - offline-ops/tech.ts uses p.contentType ?? contentTypeFor(p.ext).
   - offline-mutations.ts updated.
4. Caveat 4 - new compensation-policy repository reads the organization's newest compensation_policies row (hourlyRate, integer cents) via module-ports. JobCloseOutRegion shows "no compensation policy configured" and writes nothing when none exists. The placeholder policy is removed.
5. Caveat 5 - app/job/[jobId].tsx: the Paid menu item now calls selectRegion('closeout'); the direct completed->paid write is removed. closeOutJob is the only completed->paid path.

## Checked and unchanged
- offline-ops/admin-finance.ts:221 payout_batch.mark_paid sets payout_batches.status (a payout-batch status, not a job transition); unrelated.
- modules/admin-finance/src/index.ts jobActions are real; no stale comment, so planned slice 6 was a no-op.
- Docs sweep: docs/jobcore-basics-admin-finance.html:132 and docs/fragments/03-ch3.html:105 already say Close-out is reached from the Job menu directly below Paid; no edit needed.

## Test results
- tsc typecheck clean and 318/318 assertion tests passed (earlier this session).

Test plan: pending - Rule 43 question to Jeff after commit.

Forward contracts: none (the placeholder-policy contract is retired by caveat 4).

## Deviations / Defects
- (a) Caveat 2 web check not driven (see above).
- (b) Planned slice 6 skipped as a no-op.
- (c) Blob-URI offline-replay question open.
- No rule breaches known.
