---BUILD REPORT---

# Admin-driven employee email change

## Summary

Owners and admins can change another employee's login email from Edit Employee. Parts:
- Migration 0075 adds `profiles.email`; applied live via db push after Jeff's explicit go.
- Edge function `app/supabase/functions/admin-update-email` (index.ts + DEPLOY.md) with CORS/OPTIONS handling, deployed live 2026-10-06 via `supabase functions deploy admin-update-email` (JWT verification left on, no extra secrets).
- `Profile.email` in `packages/core/src/index.ts`.
- `changeEmployeeEmail` port (`modules/admin-finance/src/data/ports.ts`) and repo (`apps/mobile/src/lib/admin-finance-repos.ts`; `toProfile` maps email).
- Email card at top of `EmployeeEditorScreen` (edit mode: current email line plus Change email button); Email row on `EmployeeDetailScreen`.
- New `forgot-password.tsx` and `reset-password.tsx` screens, plus `sign-in.tsx`, `_layout.tsx` and `session.tsx` changes.
- `rollup.assert.ts` touched.

## Files changed

- app/apps/mobile/app/_layout.tsx
- app/apps/mobile/app/sign-in.tsx
- app/apps/mobile/src/lib/admin-finance-repos.ts
- app/apps/mobile/src/lib/session.tsx
- app/modules/admin-finance/src/data/ports.ts
- app/modules/admin-finance/src/money/__assertions__/rollup.assert.ts
- app/modules/admin-finance/src/screens/EmployeeDetailScreen.tsx
- app/modules/admin-finance/src/screens/EmployeeEditorScreen.tsx
- app/packages/core/src/index.ts
- New: app/supabase/migrations/0075_profiles_email.sql
- New: app/supabase/functions/admin-update-email/ (index.ts, DEPLOY.md)
- New: app/apps/mobile/app/forgot-password.tsx
- New: app/apps/mobile/app/reset-password.tsx

## Verification

Type-check clean: core, ui, module-sdk, admin-finance, field-tech, sales-marketing built with `tsc -b --force`, then apps/mobile `tsc --noEmit`. The edge-function smoke matrix in DEPLOY.md has NOT been run live.

Forward contracts:
(1) Run the DEPLOY.md smoke matrix against the live function: 200 same-org admin, 403 tech, 404 other-org, 400 own id, 409 email_taken, 405 non-POST, OPTIONS 2xx with Access-Control-Allow-Origin, 400 bad body, 401 no bearer.
(2) The Try Again button on the error screen re-runs the check with no loading state; root-caused but not changed, awaiting Jeff's okay.

Rule 41 check of prior report (2026-10-05_ui-mockup-exactness.md) contracts: (a) storyboard thumbnail exactness, unrelated; (b) lineage carry-forwards, unrelated (the cluster-b item naming EmployeeEditorScreen:424,431 is untouched, not resolved here); (c) nothing owed.

Test plan: offered per Rule 43, not yet accepted by Jeff.

## Deviations / Defects

- The first deployed function lacked CORS/OPTIONS handling, causing "Failed to send a request to the Edge Function" on the web dev server; fixed in code and redeployed.
- The live DB lacked `profiles.email` until the 0075 push.
- Test plan was offered per Rule 43 but not yet accepted by Jeff.
- Otherwise none.
