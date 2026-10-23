---BUILD REPORT---
# Build report: Materials Onsite unify (Estimate + Prelim share one checkbox, always with UPS tracking)

Date: 2026-10-22
Project: JobCore
Branch: jobcore-role-landing-0.1.3
Commit: pending (local only, NOT pushed; the committing session fills the hash in its summary)
Tier: A
Build completed: yes (not browser-verified)
Rules: 8 (report), 25 (Forward contracts), 37 (Deviations), 41 (Forward-contracts pre-write gate)

## Request (Jeff)
- Request (verbatim): `"Materials Arrived" checkmark state on Estimate does not match the one on the Prelim screen.`
- Decision (verbatim): `Just combine them and pick one and make them the same. I like "Materials Onsite" and it should always be accompanied by a Check UPS field and button.`
- Approval: `I approve. go`

## Root cause and fix
- Root cause: two checkboxes on two columns: `job_estimates.materials_onsite` (Estimate, "Materials Onsite?") vs `job_investigations.materials_arrived` (Prelim, "Materials arrived *").
- Fix: `job_estimates` is the single store. Prelim now reads/writes it via the estimates port, with a tracking field and a Check UPS button.

## What changed
Files under `app\`:
- `modules/field-tech/src/data/ports.ts`: `JobEstimate` gains `materialsOnsite`, `trackingNumber`, `trackingStatus`, `trackingCheckedAt`; `JobEstimateInput` gets optional versions; `EstimateRepository.trackShipment`.
- `apps/mobile/src/lib/field-tech-repos.ts`: mappings, `upsertForJob` patch blocks, optimistic defaults, `trackShipment` calling `ups-track`.
- `modules/field-tech/src/screens/tracking-helpers.ts`: NEW (67 lines): `TrackingResult`, `TrackingPatch`, `trackingResultToPatch`, `trackingStatusLine`.
- `modules/field-tech/src/screens/__assertions__/tracking-helpers.assert.ts`: NEW (110 lines).
- `modules/field-tech/src/screens/JobInvestigationScreen.tsx`: loads the estimate, Checkbox "Materials Onsite?", tracking TextField, Check UPS button; no `materialsArrived` left.
- `supabase/migrations/0098_materials_onsite_backfill.sql`: NEW (15 lines), UNAPPLIED, update-only, idempotent.
- `package.json`: test glob gains the new assert file.

## Behavior notes
- On Prelim the checkbox and tracking number now save immediately (as on Estimate), not on the Prelim Save button.
- The "*" was dropped.
- A Delivered UPS status auto-checks Materials Onsite on both screens.

## Verification
Run from `app\`:
- `npm test 2>&1 | Select-String '^# (tests|pass|fail)'`: 461 tests, 461 pass, 0 fail (baseline 446).
- `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing`: exit 0.
- `npx tsc -p <proj>/tsconfig.json --noEmit` for field-tech, admin-finance, apps/mobile: exit 0 each.
- NOT browser-verified.

## Evidence table (Rule 29)
Command: `Test-Path` equivalent (`[ -e <path> ]`) per path, run from `E:\Jeff\Codespace\SDAssemblyPros\Jobcore`.

| Path (under app\) | Status |
|------|--------|
| modules/field-tech/src/data/ports.ts | present |
| apps/mobile/src/lib/field-tech-repos.ts | present |
| modules/field-tech/src/screens/tracking-helpers.ts | present |
| modules/field-tech/src/screens/__assertions__/tracking-helpers.assert.ts | present |
| modules/field-tech/src/screens/JobInvestigationScreen.tsx | present |
| supabase/migrations/0098_materials_onsite_backfill.sql | present |
| package.json | present |

## Forward contracts
- The 0098 live push is pending Jeff's explicit go. Before it, run a read-only count of jobs with `materials_arrived = true` and no `job_estimates` row, because the update-only backfill leaves those unchecked.
- `job_investigations.materials_arrived` is retained in the DB but unused by the UI.

## Deviations / Defects
- (a) `tracking-helpers` adds a `result === null` case (message "UPS lookup failed.") that the plan table lacked; Screen D passes null when `trackShipment` throws.
- (b) `trackingStatusLine` does not take `trackingNumber`, so the caller renders the line only when a tracking number exists.
- (c) `package.json` test glob was edited to include the new assert file (npm test stayed 446 until then).
- (d) DEFERRED: generated snapshots under `docs\snapshots\v0.4.0\` still show the old label until UI Inventory is regenerated (memory `jobcore-ui-inventory-0058-regen.md`).
- (e) Retained plumbing for the old column: `app/apps/mobile/app/job/[jobId].tsx:603`, the investigation repo mapping and investigation types.
- (f) Rule 41 lineage check was limited to the adjacent calendar-redux report (Schedule-screen props, unrelated to this change); no wider JobCore lineage sweep was run.

Test plan: none, declined by Jeff (Rule 43 answered "No test plan").

Commit/push: local only, NO push.
---END BUILD REPORT---
