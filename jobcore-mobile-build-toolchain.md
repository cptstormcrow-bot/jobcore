---
title: Jobcore Mobile Build Toolchain (Android + iOS)
type: project
status: reference
created: 2026-08-04
updated: 2026-08-04
classification: admin/project
comments: "How Jobcore gets compiled for Android and iOS, and when"
origin: wiki/admin/projects/jobcore-mobile-build-toolchain.md
---

# Jobcore Mobile Build Toolchain (Android + iOS)

How the Jobcore app gets compiled for phones, what software Jeff must install, what it
costs, and when each build becomes worth doing. Verified against disk 2026-08-04.

**App source:** `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\apps\mobile\`

---

## 1. Decision: EAS Build, not a local toolchain

Compile in Expo's cloud (**EAS Build**). Nothing but a CLI installs on the Windows machine.

Reasons specific to this project:

- **iOS is impossible locally.** A local iOS build requires macOS + Xcode. Jeff is on
  Windows 10. EAS builds iOS on Expo's Macs, so no Mac is ever needed.
- **No `android/` directory exists** in the repo. A local Android build would run
  `expo prebuild` and commit generated native code — extra churn in a monorepo mid-P3.
- **`eas.json` is already written** with three profiles. It is the path the project was
  configured for.
- **Machine weight.** Android Studio + Gradle daemon + emulator is ~8-12 GB resident on a
  machine that has already had shell-extension lag problems.

---

## 2. What is already configured (verified on disk)

| Requirement | State | Evidence |
|---|---|---|
| Android package id | OK `com.sdassemblypros.jobcore` | `app.json` |
| iOS bundle id | OK `com.sdassemblypros.jobcore` | `app.json` |
| EAS profiles | OK `development` / `preview` / `production` | `eas.json` |
| Expo SDK / RN | OK Expo ~52.0.0, RN 0.76.5, New Arch on | `package.json`, `app.json` |
| Backend | OK hosted Supabase `vogkxkcceahtwyovpxsg` live, RLS suites PASSED | P3 slice ledger |
| Native `android/` dir | absent - EAS prebuilds it | — |

The `eas.json` profiles are platform-agnostic; the same three cover Android and iOS.

---

## 3. One-time setup

Install the CLI (Node >= 20 is already present):

```
npm install -g eas-cli
```

Log in from `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\apps\mobile`:

```
eas login
```

Requires a free Expo account from expo.dev.

---

## 4. Building both platforms

One command queues Android and iOS in parallel:

```
eas build --platform all --profile preview
```

Single platform:

```
eas build --platform android --profile preview
```

```
eas build --platform ios --profile preview
```

EAS returns a download link per build.

---

## 5. Android vs iOS - where they stop being symmetrical

| | Android | iOS |
|---|---|---|
| Account | Free Expo account | Free Expo account **+ Apple Developer Program, $99/year** |
| Build on Windows? | Yes (EAS), or locally with Android Studio | **EAS only** |
| Install on a test device | Download `.apk`, tap it, allow "install unknown apps" | Device UDID must be registered, or use TestFlight |
| Code signing | EAS auto-generates a keystore | EAS manages certs/profiles, needs Apple credentials |

The $99/year Apple Developer Program is unavoidable for running on a real iPhone. There is
no iOS equivalent of sideloading an APK.

### Registering iOS test devices (before the first iOS build)

```
eas device:create
```

Produces a QR code / link. Open it on each iPhone, install the profile, and the UDID
registers with Apple. Beyond roughly 5 testers, switch to TestFlight via `eas submit -p ios`.

---

## 6. Outstanding setup gaps

1. **`eas-cli` is not installed** and no Expo account is wired.
2. **`expo-dev-client` is not a dependency**, so the `development` profile in `eas.json`
   cannot produce a dev-client build as currently written. `preview` is unaffected.
3. **No icon / adaptive-icon / splash assets** and no `android.versionCode` in `app.json`.
   Fine for `preview`; required before store submission. `production.autoIncrement` in
   `eas.json` handles versionCode for production builds.
4. **`.env` is local-only.** The Supabase URL and anon key must move to EAS secrets or the
   cloud build ships without a backend.

Roughly a half-day of setup, all independent of feature work.

---

## 7. When each build becomes worth doing

Phase status as of 2026-08-04: mid-P3. Only group **P3-c** (money core, pure TS) is DONE at
commit `ee4a4f8`. Groups P3-a, P3-b, and P3-d through P3-n are all TODO. No admin screens
exist yet.

| Milestone | Build worth doing |
|---|---|
| **P3-d** (admin module shell renders) | First smoke-test `preview` build. Early enough to catch native / New-Architecture surprises while they are cheap. |
| **P3-n** (phase close) | Internally useful build - admin can run leads to qualify to assign to close-out. |
| **After P5** | Store-ready build. Payment capture and review flows are the customer-facing half; also needs icons, versionCode, privacy policy. |

### Apple account timing

The Apple Developer Program is externally gated (purchase, approval wait, device
registration), so under **Rule 15 (R-A)** it gets its own track and must not block the
ungated core. Hold off buying until close to P3-d - the year starts ticking from purchase
and there is nothing to look at on a phone before then.

---

## 8. Local build fallback (only if offline iteration is ever wanted)

Android only. Requires **Android Studio** (Ladybug or newer, ~8-12 GB on disk), **JDK 17**,
and an `ANDROID_HOME` env var pointing at `%LOCALAPPDATA%\Android\Sdk`. Then `npm run android`
in `apps/mobile` runs `expo run:android`, which prebuilds the missing `android/` folder and
invokes Gradle. Only needed for a desktop emulator; SDK command-line tools alone suffice
otherwise.

---

## Related

- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\handoff\P3-SLICE-LEDGER.md` - phase progress
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\00-MASTER-SPEC.md` - phase gates
