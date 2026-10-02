---
classification: sdassemblypros/jobcore
comments: "@jobcore/mobile"
origin: Codespace/SDAssemblyPros/Jobcore/app/apps/mobile/README.md
tags: [sdassemblypros, jobcore]
---
# @jobcore/mobile

The Expo (SDK 52 / React Native 0.76, New Architecture) client for Jobcore. This is the
`apps/mobile` workspace of the Jobcore monorepo; it consumes `@jobcore/core` (domain types),
`@jobcore/ui` (brand tokens + primitives) and `@jobcore/module-sdk` (module registry) as
workspace dependencies.

## Layout

```
app/            expo-router routes (file-based)
  _layout.tsx   root layout: SafeAreaProvider → SessionProvider → auth gate → <Stack>
  sign-in.tsx   email + password sign-in
  index.tsx     registry-driven launcher: getEnabledModules() -> flattened, order-sorted navEntries -> /m/<moduleId>
  m/[moduleId].tsx  resolves moduleId against the registry, renders the module's first route component
src/lib/
  supabase.ts   Supabase client, SecureStore-backed auth storage
  session.tsx   SessionProvider / useSession / signIn / signOut + row→domain mappers
```

## Required environment

Two variables must be set before the app will start — `src/lib/supabase.ts` throws at module
load if either is missing:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |

See `apps/mobile/.env.example` (the single canonical template, beside the app). `EXPO_PUBLIC_*` values are **inlined into the
bundle at build time**, so they must be non-secret — the anon key is safe only because every
table is RLS-gated. Restart the bundler after editing `.env`; the inlining happens at bundle
time, not at runtime.

Alternatively, supply `extra.supabaseUrl` / `extra.supabaseAnonKey` in `app.json`; the client
prefers `expo-constants` extra and falls back to the env vars.

## Running

```
npx expo start
```

Then press `i` (iOS simulator), `a` (Android emulator), or scan the QR code with Expo Go /
a development build. Native modules (`expo-secure-store`) require a development build rather
than stock Expo Go on some SDK combinations.

### Windows quick start/stop

A `dev-server.bat` wrapper (repo root: `Jobcore/app/apps/mobile/dev-server.bat`) launches/stops
the Expo dev server in its own titled window (`JobCore-Mobile-Dev-Server`) without needing to
`cd` into this directory first. Invoke by full path from any PowerShell window:

    & "E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\apps\mobile\dev-server.bat" start
    & "E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\apps\mobile\dev-server.bat" stop

If `start` reports port 8081 is in use, it's usually a stale `node.exe` from a previous session
the `stop` command didn't catch (it only kills by window title). Identify and clear it before
accepting the port-8082 fallback:

    netstat -ano | findstr :8081
    tasklist /FI "PID eq <PID from previous line>"
    taskkill /PID <PID> /F

## Build a sideload APK (Android)

The APK is the preferred on-device path for a phone; the Expo dev server above remains the
development loop.

```
npm run build:apk
```

This runs `scripts/build-apk.ps1` in three stages:

1. **PREFLIGHT** — checks prerequisites (Java, Android SDK build-tools, `android/`, `.env`).
2. **BUILD** — maps a short `subst` drive and runs `gradlew assembleRelease`; the drive is always
   unmapped afterwards.
3. **VERIFY** — `apksigner` signature check, `aapt` badging check, and a SHA256 of the APK.

Output: `jobcore-<version>-vc<versionCode>.apk` in this folder (copied from
`android/app/build/outputs/apk/release/app-release.apk`).

Flags (pass after `--` so npm appends them to the script):

| Flag | Purpose |
| --- | --- |
| `-PreflightOnly` | Check prerequisites without building: `npm run build:apk -- -PreflightOnly` |
| `-Abi <abi>` | Build a single ABI, e.g. `-Abi arm64-v8a` |
| `-JavaHome <path>` | Use a specific JDK instead of auto-detection |
| `-Drive 'Z:'` | Choose the `subst` drive letter |

Notes:

- Requires `android/` and `.env` (both gitignored, present in the main checkout only). Never commit
  `.env` values.
- Signed with the debug keystore, so the APK is sideload-only (not for the Play Store).
- A stale system `JAVA_HOME` (Java 1.4) is skipped; the Android Studio `jbr` (JDK 21) is used.
  Override with `-JavaHome`.
- Full procedure: `app/docs/deployment.md`.

## Status — dependencies are installed

**`npm install` has been run from `Jobcore/app/`.** `node_modules` and `package-lock.json`
exist, and the three workspace symlinks (`@jobcore/admin-finance`, `@jobcore/field-tech`,
`@jobcore/sales-marketing`) are materialized. If `node_modules` is missing (e.g. after a fresh
clone), run `npm install` from `Jobcore/app/` to restore it.

1. Run `npm install` from `Jobcore/app/` if `node_modules` is missing (npm workspaces hoists
   into the root `node_modules`).
2. Run `npx tsc --build` from the root — `types: ["react", "expo"]` in this workspace's
   `tsconfig.json` resolves against the installed packages.
3. Run `npx expo-doctor` to confirm the SDK 52 version alignment of the Expo packages.
