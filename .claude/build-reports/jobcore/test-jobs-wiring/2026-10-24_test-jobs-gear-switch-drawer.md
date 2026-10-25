---BUILD REPORT---

Tier: A
Project: jobcore
Slug: test-jobs-wiring
Date: 2026-10-24
Branch: jobcore-role-landing-0.1.3 (NOT pushed)
Status: COMPLETE
Test plan: declined by Jeff 2026-10-24 ("No test plan for the Test Jobs closeout"). Tier-A, so no self-check caveat. Jeff's on-screen check at http://localhost:8081/config/test-jobs is his own.

## Forward contracts:

1. `AdminFinanceRoot.tsx` deep-link effect now honours ANY AdminFinanceView in the `view` query param (`if (isAdminFinanceView(view)) setSubView(view);`). The Test Jobs drawer and any future caller rely on it.
2. The Configuration gear exists as three hand copies (`AdminFinanceRoot.tsx`, `app/job/[jobId].tsx`, `config/test-jobs.tsx`) that must change together.
3. The next step (UI-inventory regen) folds the extractor's duplicate `job-id` key (`docs/snapshots/v0.4.0/_tools/screens.json`, route `/job/complete/[jobId]`) into ft-Completion #24 and re-runs `node docs/snapshots/v0.4.0/_tools/assign-screen-numbers.mjs --check` to exit 0. No number is minted.

## Goal

Jeff's request (verbatim): "First off, I need a link to this Test Jobs Configuration page placed in the gear menu in Settings. next , also  on settings I need a screen number toggle and a unique screen #0xxx number assigned. Now make the flyout menu on it show the Admin&Finance main menu."

Settled by Jeff's answers:
- Gear: the Configuration gear (Logins/Settings/Profile) gets a fourth item "Test Jobs" -> `router.push('/config/test-jobs')`.
- Toggle: the "Show screen numbers" Switch copied onto the Test Jobs page. NO new screen number minted (Settings keeps #0065, Test Jobs keeps #0066; `screen-registry.json` untouched, 92 entries).
- Flyout: the Test Jobs hamburger drawer shows the 11-item Admin & Finance main menu via a new shared builder.

## What changed

| Commit | Files | Change |
|--------|-------|--------|
| 1213851 | `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx`, `app/apps/mobile/app/job/[jobId].tsx`, new `app/modules/admin-finance/src/menu.ts`, `app/modules/admin-finance/src/index.ts` | Test Jobs gear item added; shared A&F menu builder created and exported. |
| ea117c1 | `app/apps/mobile/app/config/test-jobs.tsx` | `useScreenNumber` switch row; drawer via `buildAdminFinanceMenuItems` routing to `/m/admin-finance?view=...`. |
| cb8fe3e | `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx` | Menu literal replaced by the builder; deep-link effect widened to any view. |
| 47e85b9 | `app/apps/mobile/app/config/test-jobs.tsx` | `gearTitle="Configuration"` plus the same four gear items. |

File guard: `AdminFinanceRoot.tsx` and `[jobId].tsx` are files a parallel session also edits on this branch; every commit was a scoped pathspec after git status + git diff. Never staged: `.claude/build-reports/jobcore/jobcore-profiles-pay-masking/`, `.claude/build-reports/jobcore/jobcore-commission-totals-dedupe/`, `app/docs/compensation.md`, `app/supabase/README.md`, `app/supabase/migrations/0111_profiles_lock_pay_columns.sql`.

## Verification (Rule 29-B, numbers with their commands)

| Measure | Result | Command |
|---------|--------|---------|
| Type-check (after ea117c1/cb8fe3e, and again after 47e85b9) | EXIT=0, output file tsc-gear.txt LINES=0 | from `app/`: `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing && npx tsc -p apps/mobile/tsconfig.json --noEmit` |
| Unit tests (pre-gear-fix run) | 577 passed, 0 failed | `npm test` |
| Registry count | 92 | `(Get-Content app\apps\mobile\src\screens\screen-registry.json \| ConvertFrom-Json).Count` |
| Ancestry | exit 0 | `git merge-base --is-ancestor 1603efb 1213851~1` |
| Commits exist | 4 of 4 | `git show --stat --format='%h %s' <sha>` for 1213851, ea117c1, cb8fe3e, 47e85b9 |

Karen evidence artifact: `E:\Jeff\.claude\state\hound-artifacts\karen-verify-0-20261024T1200-b5c1.json`.

## Docs swept (Rule 31)

`Get-ChildItem -Path app\docs,docs -Recurse -Include *.md | Where FullName -notmatch '\\snapshots\\' | Select-String -Pattern 'Test Jobs|gearTitle|Configuration gear'` -> 0 hits, so no doc updates were owed.

## Deviations / Defects

- (a) Test Jobs gear initially shipped EMPTY: ea117c1 wired the drawer and switch but passed no gearItems/gearTitle. Caught by Jeff on screen, fixed in 47e85b9.
- (b) Nestor slice 1a edited `AdminFinanceRoot.tsx` but missed `[jobId].tsx`; slice 1b fixed it before commit.
- (c) The builder omitted helpId/isActive on the AdminFinanceRoot menu; re-attached in cb8fe3e.
- (d) Switch-row styles renamed screenNumRow/screenNumLabel to avoid a style-name collision in `test-jobs.tsx` (plan said copy unchanged).
- (e) `assign-screen-numbers.mjs --check` FAILS on key `job-id` (pre-existing from commit 1603efb, the Item-1 regen). Not caused by this change and not fixed here; disposition = forward contract 3.
- (f) Hound edits were verified by Select-String/git diff rather than full re-reads (Rule 44 caps).
