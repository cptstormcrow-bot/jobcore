---BUILD REPORT---

# JobCore: Sales Role navigation (gear Configurations menu, profile editing, sales route guard)

**Date:** 2026-09-29
**Project:** jobcore
**Tier:** A
**Status:** COMPLETE
**Plan:** `E:\Jeff\.claude\plans\jobcore-sales-role-navigation.md`
**Branch:** jobcore-job-detail-action-buttons
**Commit:** `39bf111` (parent `116428f`) "feat(jobcore): Sales role navigation — gear Configurations menu, profile editing, sales route guard"

## Goal

Jeff, verbatim: "In Jobcore, when I log in as Sales, I want it to go directly to the Sales & Marketing page but NOT be able to access either the admin or field tech pages (already the case?). Remove the "back" button, and create a gear icon to the top-right of the Hamburger menu that will hold logins, settings, and profile. Move them into the gear (config) button that opens a new menu with these options. Move the menu items closer together vertically to match the menu of the admin screens. Do only these changes."

Sketch: "SALES & MARKETING MENU" — gear -> Login / Settings / Profile w/ PW reset; "squeeze menu items together"; Back struck through.

## Summary

Commit `39bf111`, 5 files, +493/-25 (numstat):

| File | Added | Removed |
|---|---|---|
| `app/apps/mobile/app/_layout.tsx` | 13 | 2 |
| `app/apps/mobile/app/profile.tsx` (new) | 299 | 0 |
| `app/apps/mobile/src/lib/session.tsx` | 67 | 0 |
| `app/modules/sales-marketing/src/screens/SalesMarketingRoot.tsx` | 14 | 18 |
| `app/packages/ui/src/AppChrome.tsx` | 100 | 5 |

What changed:

- `_layout.tsx`: `SALES_ALLOWED = ['/account','/config/settings','/profile']` plus `isSalesAllowed(p)` (also allows `/m/sales-marketing` and subpaths). `salesBlocked = authenticated && role==='sales' && !isSalesAllowed(pathname)`; new `else if (salesBlocked)` renders `<Redirect href="/m/sales-marketing" />` (~L125); `isRedirect` ORs `salesBlocked` (~L136). Route guards are UX only; RLS remains the security boundary. A comment notes new Sales routes must be added to `SALES_ALLOWED`.
- `AppChrome.tsx`: new optional props `gearItems?: MenuActionItem[]`, `gearTitle?: string`, `compactMenu?: boolean` (kept optional because another session's `field-tech/src/index.ts` uses them). Gear glyph `'\u2699\uFE0E'`, accessibilityLabel "Settings menu", top-right beside the hamburger. Gear Modal is a framed sheet with a "Configurations" title chip in accent `#F5A623` with dark text, divider, and separators. Opening the gear closes the hamburger, then opens after a 300ms `setTimeout` (no stacked Modals). `compactMenu` applies `rowCompact {minHeight:44, paddingVertical: spacing.xs}` to rows, submenu and Back row. The commit is an ours-only synthesized file (hash-object/update-index) because the AppChrome working tree also holds 2 other sessions' uncommitted hunks.
- `SalesMarketingRoot.tsx`: removed the Logins/Sign in-out and Configuration/Settings menu items; `gearItems` memo: Sign Out -> `/account`, Settings -> `/config/settings`, Profile -> `/profile`; props `showBack:false`, `compactMenu:true`, `gearItems`, `gearTitle:'Configurations'`.
- `session.tsx`: `updatePassword(pw)`, `updateFullName(userId, fullName)` (Promise.resolve-wrapped builder plus `.select('id')`; 0 rows = error, catching a silent RLS block), `updateEmail(email)` (`withTimeout` 15000). All return `string|null`.
- `profile.tsx` (new, 299 lines): editable Name and Email; Role read-only with note "Only an admin can change roles."; Save details (empty name rejected; email change sends a Supabase confirmation -> "Check your email to confirm the change."); Change password card with separate Show/Hide toggles for new and confirm; minimum 8 chars, mismatch check.

## Rounds

- Round 1 (S1-S10) -> Jeff test: 21 PASS / 1 FAIL plus 6 change requests.
- Round 2 fixes R1-R6b: Configurations title in accent; "Sign Out" label; Name/Email editable with RLS-safe update; separate confirm Show toggle; `account.tsx` side-by-side accent buttons; tsc thenable fix. R7: round-2 test plan (`E:\Jeff\Desktop\JobCore_Sales_Menu_Test_Plan_Round2.html`). All PASS except 3.6 (optional email change) NOT TESTED.
- Round-1 FAIL 6.2 (admin sign-in should land on Admin & Finance) was resolved by another session's commit `116428f`, not by this change.

## Verification

- `tsc -b --force` on packages/core, ui, module-sdk, modules/admin-finance, field-tech, sales-marketing, and `tsc -p apps/mobile/tsconfig.json --noEmit`: clean at round 2.
- Committed AppChrome style-ref check: 25 refs / 26 defs, no undefined refs, only `gearTitle` unused, 466 lines.

## Security notes

Role stays read-only client-side and is guarded server-side by `0002_profiles_role_column_guard.sql:17` (revoke update(role)); `profiles_update_self` RLS (`0001_foundation.sql` L129-133) governs name edits; empty `full_name` is rejected client-side because the column accepts ''.

## Forward contracts

Forward contracts:

1. Commit `app/apps/mobile/app/account.tsx` R5 row (`variant="accent" size="tab"` side-by-side buttons) once the other session's `Button.tsx` `accent` variant lands at HEAD; then remove the unused `buttonRow` style. Currently left uncommitted in the working tree (Jeff-tested, round-2 2.1 PASS).
2. Remove dead `styles.gearTitle` in `app/packages/ui/src/AppChrome.tsx` (defined, never referenced) when AppChrome is next free of other sessions' uncommitted hunks.
3. EAS native build and on-device verification of the gear menu (including the 300ms Modal swap on iOS) — inherited from `2026-09-14_app-wide-menu-system.md` Forward contracts (L75); needs Jeff/EAS.
4. Optional email-change end-to-end test (round-2 step 3.6) — Jeff runs it himself; sends a real confirmation email from the hosted project.

## Prior contracts (Rule 41)

Lineage evaluated before writing: 24 JobCore reports with Forward-contract bullets, 122 top-level bullets, keyword-filtered (AppChrome|_layout|SalesMarketing|sales-marketing|session.tsx|profile|account.tsx|Sales|gear|Menu) to 5 hits, plus hand checks of `2026-09-14_app-wide-menu-system.md` (L75 contract; L82 "No other forward contracts.") and `2026-09-01_signin-signup-link-invites.md:20` ("Forward contracts: none"). No in-scope contract was resolvable without Jeff's input.

Carried forward unchanged (Jeff-owned): authenticated S&M screen visual verification (`2026-08-25_sales-marketing-ports-fix.md:21` FC1) and the app-wide-menu EAS/on-device check (`2026-09-14_app-wide-menu-system.md` L75). Other sessions' contracts (2026-09-04 job-detail EAS, 2026-09-17 bucket-3 repos files, 2026-09-25 / 2026-09-26 save follow-ups) left untouched — out of scope.

Honored: no prior contract in this lineage was broken by this change.

## Deviations / Defects

Defects in this change's own output:

- Dead `styles.gearTitle` in AppChrome (FC2).
- `profile.tsx` L197-208: confirm-password TextInput under-indented inside its passwordWrap View (cosmetic).
- `account.tsx` excluded from commit (depends on uncommitted Button.tsx accent variant) and carries an unused `buttonRow` style (FC1).
- Committed AppChrome.tsx is a hand-synthesized ours-only file never tsc-checked in isolation; mitigated by the style-ref check (no undefined refs).
- Mixed line endings across touched files (`_layout.tsx` CRLF; others LF) — LF->CRLF warnings expected under core.autocrlf=true.

Deviations from plan / rules:

- R3 initially failed tsc (thenable builders); fixed in R6 via Promise.resolve.
- R6b Workflow launched before its 4-line preflight and overran read budgets; its L80 medium finding was refuted.
- Brace-glob Grep misses (subpath brace globs unsupported); switched to per-file search.
- Several direct main-session Edits under the 200-char carve-out (R6b a/b).
- Nestor anchor for fix (c) non-unique; re-anchored on `supabase.auth.updateUser({ email }),`.
- Status line came after tool calls in several resumed turns (commit turn, AppChrome-check, Rule 41 extraction).
- Repeated context compactions during the run.
- R7 test plan written directly to Desktop.
- Slice notes S4 (says 193 lines/shared toggle) and S5 (line numbers L124/L133) are stale vs the final files.
- Spot S10a dispatch lacked Rule 18 chat narration; Wave 1 also lacked it.
- An earlier compaction summary wrongly said the report goes to Desktop\Build-Reports (corrected: in-repo only).
- Rule 41 extraction was keyword-filtered; non-matching bullets and table-format contracts were not individually reviewed (the two menu/sign-in reports were hand-checked).
- Round 1: Phase-1 Workflow ran without preflight and overran recon budget; S8 preflight late; browser pane opened before asking; Rule 44 read blocks; plan renamed via slug; S9 needed Jeff to sign in; Nestor regrouped round-1 plan; test step 1.3 lacked a colour source; 6.2 expectation wrong (fixed externally by 116428f); S2 used createElement object props (file style); R3 added .select('id'); R1 re-anchor; R4 added extras (separate a11y labels); S1 retry; fullName/full_name confusion; auto-stamp hook modifies .md files.

## Known limitations

- 300ms setTimeout hamburger->gear Modal swap may glitch on iOS (untested on device).
- `withTimeout` does not cancel the underlying Supabase request.
- Email-change path untested end to end (3.6).
- No EAS/on-device testing yet.

## Test plan

Test plan: round 1 — 21 PASS / 1 FAIL + 6 change requests; round 2 (`E:\Jeff\Desktop\JobCore_Sales_Menu_Test_Plan_Round2.html`) — all PASS, 3.6 optional email change NOT TESTED. Rule 43 retest loop closed.

## Out of scope (not touched)

Other sessions' files: `index.tsx`, `package.json`, field-tech, `Button.tsx`, `ListItem.tsx`, `landing.ts`, `JobHeader.tsx`, `job/[jobId].tsx`, admin-finance files, core `state-machine`, and their AppChrome hunks.

---END BUILD REPORT---
