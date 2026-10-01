---BUILD REPORT---

# JobCore: Profiles sensitive-column guard (migration 0071)

**Date:** 2026-09-30
**Project:** jobcore
**Tier:** A
**Status:** COMPLETE
**Plan:** `E:\Jeff\.claude\plans\jobcore-profiles-role-guard-lock-profilesrole-and-other.md`
**Branch:** jobcore-job-detail-action-buttons

## Goal

Jeff: "find out how to secure that role".

## Summary

All paths are relative to `app\`.

- `supabase/migrations/0071_profiles_sensitive_column_guard.sql` (new, 81 lines): a BEFORE UPDATE trigger function `guard_profiles_sensitive_columns()`, SECURITY INVOKER, search_path ''. It acts only when the current user is `authenticated` or `anon`. The columns id, organization_id, role and created_at cannot be changed by them (raises 42501). An org admin (`is_org_admin()`) may change other columns; a non-admin may change only their own full_name and phone. The migration also revokes insert/update/delete/truncate from anon and truncate from authenticated. Role changes now go only through the 0029 RPC `admin_set_employee_role`. Pushed live to the hosted project with Jeff's go; grants verified.
- `supabase/tests/0071_profiles_sensitive_column_guard_rls.test.sql`: local suite, NOT run.
- `supabase/tests/0071_profiles_sensitive_column_guard_rls.hosted.test.sql`: single-file hosted version (uses `$$`, which the CLI rejects).
- `supabase/tests/0071_hosted_cases/`: cases 01-10 plus a README, one case per file, no `$$`.
- `supabase/README.md`: 0071 paragraph and case table.
- `supabase/migrations/0002_profiles_role_column_guard.sql`: NOTE comment only, pointing to 0071.
- `packages/core/src/offline/replay.ts` (about L72): doc comment that 42501 must be treated as a permanent failure.

## Verification

All 10 hosted cases were run live on 2026-09-30 and matched expectations:

| Case | Result |
|---|---|
| 01 | rows 1 |
| 02 | 42501 |
| 03 | 42501 |
| 04 | 42501 |
| 05 | rows 0 (row hidden by RLS before the trigger) |
| 06 | rows 1 |
| 07 | 42501 |
| 08 | RPC rows 1 |
| 09 | anon 42501 |
| 10 | postgres owner rows 1, then rolled back |

Seed post-check passed (data unchanged). tsc green; npm test 168/168.

Test plan: declined by Jeff ("Skip it" — the 10 live cases already prove the guard).

## Forward contracts

Forward contracts:

1. When offline replay sending is wired, a 42501 from profiles must be treated as permanent (no retry) — see the `replay.ts` doc comment. Today `replayQueue` never retries, and `replayPending` in `apps/mobile/src/lib/offline-db.ts:102-113` has no callers.
2. The local suite `0071_profiles_sensitive_column_guard_rls.test.sql` is unrun; it needs a local Supabase stack.

## Prior contracts (Rule 41)

35 prior JobCore reports scanned (bare `jobcore` dir; no `jobcore-*` dirs). No open contract names profiles, user_role, 0002, 0029, 0071, admin_set_employee_role, or replay. Four adjacent open contracts are carried forward and are NOT affected by this change:

- `2026-09-29_sales-role-navigation.md:61` FC4: optional email-change end-to-end test (Jeff runs it; sends a real email).
- `2026-09-26_jobcore-save-followups-rpc-trigger-awaitsave.md:60`: customer.saveForJob needs an offline replay handler once replay is wired (out of scope; replay not wired).
- `2026-09-04_leads-screen-create-edit-job.md:62` FC2: camelCase lead.create replay check; needs a device queue.
- `2026-09-01_job-estimate-wave2-slice-d-migrations.md:39`: RLS suite and smoke checks from Employee Screen Edits still unrun (hosted-DB gated).

## Deviations / Defects

- Defect: hosted cases 02, 07 and 10 first failed with 42804 (CASE text vs enum `public.user_role`); fixed by adding a `::public.user_role` cast. Noted in the README.
- Defect: the seed post-check first failed 42703 (profiles has no email column); fixed by joining auth.users.
- Deviation: the single-file hosted test uses `$$`, which the CLI rejects; it was split into per-case files (Jeff's "b please").
- Process slips: workflows launched without the 4-line preflight; some Rule 18 narrations and status lines missed; one Rule 18 narration named a non-roster persona for an Explore agent; several compactions mid-run; after a compaction the resume text was misread as "don't ask questions" (Jeff corrected 2026-09-30).
- Known limits (not fixed, not in scope): no generated DB types; admin INSERT on profiles is not column-limited; hosted cases depend on seed rows.
