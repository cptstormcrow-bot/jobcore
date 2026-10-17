# Build report: Job header + Estimate screen #0057 redlines

## Request
Apply Jeff's 2026-10-13 handwritten redlines (including Round 5 corrections) to (A) the shared Job header on every job screen and (B) the Estimate screen #0057. Plan of record: `E:\Jeff\.claude\plans\curious-wibbling-wave.md`. Scope IN: header title bar, stage timeline, Job #/schedule label/Next Steps, estimate body, Calendar Day view with route params and sand Back button, UPS tracking edge function. OUT: other screens' bodies, Calendar tab native header, Month view caps.

## What changed
(A) Job header, all job screens: new 3-part title bar with a 5px inset on job screens, stage timeline refresh, "Created:" dropped, Job # and date on two lines, scheduled label such as "Monday, Dec 12, 2026 - 9am" else "Unscheduled", linking to the Calendar. Files: `packages/ui` AppChrome, JobHeaderBlock, JobProgressBar, JobTitleBarHeader, job-header-format (+ assert), screen-numbers (ScreenNumberBadge, ScreenNumberContext, job-subview + assert); mobile `JobHeader.tsx`, `job/[jobId].tsx`, `JobCloseOutRegion.tsx`.

(B) Estimate screen #0057 is now one shared screen: admin-editable, tech read-only. #0059 (tech estimate editor) is retired by tombstone and `field-tech/.../JobEstimateEditor.tsx` is deleted. Status control and estimate status type changed (`packages/core` estimateStatus + assert, `EstimateStatusControl.tsx`): statuses are now draft, submitted, approved. Admin-finance: `JobEstimateScreen.tsx`, `approve-estimate.ts`, `ports.ts` (admin-finance and field-tech), `FieldJobDetail.tsx`, `JobInvestigationScreen.tsx`, `CloseOutReviewScreen.tsx`.

Calendar: new Day view (`packages/ui` DayView.tsx, WeekView, CalendarHeader), route params, sand Back button (`JobScheduleScreen.tsx`, `BlackoutEditorScreen.tsx`, `TimeOffTechCalendar.tsx`).

Server: new `supabase/functions/ups-track/` edge function; new shared module `modules/admin-finance/src/domain/estimate-layout.ts` with vendored copy `supabase/functions/estimate-resolve/estimate-layout.ts` and `estimate-layout-parity.assert.ts`; `estimate-resolve/index.ts` web page updated; migration `0089_estimate_redlines.sql` (unapplied). Repos/offline ops: `admin-finance-repos.ts`, `offline-ops/admin-finance.ts`. Registry and snapshots: `screen-registry.json`, `docs/snapshots/v0.4.0/_tools/routes.json`, `screens.json`.

Not ours (other session): JobPaymentRegion.tsx, domain/payments.ts, flows/record-job-payment.ts, 0087/0088 migrations, record-job-payment, payroll files.

## Verification (2026-10-16)
Karen slice 39 PASS (Karen run in this session, slice 39): tsc builds exit 0; `npm test` 345 pass / 0 fail; `assign-screen-numbers.mjs --check` prints "OK 87 active, 1 retired". Not browser-verified by Claude.

Forward contracts:
1. Migration `0089_estimate_redlines.sql` ships UNAPPLIED. It rewrites `job_estimates.status` 'rejected' to 'draft' and swaps the check constraint to (draft, submitted, approved), which is a data change. Applying needs Jeff's explicit go.
2. `ups-track` and `estimate-resolve` ship UNDEPLOYED; `UPS_CLIENT_ID` / `UPS_CLIENT_SECRET` are unset (Jeff's to set).
3. Vendored `supabase/functions/estimate-resolve/estimate-layout.ts` must stay byte-identical to `modules/admin-finance/src/domain/estimate-layout.ts` (guarded by `estimate-layout-parity.assert.ts`).
4. Fine Print seed is NEUTRAL placeholder wording pending Jeff's review, not legal advice.
5. Screen #0059 is retired by tombstone; #0057 covers both roles.
6. UI Inventory snapshot and version-history pages need regeneration.
7. Rule 41 carry-over: the Android device pass for the header/drawer (plus Close-out menu item) remains owed from reports 2026-10-11_drawer-header-sand-navy-palette, 2026-10-12_closeout-moves-to-job-menu, 2026-10-13_payroll-screen-all-roles, 2026-10-13_employee-hours-follow-payroll, 2026-10-13_blackouts-calendar-payroll-card. This change alters the same header, so the device pass now also covers the new 3-part title bar, the 5px inset and the Day view. Not dischargeable without Jeff's device. The Rule 41 pre-write check was run (Explore hound, 2026-10-16) but originally missed FC(3) of 2026-10-12_closeout-moves-to-job-menu.md (Themis flagged it); FC(3) was found and is carried forward as item 8 below (2026-10-09_job-plan-reset-pinned-buttons says none).
8. Carried from 2026-10-12_closeout-moves-to-job-menu.md FC(3): pressing 'Paid' before 'Close-out' does completed->paid with no commission row, so closeOutJob (app/modules/admin-finance/src/flows/close-out-job.ts:81) rejects the job as not ready. Not reconciled here. The Paid menu item now routes to the payment region (app/apps/mobile/app/job/[jobId].tsx:1289), a change owned by the payments session and outside these redlines.

## Deviations / Defects
(a) Header SOP narrowed: the 0.3.0 SOP widened the gold bar close to the buttons; Jeff's Round 5 5px inset overrides it for job screens only. Memory `feedback-jobcore-header-title-bar-sop` updated at closeout.
(b) Migration renumbered 0088 to 0089 because the payroll session took 0088.
(c) The 'Rejected' estimate status was dropped (UI type, DB constraint, and existing rows rewritten to draft). This goes beyond Jeff's literal redlines; he never explicitly dropped it. Flagged as a question for Jeff.
(d) Companion-file grouped slices 3, 32, 33 (declared in the plan, deviating from per-file slicing).
No other divergences found in the plan's Ledger or notes.

## Left alone on purpose
`packages/core` rollup.ts:31 reference; goal doc `.claude\goals\2026-09-02_job-detail-screen-goal.md:42`; dated older build reports.

## DEFERRED
none beyond the Forward contracts above.

Test plan: declined by Jeff 2026-10-16 (Rule 43; Jeff answered "no test plan"). No self-check performed: not browser-verified.

Commit/push: scoped commit, NO push; migration unapplied, no deploys.
