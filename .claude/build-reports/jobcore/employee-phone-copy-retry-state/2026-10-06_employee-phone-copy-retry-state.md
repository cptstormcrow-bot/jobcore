---BUILD REPORT---

# Employee phone copy + Try again retrying state

Commit: dba969f "feat(admin): tap-to-copy phone on Employee Detail; Try again shows retrying state" (2 files, +77/-6), branch jobcore-role-landing-0.1.3, not pushed.

## Summary

1. `app/packages/ui/src/ErrorState.tsx`: `onRetry` now returns `void | Promise<void>`; added a retrying state and a mounted ref; `handleRetry` awaits `onRetry`; the Button label is "Retrying…" and it is disabled while retrying. Root cause of "Try Again does nothing": there was no loading state, so a fast cold-start retry looked dead. Consumer: `apps/mobile/app/_layout.tsx:97` (retry: `runCheck` in `session.tsx`).
2. `app/modules/admin-finance/src/screens/EmployeeDetailScreen.tsx`: tap-to-copy phone under the ScreenTitle using expo-clipboard (already a dependency), `Clipboard.setStringAsync`. A Pressable with an accessibility label; the note shows "Tap to copy" / "Copied" (1500 ms, timer cleared on unmount); "No phone on file" fallback; clipboard failure is ignored.

## Verification

- `tsc -b --force` on packages + modules: exit 0.
- `tsc -p apps/mobile --noEmit`: exit 0.
- No browser self-check (trust the test plan).
- Docs sweep (Rule 31): no living docs reference these two files; no doc edits needed.

## Rule 41 check

Prior report `admin-employee-email-change/2026-10-06_admin-employee-email-change.md` (Forward contracts, line 36):
- (1) DEPLOY.md smoke matrix against the live email-change function: still open, but does not apply here (this change touches neither the email feature, its migration, nor its edge function).
- (2) Try Again button re-runs the check with no loading state, root-caused but unchanged, awaiting Jeff's okay: this change delivers exactly that fix (ErrorState retrying state), so contract (2) is honored by this report.

Forward contracts: none new. Contract (1) of the email-change report remains open and is unaffected.

## Deviations / Defects

none

## Test plan

Offered to Jeff (Rule 43), pending his answer.

## Manual test steps (plain language)

1. Open Employee Detail for an employee who has a phone number. Under the title, the number shows "Tap to copy". Tap it; the note changes to "Copied" for about a second and a half. Paste somewhere else and the number appears.
2. Open Employee Detail for an employee with no phone; it shows "No phone on file".
3. Force the cold-start error screen and tap Try again. The button reads "Retrying…" and is greyed out until the check finishes.
