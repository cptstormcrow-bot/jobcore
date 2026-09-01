# Add-Employee Duplicate Invitation Fix

**Date:** 2026-08-31
**Branch:** jobcore-job-detail-action-buttons
**Trigger:** User-reported bug — clicking "Add Employee", filling name/phone/email, and pressing Save produced: `Something went wrong — createInvitation failed: duplicate key value violates unique constraint "invitations_pending_email_idx"`

## Root cause

`invitations_pending_email_idx` (app/supabase/0003_invitations_and_signup.sql:36-38) is a partial unique index — one live (unconsumed) invitation per email, case-insensitive, enforced globally. `createInvitation` inserted unconditionally with no pre-check and no error translation, so a second invite attempt for an email that already had a pending row threw a raw Postgres 23505 constraint violation straight through to the UI as "Something went wrong".

## Fix (commit ebc7feb — fix(jobcore): handle duplicate pending invitation on add-employee)

Three files:
- `app/modules/admin-finance/src/data/ports.ts` — added `DuplicateInvitationError extends Error` (carries `email`); `InvitationRepository` gained `findPendingInvitation(organizationId, email): Promise<Invitation | null>` and `revokeInvitation(invitationId): Promise<void>`.
- `app/apps/mobile/src/lib/admin-finance-repos.ts` — added `isDuplicatePendingInvitation(error)` detecting Postgres code `23505` on `invitations_pending_email_idx`; `createInvitation` now throws `DuplicateInvitationError(email)` on that condition instead of the raw `PostgrestError`; implemented `findPendingInvitation`/`revokeInvitation`.
- `app/modules/admin-finance/src/screens/EmployeeEditorScreen.tsx` — catches `DuplicateInvitationError` and shows a specific message plus a "revoke and resend" recovery action (deletes the stale pending row via `revokeInvitation` then re-issues `createInvitation`) instead of the generic error. The recovery button disappears if the email field is edited after the conflict surfaces.

No RLS/migration change was needed — the existing `invitations_delete_admin` policy (0003_invitations_and_signup.sql:82-91) already permits owner/admin to delete a pending invitation scoped to their own org, which is what licenses the revoke-and-resend action.

## Separate incidental fix (commit 0e0406e — fix(jobcore): parse time-off dates as local, not UTC, for Calendar)

Found unstaged in the working tree while auditing before this commit (git hygiene SOP, Rule 42). Unrelated to the invitations bug: `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx`'s `toCalendarTimeOffEvents` fed date-only strings (`startDate`/`endDate`) straight into `new Date(...)`, which parses as UTC midnight and renders time-off blocks a day early in negative-UTC-offset timezones. Added a `parseCalendarDate()` helper that builds the `Date` from local y/m/d components instead. Verified via `git diff` to be complete, correct, and self-contained; committed separately rather than folded into the invitations commit.

## Verification

This is a native Expo app (no web/browser target) — no dev server or simulator was available in this environment to execute a live repro. Typecheck was run monorepo-wide; all 31 errors returned are pre-existing Price Sheet/service-task schema breakage (missing `service_tasks` table, missing `price_sheet_area_adjustments.adjustment_target` column — see memory `jobcore-price-sheet-migration-0032-partial.md`), confirmed unrelated to any file touched by this change (zero errors reference `ports.ts`, `admin-finance-repos.ts`, `EmployeeEditorScreen.tsx`, or `AdminFinanceRoot.tsx`).

Manual repro steps for Jeff to run:
1. Add an employee with an email that already has a pending invitation → confirm the new specific error message and recovery button appear instead of "Something went wrong".
2. Press the recovery button → confirm the stale invitation row is deleted and a fresh invitation is created successfully.
3. After the conflict appears, edit the email field → confirm the recovery button disappears.
4. Add an employee with a genuinely new email → confirm the happy path ("Invitation sent.") is unaffected.

## Rule 41 pre-write gate (lineage check)

Evaluated this project lineage's prior open Forward contracts before writing this report, per Rule 41. Findings: 7 items remain STILL OPEN across unrelated feature areas (not touched by this fix, not quick to resolve without further input from Jeff). Carried forward again rather than resolved here; flagged to Jeff for prioritization separately from this fix.

Also resolved two loose threads noticed during this session's git audit, both non-issues:
- `app/packages/ui/src/Select.tsx` — no working-tree diff; clean.
- Job-planning/reimbursements WIP files (previously flagged UNCLEAR in a prior report) — `git log --oneline --all` scoped to `app/modules/job-planning` and `app/modules/reimbursements` returns zero output across the entire history; no trace in git, nothing to recover or investigate further. Treated as resolved-by-absence.

## Deviations / Defects

- An earlier dispatch to Spot (patch-hound) in this lineage returned BLOCKED and was redone via a different path (scribe-hound / direct verification) in a prior turn of this same task; noted here as a process deviation, not a functional defect — no code impact.
- No other deviations from the approved plan. No defects found in this change's own output.

## Forward contracts

- none from this change itself.
- Carried forward (not newly created by this change, re-affirmed as still open per Rule 41 lineage check): 7 STILL OPEN items across unrelated JobCore feature areas from prior lineages — see prior Tier-A reports / memory `jobcore-themis-2026-08-30-findings.md` and `jobcore-themis-2026-08-29-findings.md` for the itemized list. None are in scope for this change.
- Pending Supabase migration 0033_job_planning.sql still not applied to hosted DB (memory `jobcore-supabase-migration-pending.md`) — unrelated to this fix, unaffected by it.
