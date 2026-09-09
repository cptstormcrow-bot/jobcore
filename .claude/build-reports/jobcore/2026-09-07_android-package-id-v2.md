# JobCore — Android Package ID Migration to `.v2`

**Date:** 2026-09-07
**Branch:** `jobcore-job-detail-action-buttons`
**Commit:** `3f1805c`
**Tier:** A

## Summary

Changed the Android application/package id from `com.sdassemblypros.jobcore` to
`com.sdassemblypros.jobcore.v2` (decision "A" — permanent going forward). iOS bundle id
stays `com.sdassemblypros.jobcore` (asymmetric by design — no iOS build in this session).

Tracked source of truth updated in `app/apps/mobile/app.json` (`expo.android.package`,
line 17). Gitignored `android/app/build.gradle` `applicationId` was hand-updated to match
(uncommitted by design — `android/` is gitignored); `namespace` left unchanged. Docs updated
to match: `app/docs/deployment.md` and `jobcore-mobile-build-toolchain.md`.

A release APK was built locally via Gradle `assembleRelease` under the new `.v2` package id
and sideloaded for on-device verification:

- **Samsung phone** (Android 16) — installed and confirmed working.
- **Galaxy Tab S7 FE** (Android 14, One UI 6) — installed via a separate `.v2`-package build;
  Jeff confirmed: "That worked. I have an app on my tablet now."

APK artifact (unchanged from build, not re-delivered by this report):
`E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\apps\mobile\android\app\build\outputs\apk\release\app-release.apk`
— 84,597,122 bytes, SHA-256 `31d1b062049f9cf574465302c242649e73d88e1d3db9ad313000e0c0fcf31f46`,
package `com.sdassemblypros.jobcore.v2`, signing cert SHA-256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.

Standing constraint honored throughout: no physically/adb-attached device was ever
paired/connected/authorized by the assistant.

## Files changed (commit `3f1805c`)

- `app/apps/mobile/app.json` — `expo.android.package` → `com.sdassemblypros.jobcore.v2`
- `app/docs/deployment.md` — Android package id reference updated to match
- `jobcore-mobile-build-toolchain.md` — toolchain table row updated to match

Not committed (by design): gitignored `android/app/build.gradle` `applicationId` (hand-edited,
matches the source of truth in `app.json`); an unrelated datetimepicker plugins-array hunk in
`app.json` was deliberately left unstaged (see Deviations).

## Test plan

Declined — Jeff opted out of a test plan for this closeout (Rule 43 gate).

## Forward contracts

- **EAS cloud build still outstanding** for `com.sdassemblypros.jobcore.v2`. This session's
  on-device verification used a local Gradle build, not an EAS build, so the following two
  prior open forward contracts are only *partially* addressed (on-device check satisfied;
  EAS build itself not performed) and remain OPEN, carried forward:
  - 2026-09-04 job-detail-screen-restyle closeout FC: "eas build + on-device check"
  - 2026-09-04 field-tech Today's Jobs closeout FC: "eas-build"
- Jeff's go/no-go is still pending on deleting the stale duplicate Desktop file
  `E:\Jeff\Desktop\2026-09-07_next-apk-upgrade-plan.html` (see Deviations) — not a contract
  this change makes, but an open item this session surfaced and did not resolve.

## Deviations / Defects

1. **Rule 41 gate outcome:** evaluated the two prior open JobCore-lineage forward contracts
   named above. Neither is resolvable without Jeff's input (an actual EAS build is externally
   gated — Expo account/CLI session, Rule 15 R-A) so both are surfaced as still-open rather
   than marked resolved. This report does not claim EAS-build contracts were honored — only
   that local on-device installation was verified on two devices.
2. **Unrelated hunk deliberately excluded from the commit:** `app/apps/mobile/app.json` had a
   second, unrelated diff hunk (plugins array gaining `@react-native-community/datetimepicker`)
   mixed into the working tree alongside the package-id change. Staged only the package-id
   hunk via `git apply --cached` on a hand-trimmed patch, so the datetimepicker hunk remains
   unstaged in the working tree post-commit. This is expected/benign, not a defect in the
   commit itself, but is noted because `git status --short` still shows `M app.json`.
2. **Duplicate Desktop deliverable, one stale:** two copies of the Upgrade Plan HTML existed
   on the Desktop — `2026-09-07_jobcore-next-apk-upgrade-plan.html` (correct, delivered via
   SendUserFile) and `2026-09-07_next-apk-upgrade-plan.html` (stale round-1 draft, 28,470
   bytes, still contains a round-1 escaping blocker). Jeff was asked whether to delete the
   stale one; no reply received yet. Per Rule 14 (no idle leftovers) and the standing rule
   against deleting files without explicit confirmation, the stale file was left in place.
3. **Android package id `.v2` decision:** re-confirmed multiple times this session as a closed
   decision, not new work — recorded here only because Rule 25/37 require the change's context
   to be traceable from this report alone.

## Devices touched

Samsung phone (Android 16) and Galaxy Tab S7 FE (Android 14, One UI 6) — both via manual
sideload of a locally-built signed APK, initiated and confirmed by Jeff. No adb/USB pairing or
device authorization was performed by the assistant, per standing constraint.
