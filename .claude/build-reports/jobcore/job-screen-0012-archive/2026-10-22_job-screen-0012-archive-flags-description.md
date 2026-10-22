---BUILD REPORT---
# Job Screen #0012 - Archive / Archived list / Unarchive, status flags, work description

Tier: A
Date: 2026-10-22
Branch: jobcore-role-landing-0.1.3
Commits: 011e200 (Slice A), 6e02985 (Slice B, 17 files), 0495f91 and 46d1017 (docs). Git: nothing pushed (local only). Migration 0095: LIVE (see Forward contracts).
Plan: E:\Jeff\.claude\plans\job-screen-0012-i-nested-catmull.md

## What changed
- Slice A (011e200): green card-center flags `Prem done` and `Estimate approved` (FlagPill via ListItem center slot); work description appended to `Job #` in the card footer (summarizeWorkDescription, fail-soft JobCardExtras repo, never blocks the board).
- Slice B (6e02985): **Archive** button (relabeled from Delete) with an "Are You Sure?" confirm, immediately left of Detail, owner/admin only; **Archived** button beside Add Job opening the new Archived Jobs screen; **Unarchive** per row; tapping an archived row drills into that job. No hard delete anywhere.
- Migration `app/supabase/migrations/0095_archive_unarchive_job.sql` (archive_job / unarchive_job security-definer RPCs, column jobs.archived_from_status). LIVE on the linked Supabase project as of 2026-10-22 (pushed from another session; verified by a read-only DB probe, see Forward contracts).
- Archived Jobs screen registered as #0092 `af-archivedJobs` (subView `archivedJobs`), mirrored into docs/snapshots/v0.4.0/_tools/routes.json and screens.json, line-1 stamp on ArchivedJobsScreen.tsx.
- Fixed the wrong number on the Archived page (it showed #0010): `SCREEN_NUMBER_KEY.archivedJobs` held the registry key, but the resolver matches the `subView` field. Removed the map entry; #92 now resolves via the sub-view fallback.
- Non-duplication guard: new `app/packages/ui/src/__assertions__/screen-registry-integrity.assert.ts` (4 tests, runs in npm test).
- `'archived'` added to the job-status allowlists/mappers (admin-finance and field-tech ports) and excluded from open-job counts (day-list-helpers, JobOverviewRegion).
- New shared `confirmAsync` / `notifyAsync` in app/packages/ui/src/confirm.ts (test-jobs.tsx re-pointed).
- Docs (Rule 31): app/docs/ui-conventions.md line 32 documents the Archive / Archived / Unarchive buttons and testIDs.

## Files committed in 6e02985
app/apps/mobile/app/config/test-jobs.tsx; app/apps/mobile/src/components/JobOverviewRegion.tsx; app/modules/field-tech/src/screens/day-list-helpers.ts; app/modules/field-tech/src/data/ports.ts; app/modules/admin-finance/src/data/ports.ts; app/apps/mobile/src/lib/admin-finance-repos.ts; app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx; app/modules/admin-finance/src/screens/ArchivedJobsScreen.tsx (new); app/packages/ui/src/confirm.ts (new); app/packages/ui/src/index.ts; app/packages/ui/src/__assertions__/screen-registry-integrity.assert.ts (new); app/modules/admin-finance/src/flows/__assertions__/close-out-job.assert.ts; app/apps/mobile/src/screens/screen-registry.json; docs/snapshots/v0.4.0/_tools/routes.json; docs/snapshots/v0.4.0/_tools/screens.json; app/docs/ui-conventions.md; app/supabase/migrations/0095_archive_unarchive_job.sql (new).

## Forward contracts:
- Migration 0095 is LIVE (pushed from another session; honored). Evidence, read-only probe 2026-10-22 via `npx -y supabase@2.116.0 db query --linked --file chk095b.sql`: archive_job=1, unarchive_job=1, jobs.archived_from_status column=1, schema_migrations versions >=0093 = [0093,0094,0095,0096], jobs with status 'archived' = 1. The probe proves existence only, not behavior.
- Screen #0092 `af-archivedJobs` is minted in the registry and mirrored 1:1 into the v0.4.0 snapshot tools; the UI Inventory snapshot/PDF regen (claim-box rule, 0058 regen note: 3 overflow screens open) is not done here.
- Commits 011e200 and 6e02985 are local only (no push, standing rule).
- Live-DB BEHAVIOR verification of archive/unarchive is DONE (honored) on 2026-10-22, run on TEST rows only inside uncommitted transactions (begin; no commit) via `npx -y supabase@2.116.0 db query --linked --file <scenario.sql>` from the app folder. Results: (1) non-admin archive_job -> 42501 "archive_job: admin role required"; (2) non-admin unarchive_job -> 42501 "unarchive_job: admin role required"; (3) round trip: archive set archived with stash in_progress, unarchive restored in_progress and cleared the stash (null); (4) closed fallback: a job archived with no stash came back as closed/null; (5) customer_has_open_job: unarchiving into an open status while the same customer had another open job raised P0001 customer_has_open_job (raised by jobs_one_open_per_customer() via unarchive_job), which the client maps to "This customer already has an open job - close or archive it first." Cleanup evidence: probe `npx -y supabase@2.116.0 db query --linked --file chk_cleanup.sql` returned test_customers=0, test_jobs=0, archived_jobs=1 (equals the pre-test baseline of 1), so no test rows persist.

## Deviations / Defects
- Registry-integrity check 3 deviates from the written spec: it asserts distinct (route, subView, scopeOf(file)) triples rather than distinct (route, subView) pairs, because shared (route, subView) pairs are legitimate registry data. Accepted.
- Cosmetic archived-terminal tweak in app/apps/mobile/app/job/[jobId].tsx was never applied; that file is the parallel session's and its only dirty hunk (onSchedulePress move) is not ours. Flagged to Jeff.
- app/apps/mobile/app/job/[jobId].tsx and app/apps/mobile/src/components/JobPaymentRegion.tsx remain modified and unstaged: they belong to the parallel session and were deliberately left out of both commits.
- Memory feedback-jobcore-payroll-button-style-sop.md line 19 cited `SCREEN_NUMBER_KEY` at AdminFinanceRoot.tsx:132 (stale; the map is now near :150). Corrected 2026-10-22 to a line-number-free reference (Rule 31, found by Curio at closeout).
- Otherwise none found in this change's own output.

## Test plan:
declined by Jeff 2026-10-22 (no test plan requested)

## Delivery
This file is committed in the project repo; delivery is by reporting its full path in chat. No Desktop copy.
