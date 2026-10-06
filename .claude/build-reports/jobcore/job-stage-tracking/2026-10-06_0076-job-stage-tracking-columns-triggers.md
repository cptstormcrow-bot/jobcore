---BUILD REPORT---

# Migration 0076: job stage tracking columns and triggers (slice B)

Commit: 1abc4d7 "feat(db): 0076 job stage tracking columns and triggers (slice B)", branch jobcore-role-landing-0.1.3, not pushed.

## Summary

New file `app/supabase/migrations/0076_job_stage_tracking.sql` (77 lines). Adds four columns to `public.jobs`: `updated_at`, `contacted_at`, `stage_marks`, `upstream_changed_at`. Adds BEFORE UPDATE triggers that maintain `updated_at` and bump `upstream_changed_at` when an upstream-facing column changes. Idempotent. No RLS changes.

Slice context: slice A = commit c1eabc4 "Job Details 15-stage derivation engine" (core). Slice B = this change. A later slice (C) is expected to consume `stage_marks`, `contacted_at` and `upstream_changed_at` from the app/UI side.

## Verification

- Applied to the hosted Supabase project.
- Smoke check (scratchpad `smoke_0076.sql`): a no-op update on one jobs row bumped `updated_at`, left `upstream_changed_at` unchanged, and all 4 columns were present. This was the negative-path check; it passed.
- Grep of `app/` for `upstream_changed_at`: only the migration file matches; no app code reads it yet.
- Docs sweep (Rule 31): `README.md:72` mentions migrations only generically ("migrations, RLS policies, edge functions"); no doc lists the jobs schema or individual migrations. No doc update needed. `docs/snapshots/v0.3.0/ui-inventory.pdf` matched the search but is a generated snapshot, not a schema doc.

## Rule 41 check

Prior reports in this lineage were scanned for Forward contracts. The most recent, `employee-phone-copy-retry-state/2026-10-06_employee-phone-copy-retry-state.md`, records that the email-change report's contract (1) (DEPLOY.md smoke matrix against the live email-change function) is still open; it is unrelated to this change and untouched. Older reports carry other open items in unrelated feature areas (for example 2026-08-30 job-detail-action-buttons, 2026-09-02 job-investigation-estimate-approval, 2026-09-04 field-tech-timeoff-modal-month-view); I did not audit each one individually and none is touched by this change. Nothing was fixed here.

Forward contracts:
1. Any later slice that writes or reads `stage_marks` must treat its JSON shape as defined by slice A's engine (c1eabc4).
2. The migration is already live on hosted, so any change to these columns needs a new numbered migration, never an edit of 0076.
3. The app does not yet read the new columns (confirmed: Grep of `app/` finds `upstream_changed_at` only in 0076).
Prior open contracts (unrelated): remain open and untouched by this change.

## Deviations / Defects

none. The CRLF warnings at commit time are a git autocrlf notice, not a defect.

## Test plan

Test plan: deferred. Slice B is schema-only with no UI surface, so there is nothing Jeff can see. The plan is deferred to the slice that surfaces the stage in the UI; per Rule 43 Jeff is asked at closeout of the whole project, not per slice.

## DEFERRED

| Item | Reason | Owner / when |
|------|--------|--------------|
| Test plan | Schema-only slice, no visible UI | Slice that surfaces the stage in the UI; Rule 43 ask at project closeout |
| App-side consumption of `stage_marks`, `contacted_at`, `upstream_changed_at` | Belongs to slice C | Slice C |
