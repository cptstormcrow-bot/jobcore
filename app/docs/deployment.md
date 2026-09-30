---
classification: sdassemblypros/jobcore
comments: "Deployment"
origin: Codespace/SDAssemblyPros/Jobcore/app/docs/deployment.md
tags: [sdassemblypros, jobcore]
---
# Deployment

How the Jobcore mobile app gets built and shipped, and how environment
configuration flows into a build. This document describes the process and
the config that supports it — it does not document a live build or submit
run; none has been performed against this repository.

## Overview

The app is an Expo/React Native project built with EAS Build and shipped to
the App Store and Google Play with EAS Submit. There is no web deployment in
scope for this app (the marketing site, sdassemblypro.com, is a separate
property and out of scope for this repo).

Configuration lives in two files under `apps/mobile/`:

- `app.json` — the Expo app manifest: app name, identifiers, version,
  platform-specific settings, plugins, and the `extra.eas.projectId` that
  ties the app to an EAS project.
- `eas.json` — the EAS CLI config: build profiles (`development`, `preview`,
  `production`) and submit profiles for store upload.

## Build profiles

| Profile | Distribution | Purpose |
|---|---|---|
| `development` | internal | Dev client build for local development against a custom native runtime (`developmentClient: true`). |
| `preview` | internal | Ad-hoc/internal-testing build, e.g. for TestFlight internal testers or a shareable APK, without touching store listings. |
| `production` | store | Store-ready build. `autoIncrement: true` lets EAS bump the platform build number automatically per build; `appVersionSource: "remote"` (set at the top level of `eas.json`) tells EAS to track the authoritative version/build number remotely rather than trusting whatever is checked into `app.json` at build time. |

Each profile also sets an EAS **update channel** (`development`, `preview`,
`production`) so that any future EAS Update rollout targets the right
audience without cross-wiring test and production installs.

To run an actual build (not part of this change — recorded here for
reference):

```
cd apps/mobile
npx eas build --profile preview
npx eas build --profile production
```

## App identifiers and versioning

- iOS bundle identifier: `com.sdassemblypros.jobcore`; Android package: `com.sdassemblypros.jobcore.v2`
  (`app.json` → `ios.bundleIdentifier` / `android.package`).
- `app.json` → `version` is the user-facing semantic version (e.g. `0.1.1`).
  Bump this for any release that should show a new version string to users.
- `ios.buildNumber` / `android.versionCode` are the platform-specific build
  counters. With `appVersionSource: "remote"` and `autoIncrement: true` on
  the production profile, EAS manages these automatically on each production
  build; the checked-in values are the starting point, not the source of
  truth once builds have run.
- `extra.eas.projectId` links the app to its EAS project. The value checked
  into this repo is a placeholder (`REPLACE_WITH_EAS_PROJECT_ID`) — it must
  be replaced with the real project ID before the first EAS build. This is
  intentionally not filled in for this change, since no EAS project has been
  created or linked yet.

## Store submission config

`eas.json` → `submit.production` carries placeholder fields for both
platforms; none are real credentials and none have been supplied:

- iOS: `appleId`, `ascAppId` (App Store Connect app ID), `appleTeamId`.
- Android: `serviceAccountKeyPath` (path to a Google Play service-account
  JSON key, never to be committed to the repo) and `track` (defaults to
  `internal`; move to `production` when ready for a public release).

All of these are placeholders to be filled in by whoever owns the Apple
Developer and Google Play Console accounts. Do not commit real credentials,
API keys, or the Play service-account JSON into this repository.

## Environment variables

The app reads configuration through `EXPO_PUBLIC_*` environment variables,
which Expo inlines into the client bundle at build time. Only non-secret,
publishable values belong here:

- `EXPO_PUBLIC_SUPABASE_URL` — the project's Supabase URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the Supabase anon key. This is safe to
  ship in the client because access is enforced by Postgres Row Level
  Security (RLS) policies, not by keeping the key secret.

See `.env.example` at the repo root for the full list and expected shape.
**Never** put the Supabase `service_role` key, or any other secret, behind an
`EXPO_PUBLIC_*` name — anything with that prefix ships to every device that
installs the app.

For EAS builds, the same variables are supplied through EAS's environment
variable configuration (per-profile, via `eas env` or the EAS dashboard) so
that `development`/`preview`/`production` builds can point at different
Supabase projects if needed (e.g. a staging project for `preview`).

## Local Android APK build

A standalone release APK can be built locally with Gradle, replacing the EAS
cloud build for this APK. The app stays on Expo SDK 52. iOS is a separate,
later track.

Run from `app/apps/mobile`:

```
npm run build:apk
```

This wraps `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-apk.ps1`.
It runs three stages:

1. **PREFLIGHT** — checks that `android/` and `.env` are present, finds a
   JDK >= 17, and finds the Android SDK build-tools.
2. **BUILD** — maps a short `subst` drive (default `Z:`), runs
   `gradlew assembleRelease`, and always unmaps the drive in a `finally` block.
3. **VERIFY** — `apksigner verify`, `aapt` badging check, and a SHA256 hash.

Output: Gradle writes `android/app/build/outputs/apk/release/app-release.apk`;
the script copies it to `app/apps/mobile/jobcore-<version>-vc<versionCode>.apk`.

Flags:

- `-PreflightOnly` — run only the PREFLIGHT stage.
- `-Abi <abi>` — build a single ABI (e.g. `arm64-v8a`).
- `-JavaHome <path>` — use this JDK instead of auto-detection.
- `-Drive 'Z:'` — the `subst` drive letter to map.

Notes and pitfalls:

- **Run it in the main checkout** (`E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\apps\mobile`).
  `android/` and `.env` are gitignored and exist only there, so worktrees fail
  PREFLIGHT by design.
- The release APK is signed with the debug keystore, so it is sideload-only and
  not suitable for the Play Store.
- A stale system `JAVA_HOME` (e.g. Java 1.4) is skipped with a WARN; the script
  falls back to Android Studio's bundled `jbr` (JDK 21). Override with `-JavaHome`.

## What this document does not cover

- Actually creating or linking an EAS project — that requires an
  authenticated `eas` CLI session and is an operational step, not a code
  change.
- App Store / Google Play listing content (screenshots, descriptions,
  privacy labels) — store-listing content, not build config.
- CI/CD automation for triggering builds — no CI pipeline exists yet for
  this app.
