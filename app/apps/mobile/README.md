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
  index.tsx     placeholder authenticated home (S5 replaces with registry-driven nav)
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

See `app/.env.example` at the monorepo root. `EXPO_PUBLIC_*` values are **inlined into the
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

## Status — dependencies are UNVERIFIED

**No `npm install` has been run for this workspace.** Every file here was authored from the
spec; the dependency versions in `package.json` have not been resolved, installed, or
type-checked against their real type definitions. Before trusting anything in this workspace:

1. Run `npm install` at the monorepo root (npm workspaces hoists into the root `node_modules`).
2. Run `npx tsc --build` from the root — `types: ["react", "expo"]` in this workspace's
   `tsconfig.json` will not resolve until the packages exist on disk.
3. Run `npx expo-doctor` to confirm the SDK 52 version alignment of the Expo packages.

Expect version drift to surface at step 1 or 3; treat the pins as a starting point, not a
verified lockfile.
