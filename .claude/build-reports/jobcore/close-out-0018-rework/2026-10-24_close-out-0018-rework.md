---BUILD REPORT---

Tier: A
Project: jobcore
Slug: close-out-0018-rework
Date: 2026-10-24
Branch: jobcore-role-landing-0.1.3
Commits: 6b3eae1, 67238c6, 30a0f47
Status: COMPLETE (Jeff's 2026-10-24 test plan passed 16 of 16)
Test plan: Rule 43 accepted by Jeff 2026-10-24; file E:\Jeff\Desktop\jobcore-commission-and-closeout-test-plan.html run by Jeff 2026-10-24: 16 of 16 pass (items 1.1, 2.1, 3.1-3.3, 4.1-4.4, 5.1, 6.1-6.6)

## Forward contracts:

1. Closed-job stored payouts view is still absent. Not recorded beyond that statement. Addressed 2026-10-24 by report jobcore-open-items-sweep: a closed job's Close-Out now shows the stored job_payout_lines read-only (built, tsc and npm test green; Jeff's click check on a closed job pending).
2. UI Inventory #0018 entry is not regenerated; another session owns docs/snapshots.
3. A closed job's Close-out region shows "Close-out opens once the job is completed." (reported to Jeff, not fixed). Addressed 2026-10-24 by report jobcore-open-items-sweep (same change; Jeff's click check pending).
4. Live click of commission / Dev flat / Prem posting CLOSED 2026-10-24: Jeff ran the test plan, 16 of 16 pass.

Rule 41 statement: this lineage's prior open contracts (FC1-FC7 of E:\Jeff\.claude\build-reports\jobcore\2026-10-24_job-pay-policy-closeout-history.md and the contracts of 2026-10-24_job-payout-lines-fc1.md) are evaluated in the companion report jobcore-tech-commission-toggle; see that report.

## Goal

Jeff's request (2026-10-24, screen #0018 Close-Out, job #107 Replace Water Heater): remove Tech / Prem tech / Service area from the top; move the tab bar up under the Job timeline ribbon with the buttons below it; show Job Paid/Unpaid amount and Hours Logged; remove the Contact button (did nothing), the Contacts tab, the Close Out tab and the Hours tab; Job history = the job's title line; Payouts said no pay set for Dev Tech though the roster showed $25/h; fix the Close out job error and the Closeout dot staying gray; fix yellow timeline dots that were once green.

## Root causes (from the plan)

- Close-out flow only accepted status completed (completed -> paid) while jobs arrive already paid; nothing ever wrote closed, so the Closeout and History dots stayed gray.
- tech_role was null for Dev Tech, so Payouts said no pay set.
- Stages contact / startWork / completeWork were non-sticky, so upstream edits turned them yellow.

## What changed

| Commit | Change |
|--------|--------|
| 6b3eae1 | Rework of #0018 (tab bar Payouts / Photos / Notes / Trail under the timeline, buttons below, job title line, Job Paid/Unpaid and Hours Logged, Contact button and Contacts / Close Out / Hours tabs removed, Prem Tech / Service Tech / Service Area and Next Steps hidden on this view); close-out flow takes the next edge (completed -> paid or paid -> closed); migration 0105_close_out_paid_to_closed.sql; job pay treats a null tech_role with a positive hourly rate as hourly; contact, startWork, completeWork made sticky; compensation.md updated. 11 files, 254 insertions, 145 deletions. |
| 67238c6 | Title reads Close-Out without the screen number, at Jeff's request (CloseOutReviewScreen.tsx, 1 file). |
| 30a0f47 | closeOutJob checks the returned status against the target and records a write failure pointing at migration 0105 when the database leaves the job at its old status; one new assertion (2 files, 30 insertions). |

Files in 6b3eae1: app/apps/mobile/app/job/[jobId].tsx; app/apps/mobile/src/components/JobCloseOutRegion.tsx; app/docs/compensation.md; app/modules/admin-finance/src/domain/closeout.ts; flows/close-out-job.ts and its assertions; money/job-pay.ts and its assertions; screens/CloseOutReviewScreen.tsx; packages/core jobStages assertions; app/supabase/migrations/0105_close_out_paid_to_closed.sql. (jobStages.ts needed no change: the sticky flag is set by the caller, [jobId].tsx lines 1029-1032 for contact, startWork and completeWork.)

Live: migrations 0104 and 0105 were pushed live on Jeff's explicit go earlier on 2026-10-24. Job #107 was later closed through the app (status closed, Closeout and History dots green) after 0106 / 0107 were pushed (see the companion report jobcore-tech-commission-toggle). The live data fix setting tech_role for Dev Tech: not recorded as run in the facts supplied.

## Verification

Type-check and npm test were run before the live push. Last recorded result: 559/559 tests passing and tsc clean, taken from the session crib (it includes another session's edits). Not re-run when writing this report.

## Deviations / Defects

1. A subagent ran git stash / stash pop during the build.
2. 6b3eae1 was committed before the Rule 43 question was asked.
3. An unused `ready` style was left in CloseOutReviewScreen.
4. 30a0f47 added a guard beyond the approved plan.
5. Commission is written on both close-out edges. Migration 0105 (header comment and the insert at lines 66-68) inserts the commission row on either completed -> paid or paid -> closed, with `on conflict ... do nothing`, so a job gets at most one active commission row whichever edge writes first and a retry is a no-op.
6. The live click exposed two defects the plan did not predict: "Could not close out: _closeout.nextCloseOutStatus is not a function", then "price_sheet_id violates not-null" (the second is fixed by the commission build, report jobcore-tech-commission-toggle).
7. UI Inventory #0018 entry not regenerated (another session owns docs/snapshots).
8. The closed-job Close-out region shows "Close-out opens once the job is completed." (reported to Jeff, not fixed). Addressed afterwards in jobcore-open-items-sweep.
9. The two reports of this lineage dated 2026-10-24 filed by another stream sit in the admin-repo root E:\Jeff\.claude\build-reports\jobcore\, against the project-local canonical-root decision; left in place.

Commit: 6b3eae1, 67238c6, 30a0f47 (no git push).
---END BUILD REPORT---
