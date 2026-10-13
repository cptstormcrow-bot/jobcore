---BUILD REPORT---
GOAL: Close-out Review (#0018) moves from the Admin & Finance root into the Job menu, below Payment, labelled "Close-out".

RoA: jobcore / BUILD
Date: 2026-10-12 | Status: COMPLETE
Why: Jeff's request (verbatim): "Close-out Review screen #0018 and screen #0017 belong in the job menu below Payment, should say "Close-out". So these screens need to be moved from the First A&F to Job menu. Close outs are attached to each job now."
Decisions: #0017 parked (stays as file + registry entry, route null); "wire photo picker (I3). I4 guard stays."
Out of scope: screen numbers, git push, Docker, live Supabase push, close-out business rules (domain/closeout.ts, flows/close-out-job.ts).
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\closeout-to-job-menu\2026-10-12_closeout-to-job-menu.md

## Summary
- The job screen menu now has a "Close-out" item after "Paid". It shows #0018 Close-out Review for that job (embedded), plus a photo picker, in a new JobCloseOutRegion component.
- The Admin & Finance root no longer carries the close-out sub-views, and its Overview drops the Close-Outs card (10 cards expected).
- #0017 CloseOutQueueScreen is parked: file and registry entry kept, route null. #0018 route is now /job/[jobId].
- The two help docs now say close-out is reached from the Job menu.
- Dirty files owned by other sessions were excluded from the commit. No push, no migration.

## Files changed (all under app/)
New:
- apps/mobile/src/components/JobCloseOutRegion.tsx (132 lines)
Modified:
- apps/mobile/app/job/[jobId].tsx (#0018 header comment, import, stage map, menu item 'closeout'/"Close-out" after 'paid', render block with `&& role` guard)
- apps/mobile/src/components/JobHeader.tsx (JobRegion gains 'closeout')
- packages/ui/src/screen-numbers/job-subview.ts
- packages/ui/src/__assertions__/job-subview.assert.ts
- apps/mobile/src/screens/screen-registry.json (#18 route /job/[jobId], #17 route null)
- modules/admin-finance/src/screens/CloseOutReviewScreen.tsx (embedded prop)
- modules/admin-finance/src/screens/AdminFinanceRoot.tsx (close-out sub-views removed, 59231 to 54597 bytes; awaitingCloseOut import and count retained)
- modules/admin-finance/src/domain/overview-cards.ts (Close-Outs card dropped)
- modules/admin-finance/src/domain/__assertions__/overview-cards.assert.ts (10 cards expected)
- docs/jobcore-basics-admin-finance.html and docs/fragments/03-ch3.html (reworded: close-out reached from the Job menu)

## Test results
- `npx tsc -p apps/mobile/tsconfig.json --noEmit`: exit 0
- packages + modules `tsc -b --force`: exit 0
- Assertion runner over overview-cards, job-subview, close-out-job: 16 pass, 0 fail

Test plan: ran (Rule 43); 8 of 8 steps passed by Jeff.

Forward contracts:
- CloseOutQueueScreen (#0017) is parked, not deleted; if a cross-job queue returns it needs a host and a registry route.
- Rule 41 check done 2026-10-12: lineage open contracts (0.4.0 release reconcile, job-photos bucket policy, sales-marketing offline tests, create_payout_batch param mismatch, Android device pass, help-cards payroll hunks, migrations 0080-0085 unpushed, legacy addTask signature, shared blackout week-view key) reviewed; none resolvable by this change, none needs Jeff's input. Honored: yes, nothing dangling.

## Deviations / Defects
- Slice 3 split across two hounds (Spot on [jobId].tsx; Nestor on JobHeader.tsx, job-subview.ts, its assert, registry) instead of the plan's single hound (Rule 33).
- Slice 4 first Spot dispatch returned BLOCKED (given line ranges, not literal anchors); re-dispatched with literal anchors + expectedCount and succeeded.
- Nestor edited overview-cards.ts and its assert together in one dispatch.
- Spot reported 12 edits vs 11 specified for AdminFinanceRoot.tsx; unexplained, tsc and greps show no breakage.
- tsc caught TS2322 (Role|undefined) at [jobId].tsx render of the close-out region; fixed with an `&& role` guard.
- Dirty files owned by other sessions were excluded from the commit.

## Flag items (out of scope, not fixed)
- Add-photo errors are silently caught in JobCloseOutRegion.
- Web photo-picker behavior unknown (native only verified).
- jpg extension is hard-coded.
- compensationPolicy is a placeholder (id '', rate 0).
- The Paid item moves completed to paid with no commission row, so pressing Paid first makes closeOutJob reject the job as not ready.
- Separate unrelated stray error "Could not load pay period: [object Object]" originates at app/packages/payroll-ui/src/PayPeriodPanel.tsx:112.
