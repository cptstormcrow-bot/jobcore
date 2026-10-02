---BUILD REPORT---

# Build Report — Role-based login landing, Home removed, module switcher current-row (JobCore 0.1.3)

**Project:** JobCore
**Date:** 2026-10-02
**Branch:** jobcore-role-landing-0.1.3
**Commit:** 31d8534 (23 files, +394/−156; not pushed — no git push per standing rule)
**Status:** COMPLETE
**Plan:** `E:\Jeff\.claude\plans\jobcore-020-role-based-login-landing-home-removed-apk-smoke.md`
**Tier:** A
**Test plan:** declined (Jeff: "No, close out now", 2026-10-02). Self-check caveat: verification limited to typecheck + unit assertions; no on-device/browser run of landing per role.

## Summary

`landingRouteFor(role, enabledModuleIds)` in `apps/mobile/src/lib/landing.ts` now drives post-login landing. Consumers:

- AuthGate in `apps/mobile/app/_layout.tsx`
- `account.tsx` onTitlePress
- new `RoleLandingRedirect.tsx` (used by `index.tsx`)
- `goBackOrLanding` in `apps/mobile/app/job/[jobId].tsx`

The Home screen is removed; a new `+not-found.tsx` is added. `moduleSwitcherItems(currentId, role)` in `packages/module-sdk/src/index.ts` excludes the current module; Admin-Finance, Field-Tech and Sales-Marketing each add an `isActive: true` current row. New Sales-Marketing `Overview.tsx` screen. New assertions: `landing.assert.ts` and `packages/module-sdk/src/__assertions__/module-switcher.assert.ts`.

Slices S1–S10: all DONE.

## Verification

1. Typecheck: exit 0.
2. `npm test`: 190/190 pass.

## Forward contracts

Forward contracts: none new.

Rule 41 lineage evaluation (prior open contracts):

| Prior contract | Source report | Disposition |
|---|---|---|
| Owner/admin Jobs tab unreachable (from 09-02) | 2026-09-30_payment-review-wiring-and-local-apk.md | CARRIED — evaluated at 31d8534: still unreachable. landing.ts:3-4,14 routes owner/admin to /m/admin-finance; (tabs)/_layout.tsx:15 Jobs tab exists but no source navigates to /jobs; moduleSwitcherItems (module-sdk index.ts:126-136) only yields /m/<id>. Related to this change; not fixed (out of plan scope). |
| FC3 module-session injection on other routes + fallback UX | 2026-10-01_field-tech-gear-and-r3-assignments-overview.md | CARRIED — needs Jeff input |
| FC1 browser-test failures become new effort | same | CARRIED — needs Jeff input |
| Migration 0072 local-only; push needs --include-all or renumber to 0074 + Jeff go | 2026-09-30_payment-review-wiring-and-local-apk.md | CARRIED — needs Jeff |
| APK smoke v1 phone results pending | same | CARRIED — needs Jeff |
| iPhone build separate track | same | CARRIED — needs Jeff |
| Hosted-safe profiles-guard suite; 42501 profile writes as permanent failures; offline customer saves not replayed (saveForJob); paid-flow defects | same (+ 2026-09-30_profiles-sensitive-column-guard duplicates two) | CARRIED — resolvable but unrelated to this change's scope |
| Reverting 8042668 regresses Tech: label/unassign; re-judge create() delete-then-insert when 0072 lands | 2026-10-01_test-employees-retest-fixes.md | CARRIED — unrelated |
| apps/mobile version bump 0.1.1→0.1.2 left unstaged, owner unknown | 2026-10-01_field-tech-gear-and-r3-assignments-overview.md | CARRIED — note only |

## Deviations / Defects

1. Plan named `apps/mobile/src/lib/module-ports.ts` (does not exist); work used `modules/admin-finance/src/lib/module-ports.ts`.
2. S6 defects: Admin-Finance switcher missing current row; `TOP_LEVEL_TABS` dead code — both fixed in S9.
3. Scope extension: S10 applied the current-row fix to Field-Tech and Sales-Marketing (beyond plan).
4. S10 scratchpad crib never written (Rule 38 process miss).
5. S5 and S7 hound tails returned empty; results recovered from hand-backs.
6. CRLF warnings at commit — benign.
7. Rule 29 defect (delivery claim): a pre-compaction status claimed the report copy was already in E:\Jeff\Desktop\Build-Reports\, but that folder did not exist. Post-compaction, Nestor created the folder and delivered the copy (SHA-256 verified). Caught by Themis (task_id themis-ledger-jobcore-20261002-rolelogin), advisory, medium.

## Delivery

Branch jobcore-role-landing-0.1.3, commit 31d8534, not pushed. Copy delivered to `E:\Jeff\Desktop\Build-Reports\`.

## Release artifact (amendment 2026-10-02)

- Version: v0.2.0 (SemVer SOP; feat below 1.0 bumps minor). Release commit 4c26932 `chore(release): v0.2.0`; local tag v0.2.0 (never pushed).
- APK: `app/apps/mobile/jobcore-0.2.0-vc3.apk`, delivered to `E:\Jeff\Desktop\jobcore-0.2.0-vc3.apk`. versionCode 3, package `com.sdassemblypros.jobcore.v2`, debug keystore (sideload).
- SHA-256 `46EAB5A111CCE53EA9DC1678136269FA77D6485058708FE2EA99CC51D0C97E0F`, 82.91 MB; apksigner + aapt badging PASS; Desktop copy hash re-verified.
- Built via `npm run build:apk -- -JavaHome 'C:\Program Files\Android\Android Studio\jbr' -Drive 'Y:'` on drive Y: (Z: is held by another worktree and was left untouched); `subst Y: /D` teardown confirmed.
- `android/app/build.gradle` synced to vc 3 / 0.2.0 by PREFLIGHT; `android/` is gitignored, so no commit.
- Deviation: plan named 0.1.3; Jeff corrected to 0.2.0 per the new SemVer rules.
