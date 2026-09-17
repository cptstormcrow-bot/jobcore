---
classification: build-reports/jobcore
comments: "E-visit to Prem visit UI label rename — Tier-A closeout"
origin: .claude/build-reports/jobcore/2026-09-17_prem-visit-rename.md
tags: [build-report, jobcore, tier-a]
---
# Build Report: E-visit → Prem Visit UI Label Rename

**Date:** 2026-09-17
**Branch:** jobcore-job-detail-action-buttons
**Commit:** a729a24 — fix(jobcore): rename E-visit to Prem visit in UI labels
**Trigger:** Explicit Jeff instruction — "Be sure that everything, buttons, descriptions, labels,
etc, that are marked E-visit, prelim visit, should now be marked 'Prem' visit."
**Tier:** A

## Summary

Renamed four user-facing display strings from "E-visit" to "Prem visit" across two files. No
internal identifiers, enum values, state keys, database columns, or migration references were
touched — this is a display-text-only change.

Verified via `git show a729a24`: 2 files changed, 4 insertions(+), 4 deletions(-).

## Files Changed

- `app/apps/mobile/app/job/[jobId].tsx`
  - Line ~900: `label: 'Prelim (E-visit)'` → `label: 'Prelim (Prem visit)'` (menu item, `id: 'evisit'`
    left unchanged)
  - Line ~979: `'Assign E-visit Tech'` → `'Assign Prem visit Tech'` (fallback label in the
    Assign-tech button, ternary keyed off `estimate?.status === 'approved'`)
  - The internal identifier `id: 'evisit'` / `region === 'evisit'` was deliberately left unchanged —
    it is an internal routing key, not display text.
- `app/apps/mobile/src/components/JobDetailsForm.tsx`
  - Line ~195: `label="Parking (E-visit)"` → `label="Parking (Prem visit)"` (bound to
    `value.evisitParking`, field name unchanged)
  - Line ~234: `label="Panel (E-visit)"` → `label="Panel (Prem visit)"` (bound to
    `value.evisitPanel`, field name unchanged)

## Explicitly Out of Scope

Verified on disk that the following still say E-visit/evisit, confirming they were correctly left
untouched (historical migration documentation, not live UI text):

- `app/supabase/0042_job_planning_evisit_columns.sql` — line 1 comment: "Plan region's own editable
  copy of the E-visit fields (ingress/logistics/parking/state)."
- `app/supabase/migrations/0042_job_planning_evisit_columns.sql` — identical line-1 comment (mirror
  copy).
- `app/supabase/README.md` — line 59, migration-index row for `0042_job_planning_evisit_columns.sql`,
  same "E-visit fields" wording.

## Test plan

Skipped. Trivial, no-logic string-only label rename with zero behavior change (4 lines changed
across 2 files, no state/props/logic touched). Jeff closed out the task without requesting a test
plan. Not a Rule 43 violation — the rule's own gate is asking Jeff, which was satisfied.

## Deviations / Defects

None. The two out-of-scope migration/doc files above are intentional scope boundaries stated in the
original instruction's intent (UI labels only), not defects.

Two known pre-existing defects were checked and confirmed untouched by this change (both out of
scope, unrelated to this rename):

1. **JobDetailsForm.tsx description/considerations binding bug** — the "Description" /
   "Project details" `TextField` (lines 274-283) reads and writes `value.considerations`, not
   `value.description`. Confirmed still present at lines 274-283 post-rename; this commit did not
   touch that block.
2. **JobHeader prop-type mismatch** — `JobHeaderProps` is missing `region`/`onSelectRegion`,
   mismatching the `[jobId].tsx` call site. Not touched by this commit.

## Forward contracts

None. Pure cosmetic label change, no new behavior, no promises to future work.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
