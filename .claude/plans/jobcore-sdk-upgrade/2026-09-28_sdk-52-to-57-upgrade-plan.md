# JobCore Mobile — Expo SDK 52 → 57 Upgrade Plan

**Status:** PLAN ONLY — no hop has been started. This document requires Jeff's separate, explicit go before any upgrade branch is opened.
**Date authored:** 2026-09-28
**Scope:** `app/apps/mobile` (the JobCore Expo/Metro mobile-web app). Does not cover other workspace packages except where they are direct dependencies of the mobile app.
**Research basis:** Web-verified facts gathered by a dedicated research pass against official Expo sources (expo.dev/changelog, expo.dev/blog, github.com/expo/expo, docs.expo.dev, reactnative.dev) on 2026-09-28, cross-checked against this repo's actual `package.json`. Every claim below is either "CONFIRMED" (sourced) or listed in the Consolidated Unverified Facts section — treat unconfirmed items as needing a fresh check before you gate on them.

## Current repo state (verified against `app/apps/mobile/package.json` on 2026-09-28)

| Package | Current version |
|---|---|
| expo | ~52.0.0 |
| react-native | 0.76.9 |
| react / react-dom | 18.3.1 |
| expo-router | ~4.0.0 |
| @supabase/supabase-js | ^2.45.0 (lockfile pinned 2.117.2 as of commit 736d806) |
| react-native-safe-area-context | 4.12.0 |
| react-native-screens | ~4.4.0 |
| react-native-web | ~0.19.13 |
| typescript (devDep) | ^5.6.3 |
| eas-cli (devDep) | ^13.2.0 |
| supabase CLI (devDep) | ^1.226.4 |

Notably **absent** from the dependency list (relevant because several hops remove or restructure these):
- `expo-av` — not present, so the SDK 55 full-removal of expo-av does not directly affect this app (transitive usage still needs a grep check — see watchlist below).
- `@react-navigation/*` — not a direct dependency (expo-router ~4.0.0 is used instead), so the SDK 56 Router/React-Navigation decoupling needs an import-level audit, not a full navigation rewrite.
- `@expo/vector-icons` — not a direct dependency; SDK 56's removal of it from the `expo` package needs a transitive-usage check only.

## Hop status table

| Hop | Target SDK | Release date | Status (as of 2026-09-28) | RN version floor | Node.js min | iOS deployment target | Xcode min |
|---|---|---|---|---|---|---|---|
| 1 | 53 | 2025-04-30 | Stable | 0.79 | 20+ | 15.1 | 16 |
| 2 | 54 | 2025-09-10 | Stable | 0.81 | 20.19.4 | 15.1 | 16.1 |
| 3 | 55 | 2026-02-25 | Stable | 0.83 | 20.19.4+ | 15.1 | 26 |
| 4 | 56 | 2026-05-21 | Stable | 0.85 | 20.19.4+ | 16.4 (bumped) | 26.4 |
| 5 | 57 | 2026-06-30 | Stable, latest as of 2026-09-28 | 0.86 | 20.19.4+ | 16.4 | 26.4 |

## Hop-by-hop breaking changes and watchlist

### Hop 1: SDK 52 → 53 (stable, 2025-04-30)
- New Architecture becomes the default (opt-out still exists but is discouraged).
- Metro enforces ES module resolution by default — nested `require` paths need updating to `export` syntax.
- Edge-to-edge layout required by default on Android (prep for Android 16 enforcement later).
- `expo-av` deprecated (still present in SDK 53, but removed from Expo Go); no replacement (`expo-video`/`expo-audio`) available yet at this hop.
- `jsEngine` config field deprecated.
- Android push notifications removed from Expo Go.
- Repo impact: no `expo-av` dependency, so the deprecation notice is moot here; New Architecture default is the main item to test (see Ranked Risks #4).

### Hop 2: SDK 53 → 54 (stable, 2025-09-10)
- **Last SDK to support Legacy Architecture** — RN 0.82 removes the opt-out entirely, so this is the last safe hop to stay on Legacy if ever needed.
- File System API breaking change: `expo-file-system/next` → `expo-file-system` (old sync API moves to `expo-file-system/legacy`).
- RN 0.81 removes built-in JavaScriptCore (JSC); only affects apps that force JSC (this app uses Hermes by default — no impact expected, but confirm no JSC override exists).
- Reanimated v4 introduced; requires New Architecture and adds a `react-native-worklets` dependency. Only relevant if `react-native-reanimated` is used (not a direct dependency here — check transitively).
- `expo-build-properties`: `enableProguardInReleaseBuilds` → `enableMinifyInReleaseBuilds`.
- RN's built-in `SafeAreaView` starts emitting a deprecation warning (this repo already uses `react-native-safe-area-context` 4.12.0, so this is a non-issue as long as no code imports `SafeAreaView` from `react-native` directly).
- Metro internal import path change: `metro/src/...` → `metro/private/...` (only matters for code reaching into Metro internals — unlikely in this repo).
- `expo-av` deprecation notice escalates (full removal scheduled for SDK 55).
- Performance: XCFrameworks precompiled RN on iOS reported to cut clean iOS build time roughly 120s → 10s in upstream benchmarks (not incompatible with this repo's build setup as far as known; incompatible only with `use_frameworks!`, which this repo does not appear to use).

### Hop 3: SDK 54 → 55 (stable, 2026-02-25)
- **Legacy Architecture fully removed** — `newArchEnabled` config option is gone; app.json must not reference it.
- **`expo-av` fully removed.** Hard gate: repo must have zero `expo-av` usage (direct or transitive) before this hop. Replacement is `expo-video` + `expo-audio` (API split into VideoPlayer/VideoView, calls become async, event-based state).
- `eas update` now requires an explicit `--environment` flag.
- `notification` field removed from `app.json` schema.
- `removeSubscription` functions removed across Expo modules — use `subscription.remove()` instead.
- `expo-navigation-bar` deprecated (most methods become no-ops).
- `expo-status-bar` deprecates several edge-to-edge layout props.
- `expo-video-thumbnails` deprecated (use `expo-video`).
- App config (app.config.ts) evaluation toolchain changes how TypeScript config files are transpiled.
- Swift 6 language mode adopted for native iOS code (stricter data-race checks — only matters if this repo has custom native Swift code, which it does not appear to).
- `react-native-screens` upstream bumps to 4.23.0 in the SDK's own bundled version (this repo currently pins `~4.4.0` — compatibility with SDK 55+ is UNVERIFIED, see below).
- Hermes v1 introduced (not yet default at this hop).
- Known issue: building RN from source becomes required with Hermes v1 in some configurations, increasing native build time; PAC pointer-authentication crashes reported on some physical iOS devices.

### Hop 4: SDK 55 → 56 (stable, 2026-05-21)
- **Expo Router decouples from React Navigation.** App code that imports from `@react-navigation/*` must migrate to `expo-router/*` entry points. A codemod exists (`npx expo-codemod sdk-56-expo-router-react-navigation-replace '**/*.{ts,tsx,js,jsx}'`) but is reported to miss roughly 25% of imports in large codebases — manual review is required after running it. This repo has no direct `@react-navigation/*` dependency, so exposure should be limited to whatever expo-router pulls in transitively; still requires an import-level grep before this hop.
- `expo-file-system` `copy()`/`move()` become async by default; `copySync()`/`moveSync()` exist for the old sync behavior.
- `expo/fetch` becomes the default `globalThis.fetch` implementation automatically (no manual import needed anymore) — could interact with this app's existing Supabase client networking; worth a smoke test.
- `@expo/dom-webview` replaces `react-native-webview` as the default for DOM components (only relevant if this repo uses DOM components with an embedded WebView).
- `@expo/vector-icons` removed from the `expo` package's own dependencies; migration path is scoped `@react-native-vector-icons/*` packages. Not a direct dependency here — transitive-usage scope is UNVERIFIED (see below).
- `expo-calendar`, `expo-contacts`, `expo-media-library` get redesigned (behavior-breaking, not availability-breaking) APIs. This repo has `expo-media-library ~17.0.3` — review its new API surface before this hop.
- RN API removal: `StyleSheet.absoluteFillObject` removed — `StyleSheet.absoluteFill` is the replacement; any code that spreads `...StyleSheet.absoluteFillObject` silently becomes a no-op and must be refactored.
- iOS deployment target bumps to 16.4 (drops iOS 15.1–16.3 support).
- Hermes v1 becomes the default engine; a known memory regression affects apps using `react-native-reanimated`/`react-native-worklets`, fixed in SDK 57.0.17.
- Store-compliance driver: Google Play's Android 16 (API 36) requirement for new apps/updates has an August 31, 2026 deadline; existing apps must target API 35+ to remain visible to new users. Apple requires Xcode 26+ for App Store Connect submissions as of April 28, 2026 (already past as of this document's date — confirm EAS Build's default Xcode image is already 26.4+ before relying on it).

### Hop 5: SDK 56 → 57 (stable, 2026-06-30, latest as of 2026-09-28)
- **No breaking changes** — RN 0.86 is a non-breaking release; Expo's stated direction is smaller, faster, optional SDK bumps going forward.
- Non-breaking improvements: Android edge-to-edge fixes, light/dark mode emulation in RN DevTools, rendering/layout/animation fixes, updated bundled `react-native-reanimated`/`react-native-worklets`/`react-native-gesture-handler`, `expo prebuild` on by default.
- Fixes the SDK 56 Hermes v1 memory regression as of version 57.0.17 — if a future SDK 56 stop is ever made, pin at least 57.0.17 rather than an earlier 57.x.
- Store-compliance driver: same Android API 36 deadline (August 31, 2026) continues to apply; a possible extension to November 1, 2026 is reported in community sources but is NOT confirmed from Google's own documentation (see Unverified list).

## Ranked risks (highest impact first)

**Tier 1 — critical path**
1. **`expo-av` removal at the 54→55 hop.** Not a direct dependency today, but any transitive or undetected usage would break the app outright. Hard-gate this hop on a clean grep.
2. **Expo Router / React Navigation decoupling at the 55→56 hop.** Codemod is reported to miss ~25% of imports in large codebases; silent runtime navigation bugs are the likely failure mode if the manual review step is skipped.
3. **Android API 36 compliance deadline (August 31, 2026, per Google Play).** This is already close to or past by the time any real upgrade work starts — sequencing needs to treat this as a forcing function, not a nice-to-have, independent of which SDK hop is "in progress."

**Tier 2 — high-impact breaking changes**
4. **New Architecture becomes mandatory at the 54→55 hop** (opt-out removed). Any native module or third-party library without New Architecture support will fail at that point — audit native deps before this hop.
5. **iOS deployment target bump to 16.4 at the 55→56 hop.** Drops iOS 15.1–16.3 users; a product/business decision, not just an engineering one.
6. **`expo-file-system` `copy()`/`move()` becoming async at the 55→56 hop.** No direct `expo-file-system` dependency today; verify no transitive sync usage exists before this hop.

**Tier 3 — moderate, deprecation-chain risks**
7. **Hermes v1 memory regression introduced at 56, fixed at 57.0.17.** If `react-native-reanimated`/`worklets` end up in the dependency tree by then, do not stop on plain SDK 56 — go straight to 57.0.17+.
8. **`@expo/vector-icons` removal from the `expo` package at 56.** No direct dependency; transitive exposure is unverified — resolve with `npm list @expo/vector-icons` before this hop.
9. **Xcode floor tightening across hops** (16 → 16.1 → 26 → 26.4), with an Apple April 28, 2026 deadline for Xcode 26+ on App Store Connect submissions already behind us as of this document's date. Confirm the EAS Build image already satisfies this before treating it as free.
10. **RN's built-in `SafeAreaView` deprecation, spanning hops 2–5.** This repo already uses `react-native-safe-area-context`, so this should be a non-issue — confirm no code imports `SafeAreaView` from `react-native` directly.

**Tier 4 — low/contingent**
11. **Reanimated v4 requirement at the 53→54 hop**, only relevant if `react-native-reanimated` is present transitively.
12. **Node.js floor bump to 20.19.4 at the 53→54 hop** — check CI and local dev Node versions match (local dev is currently Node v22.22.2, which already clears this floor; the previously-noted EAS build image at Node 20.18.3 would NOT clear it and needs separate confirmation).
13. **`StyleSheet.absoluteFillObject` removal at the 55→56 hop** — grep for `absoluteFillObject`, especially spread usage (`...StyleSheet.absoluteFillObject`), which becomes a silent no-op rather than a build error.
14. **JSC/Hermes engine changes across hops 2 and 4** — this app has no custom engine override, so it should auto-adopt Hermes v1 with no action needed; treat as a "monitor," not a task.

## Pre-hop work (do once, before opening any upgrade branch)

1. Run `npm list @expo/vector-icons`, `npm list react-native-reanimated`, `npm list @react-navigation/native` (or equivalent) from `app/` to resolve today's transitive-dependency exposure for the three biggest unknowns above.
2. Confirm the EAS Build project's default Xcode image version (target: 26.4+) and Node image version (target: 20.19.4+) — both drive Tier 1/2/3 risks above and are currently only inferred from the prior segment's un-exercised note that the EAS image runs Node 20.18.3.
3. Record a build-time and bundle-size baseline on the current SDK 52 state for later comparison (the SDK 54 hop claims a large iOS clean-build speedup from XCFrameworks — worth confirming against this repo's own numbers rather than taking the upstream benchmark on faith).
4. Confirm physical/emulated device availability for iOS 16.4+ and Android API 36 testing before the hops that require them (55→56 for iOS, and the Android 16 deadline generally).

## Repo-grep task list (run before the hop that first makes each item load-bearing)

| Grep target | Why | Gate before |
|---|---|---|
| `expo-av` | Full removal at SDK 55 | Hop 3 (54→55) |
| `@react-navigation/` | Router/Navigation decoupling at SDK 56 | Hop 4 (55→56) |
| `@expo/vector-icons` or `expo/vector-icons` | Removed from `expo` package deps at SDK 56 | Hop 4 (55→56) |
| `SafeAreaView` imports (confirm source is `react-native-safe-area-context`, not `react-native`) | RN's own SafeAreaView deprecating across hops 2-5 | Hop 1 (52→53), re-check each hop |
| `MediaTypeOptions` | ImagePicker media-type API migrating to `MediaType` | Hop 1-3 (watch across hops) |
| `absoluteFillObject` | Removed (spread pattern becomes silent no-op) at SDK 56 | Hop 4 (55→56) |
| `findNodeHandle` | Legacy-Architecture-era API; confirm no remaining usage before New Architecture becomes mandatory | Hop 3 (54→55) |
| `expo/fetch` (manual imports) | Becomes the automatic default `fetch` at SDK 56 — check for double-patching or explicit imports that would now be redundant | Hop 4 (55→56) |
| `react-native-reanimated`, `react-native-worklets` (transitive) | Drives the v4/New-Architecture requirement (54) and the Hermes v1 memory regression (56, fixed 57.0.17) | Hop 2 (53→54) and Hop 4 (55→56) |
| `expo-file-system` `.copy(` / `.move(` calls | Becomes async-by-default at SDK 56 | Hop 4 (55→56) |

## Per-hop merge gates

- **Before 53:** New Architecture native-module audit complete; full CI pass; manual iOS + Android device regression pass; React 19 breaking-change review (error boundaries, suspense usage, if any).
- **Before 54:** `expo-file-system/next` usage grep clean (repo does not use it directly, confirm no transitive references); JSC-forcing config absent; Reanimated v3→v4 migration plan ready if the transitive check above finds it present; Node ≥ 20.19.4 confirmed in CI and EAS image.
- **Before 55 (HARD GATE):** `expo-av` usage grep returns zero results, direct and transitive; `newArchEnabled` removed from app.json; native modules confirmed New-Architecture-compatible; Xcode ≥ 26 confirmed in EAS image.
- **Before 56:** `@react-navigation/*` codemod run AND manually audited (do not trust the codemod's completeness); `expo-file-system` async migration complete if sync calls were found; `@expo/vector-icons` scoped-package migration plan ready if transitive usage was found; iOS 16.4+ test device available; Hermes v1 memory baseline recorded if reanimated/worklets are present.
- **Before 57:** Pin at minimum 57.0.17 to pick up the Hermes v1 memory-regression fix; Android API 36 configured; full smoke test on iOS and Android; no outstanding regressions from the 56 hop.

## Consolidated unverified facts

These items could not be confirmed from the sources fetched during research and should be re-verified before being treated as gating criteria:

1. Exact Android `compileSdkVersion`/`targetSdkVersion` per SDK version (53 through 57) — inferred from Google Play compliance timelines, not fetched from an official Expo SDK reference table.
2. Exact iOS deployment-target floors for SDK 53 and SDK 54 specifically (assumed unchanged at 15.1 from SDK 52, not independently confirmed in each hop's own release notes).
3. TypeScript version requirements for SDK 54 and SDK 55 (only SDK 56's bump to TypeScript 6.0.3 was confirmed).
4. Swift version requirements for SDK 53 and SDK 54 (only SDK 55's Swift 6 adoption was confirmed).
5. Whether Hermes v1 is default or merely available-but-optional at SDK 55 (SDK 56 is confirmed as the hop where it becomes default).
6. The exact scope of import patterns the SDK 56 Expo Router codemod misses (the ~25%-miss figure is reported, not itemized).
7. `react-native-safe-area-context` 4.12.0's compatibility with SDK 57 specifically (compatibility is inferred, not confirmed against that package's own changelog).
8. Whether this repo has any transitive `@expo/vector-icons` usage (no direct dependency exists; transitive sourcing via other Expo modules is plausible but unconfirmed — resolve via the pre-hop `npm list` step above).
9. `react-native-screens` ~4.4.0's compatibility with the SDK's own bundled 4.23.0-era screens changes at SDK 55+ (implied breaking change in modal handling; not confirmed against that package's own changelog).
10. Whether SDK 55's new `expo-widgets` feature has any unwanted bundle-size impact on an app that doesn't use it (not measured).
11. Whether the reported August 31, 2026 → November 1, 2026 Google Play compliance extension is real (sourced from community discussion, not Google's own Developer Help Center).
12. Confirmation that the EAS Build project's current default Xcode image is already 26.4+ (the Apple April 28, 2026 deadline has already passed as of this document's date, so this should be a formality, but it has not been directly checked against this project's EAS config).

## Recommendation

Do not start this upgrade without Jeff's separate, explicit go. When approved, treat it as five independent branch-and-test cycles (one hop per branch, never a multi-hop squash), gated in the order above, with the `expo-av` and Expo-Router-decoupling hard gates treated as non-negotiable stop points. The Android API 36 compliance deadline (August 31, 2026, per Google Play) is the most likely forcing function on timing — if that date is close by the time this plan is acted on, prioritize reaching at least SDK 56 (or better, 57.0.17+) ahead of it rather than optimizing hop order for engineering convenience alone.

## Sources

- https://expo.dev/changelog/sdk-53
- https://expo.dev/changelog/sdk-54
- https://expo.dev/changelog/sdk-55
- https://expo.dev/changelog/sdk-56
- https://expo.dev/changelog/sdk-57
- https://docs.expo.dev/router/migrate/from-react-navigation/
- https://docs.expo.dev/router/migrate/sdk-55-to-56/
- https://reactnative.dev/blog/2025/08/12/react-native-0-81
- https://medium.com/react-native-journal/expo-sdk-56-will-break-your-imports-and-make-your-app-40-faster-the-honest-migration-guide-5f311f2a64a6
- https://developer.android.com/google/play/requirements/target-sdk
- https://expo.dev/blog/app-store-connect-minimum-sdk-26
