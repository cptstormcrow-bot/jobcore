---BUILD REPORT---

# Build Report — Automatic SemVer release SOP + version row in gear menu (JobCore)

**Project:** JobCore
**Date:** 2026-10-02
**Branch:** jobcore-role-landing-0.1.3
**Repo:** E:\Jeff\Codespace\SDAssemblyPros\Jobcore
**Commit:** 571501d "feat(jobcore): automatic SemVer release SOP + version row in gear menu" (17 files); 5e363c5 "chore(jobcore): drop unused gearTitle style (sales-role-nav contract 2)". Not pushed.
**Status:** COMPLETE
**Plan:** `E:\Jeff\.claude\plans\automatic-version-bumps-as-sop-jobcore.md` (approved after one revision: no release this session; baseline 0.2.0; version row in gear menu on all screens)
**Tier:** A
**Test plan:** declined (Jeff: "No, skip it"). Self-check caveat: verification limited to typecheck + unit assertions + dry run.

## Goal

Verbatim: "Yes, I would love it if automatic version bumps are SOP. Give me a plan please."

## Summary

Files in 571501d: .githooks/commit-msg, app/CHANGELOG.md, app/apps/mobile/README.md, app/apps/mobile/app/_layout.tsx (this session's hunks only), app/apps/mobile/app/config/settings.tsx, app/apps/mobile/scripts/build-apk.ps1 (SYNC + WARN blocks), app/apps/mobile/src/lib/appVersion.ts, app/docs/deployment.md, app/docs/versioning-guide.html, app/package.json (partially staged), app/packages/ui/src/AppChrome.tsx, app/packages/ui/src/AppVersionContext.tsx, app/packages/ui/src/__assertions__/format-version-label.assert.ts, app/packages/ui/src/formatVersionLabel.ts, app/packages/ui/src/index.ts, app/scripts/__assertions__/release-bump.assert.ts, app/scripts/release.mjs.

- `app/scripts/release.mjs`: no-deps Node ESM. `computeBump` uses pre-1.0 rules: feat -> minor, fix/perf -> patch, breaking -> minor, 1.0 manual. `pickNext` = max(commit-computed, highest v* tag bumped at the same level); aborts if the tag exists. A real run writes the app.json/package.json mirrors, bumps versionCode/buildNumber by +1, updates CHANGELOG, commits `chore(release): vX.Y.Z`, creates a local tag, and never pushes. `--dry` writes nothing.
- Warn-only commit-msg hook via core.hooksPath.
- `build:apk` warns when releasable commits exist since the last tag.
- Version row is the last row of the always-rendered gear menu, via AppVersionContext/useAppVersion (@jobcore/ui) fed by expo-constants `getAppVersion()`. Baseline 0.2.0.
- Scope addition: human-readable HTML guide delivered to `E:\Jeff\Desktop\JobCore-Versioning-Guide.html` (also app/docs/versioning-guide.html).

## Verification

1. `npm test` in app/: 190 pass, 0 fail (188 earlier; growth from other sessions' assertions).
2. `npx tsc --build`: exit 0.
3. `npm run release:dry` only; no real release this session.

## Forward contracts

Forward contracts:

- (a) When the other session's 0.2.0 build commit lands, tag it with `git tag v0.2.0 <sha>` so release.mjs has its baseline tag.
- (b) Run `npm run release` (from app/) at every future milestone close, after the commit and before the build report.

Rule 41 gate: 6 prior lineage reports evaluated. Resolvable contract fixed: sales-role-navigation contract 2 (unused gearTitle style) -> commit 5e363c5, source `.claude/build-reports/jobcore/.../2026-09-29_sales-role-navigation.md:56`.

Carried forward unchanged (input-needed or owned elsewhere):

- sales-role-nav: account.tsx R5 commit + EAS device gear check.
- profiles-guard: 42501-permanent + 0071 suite needs Docker (2026-09-30_profiles-sensitive-column-guard.md:51).
- payment-review-wiring: 7 contracts incl. migration 0072 push approval, APK smoke results, iPhone track (2026-09-30_payment-review-wiring-and-local-apk.md:59).
- field-tech-gear: FC3 needs input, FC1 new effort (2026-10-01_field-tech-gear-and-r3-assignments-overview.md:57).
- test-employees-retest: owned by commit 8042668 / migration 0072 (2026-10-01_test-employees-retest-fixes.md:50).
- ch6: none.

## Deviations / Defects

1. The missing-tag check runs before the dirty-tree check (plan said the reverse).
2. Spot's first build-apk.ps1 WARN patch produced a broken -f format expression; fixed by byte-level replace.
3. The HTML guide was a scope addition.
4. Partial-staging trim patches for _layout.tsx and app/package.json were built with sed/bash, outside Nestor's guarantee.
5. The step-4 tag-exists abort is unreachable from the CLI (defensive guard, covered by assertion test).
6. A duplicate commit attempt was a verified no-op.
7. The gearTitle style removal was a sub-200-char main-session Edit (Rule 30 carve-out).

## Delivery

Branch jobcore-role-landing-0.1.3, commits 571501d and 5e363c5, not pushed. HTML guide at `E:\Jeff\Desktop\JobCore-Versioning-Guide.html`.
