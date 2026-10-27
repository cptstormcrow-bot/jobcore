---BUILD REPORT---
Project: jobcore / universal-calendar-payroll-buttons
Date: 2026-10-24
Tier: A
Plan: Open Item 2 (Jeff order 2026-10-24: "convert the legacy Blackouts and Request time off buttons in the universal calendar to the payroll button style"); plan mode skipped by declaration (trivial single-file restyle)
Branch/repo: E:\Jeff\Codespace\SDAssemblyPros\Jobcore, jobcore-role-landing-0.1.3
Test plan: none (Jeff: no test plan for Item 2, 2026-10-25)
Forward contracts: none

## Goal
Move the two legacy `Button` calls that render "Blackouts" (toggles to "Cancel" while picking days) and "Request time off" (toggles to "Cancel" while requesting) in UniversalCalendar onto the app-wide `PayrollButton` from `@jobcore/ui`, default sand tone, per the PayrollButton SOP.

## Changed files
| File | Change | Commit |
|---|---|---|
| `app/modules/admin-finance/src/screens/UniversalCalendar.tsx` | line 5: import widened to include `PayrollButton`; line 268: `<PayrollButton label={pickDays ? 'Cancel' : 'Blackouts'} onPress={handleTogglePick} />`; line 272: `<PayrollButton label={requesting ? 'Cancel' : 'Request time off'} onPress={handleToggleRequest} />` | `253fa5d` (1 file, +3/-3) |

## Verification (Rule 29)
- Type check, from `app/`: `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` -> exit 0; `npx tsc -p modules/admin-finance/tsconfig.json --noEmit` -> exit 0 (output `<scratchpad>\tsc-item2.txt`, last lines `build exit=0` / `af exit=0`).
- `git -C E:\Jeff\Codespace\SDAssemblyPros\Jobcore log -1 --stat` -> `253fa5d feat(ui): UniversalCalendar - Blackouts and Request time off on PayrollButton (Open Item 2)`, `1 file changed, 3 insertions(+), 3 deletions(-)`.
- Post-commit `git status --short` shows only the four other-session files (`JobPaymentRegion.tsx`, `record-job-payment.assert.ts`, `record-job-payment.ts`, `docs/supabase-push-ledger.md`), none staged.
- SOP conformance: no `width`, `minWidth`, `flex`, `flexGrow`, `alignSelf: 'stretch'`, `variant` or `selected` passed; default tone.

## Deviations / Defects
1. Plan mode (Rule 1) skipped by declaration for a two-line, single-file restyle; stated to Jeff before the edit.
2. Three further legacy `<Button` calls remain in the same file at lines 281, 305 and 326. They are outside Jeff's named scope (Blackouts and Request time off only) and were left untouched; flagged to Jeff at closeout under the PayrollButton SOP.

## Deferred
none
