---
classification: build-reports/jobcore
comments: "App-wide hamburger/options menu system (AppChrome) — Tier-A closeout"
origin: .claude/build-reports/jobcore/2026-09-14_app-wide-menu-system.md
tags: [build-report, jobcore, tier-a]
---
# Build Report: App-wide Hamburger (☰) + Options (⋮) Menu System

**Date:** 2026-09-14
**Branch:** jobcore-job-detail-action-buttons
**Commit:** 46666a9 — feat(jobcore): app-wide hamburger/options menu system (AppChrome)
**Plan:** `.claude/plans/i-want-to-implement-hazy-simon.md`
**Tier:** A

## Summary

Added a shared `AppChrome` component (`app/packages/ui/src/AppChrome.tsx`, exported from
`app/packages/ui/src/index.ts`) providing a consistent breadcrumb + ☰ (hamburger)/⋮ (options) row on
every screen, rendered as `Modal` popovers mirroring the existing `Select.tsx`/`WarningSheet.tsx`
pattern. `AppChrome` auto-prepends a "‹ Back" row driven by `router.canGoBack()`.

Wired into: Home (`app/apps/mobile/app/index.tsx`, 5-item menu, Sign Out relocated into
Logins/Sign in/out), Admin & Finance (`AdminFinanceRoot.tsx`, 13-item menu replacing `TOP_LEVEL_TABS`),
Job Detail (`app/apps/mobile/app/job/[jobId].tsx` + `JobHeader.tsx`, Back + 9-step stepper replacing
`REGION_BUTTONS`; Copy/Save buttons in `JobDetailsForm.tsx` untouched), Field Tech (new root screen,
`app/modules/field-tech/src/index.ts`, 6-item menu, new `Reviews.tsx` stub), and Sales & Marketing
(`SalesMarketingRoot.tsx`, 7-item menu replacing `TABS`, inline Spawn Test Jobs UI removed).

Added two shared Configuration routes: `app/apps/mobile/app/config/test-jobs.tsx` (relocated Spawn
Test Jobs, reusing `sales-marketing-repos.ts`'s repository functions, plus a new job-workflow-stage
progress view) and `app/apps/mobile/app/config/settings.tsx` (static placeholder), reachable from
every context's Configuration (gear) submenu.

`TabBar` (`app/packages/ui/src/index.ts`) left in place with zero remaining root-nav call sites;
removal explicitly out of scope per plan.

## Files Changed

- `app/packages/ui/src/AppChrome.tsx` (new)
- `app/packages/ui/src/index.ts`
- `app/apps/mobile/app/index.tsx`
- `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx`
- `app/apps/mobile/app/job/[jobId].tsx`
- `app/apps/mobile/src/components/JobHeader.tsx`
- `app/modules/field-tech/src/index.ts`
- `app/modules/field-tech/src/screens/Reviews.tsx` (new)
- `app/modules/sales-marketing/src/screens/SalesMarketingRoot.tsx`
- `app/apps/mobile/app/config/test-jobs.tsx` (new)
- `app/apps/mobile/app/config/settings.tsx` (new)

## Test plan

Tier-A closeout per Rule 43: Jeff opted in ("Yes, generate one."). Nestor authored an HTML test plan,
delivered via Desktop copy + SendUserFile:
`.claude/build-reports/jobcore/test-plans/2026-09-14_app-wide-menu-system-test-plan.html`

Result: **8/8 items PASS**, no fixes required, no retest cycle triggered. Items 5 and 6 specifically
verify the corrected (deviation) Back-button behavior for Field Tech and Sales & Marketing — see
Deviations below.

## Deviations / Defects

1. **Home-screen role-picker auto-navigate bypass does not exist.** The approved plan assumed Field
   Tech and Sales & Marketing skip the Home role-picker via an existing `router.replace()` auto-navigate
   bypass in `app/apps/mobile/app/index.tsx`, and that this would leave their root screens with no
   history entry (Back disabled). Recon during BUILD found no such bypass mechanism, and this was
   confirmed live via the test plan (items 5 and 6, both PASS): both roles are reached by `router.push`
   through the Home picker, so `router.canGoBack()` is `true` on their root screens. **Consequence:**
   Back renders **enabled → Home** on the Field Tech and Sales & Marketing root screens, not disabled as
   originally planned. This is the correct, honest behavior for the actual navigation flow and is not
   treated as a defect — documented here per Rule 37.

No other deviations or defects.

## Forward contracts

- **EAS native build + on-device verification.** This pass was verified against the Expo web dev
  server (port 8081) only, per the test plan. A native (EAS) build and on-device check of the new
  AppChrome menu system on iOS/Android has not yet been run and is deferred to a future session,
  consistent with the standing pattern on other recent JobCore closeouts.

No other forward contracts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
