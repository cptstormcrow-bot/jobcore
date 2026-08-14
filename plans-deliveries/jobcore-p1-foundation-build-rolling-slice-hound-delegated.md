---
classification: plans/jobcore-p1-foundation-build-rolling-slice-hound-delegated
comments: "Jobcore P1 — Foundation build (rolling-slice, hound-delegated)"
origin: .claude/plans/jobcore-p1-foundation-build-rolling-slice-hound-delegated.md
tags: [plans, jobcore-p1-foundation-build-rolling-slice-hound-delegated]
---
# Jobcore P1 — Foundation build (rolling-slice, hound-delegated)

## Context

**Goal:** Execute `01-P1-foundation.md` — build the Jobcore monorepo skeleton (workspace, Expo
shell, auth, role model, module contract, three stubs, shared UI, Supabase foundation SQL) — under
rolling-slice context discipline with sub-agent delegation, so the main context never holds more
than one slice of file bodies. **Two user-directed additions this session ride alongside, fenced
outside the P1 ACs:** (S7) extend the local `sdap_mock` test-bed with a Jobcore-facing price-sheet
feed, and (S8) a stack-exact Android Studio + Mac Mini iOS `HANDOFF.md`.

Jobcore is a modular cross-platform field-service scheduling app for SD Assembly Pros
(React Native + Expo + Supabase). P1 builds **no business feature**. Its single most important
deliverable is the **plug-in contract**: a navigation shell driven entirely by a module registry,
such that removing an id from `organizations.enabled_modules` makes a tab disappear with zero code
change. Every later phase (P2–P7) inherits that contract; if it is broken at P1 the damage
propagates.

**Premise verification (Rule 23), performed this session:**
- `E:\Jeff\Codespace\SDAssemblyPros\` contains **only** `Jobcore\` — ten `.md` spec files, zero
  code. P1's "Nothing. This is a greenfield repository." is **confirmed true**.
- Toolchain present: **Node v22.22.2, npm 10.9.7**.
- **A local copy of sdassemblypro.com EXISTS** at
  `wiki\admin\webpages\SDAssemblyPros\sdassemblypro.com\` (COMPLETE local test-bed, 2026-07-08).
  The earlier "no local copy exists" premise is **FALSIFIED**. Brand tokens come from local files —
  `styles.css` (50,702 b, at root), `fonts.css` (Dancing Script / Inter / Poppins), `photos\` (10
  jpg) — read-only, **no live-site fetch**.
- That test-bed also carries a working **PHP/MySQL mock backend** (`sdap_mock` DB; `api/db.php`,
  `api/submit.php`, `api/reviews.php`) for Forms + Reviews — the starting point for the
  user-directed testbed backend extension (S7 below).
- NTFS is case-insensitive: a `jobcore\` folder would collide with the existing `Jobcore\` spec
  folder. Resolved below.

**Decisions locked with Jeff this session:**

| Decision | Choice |
|---|---|
| Monorepo root | `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\` (sibling of `Jobcore\` specs) |
| Package manager | **npm workspaces** (matches AC-1's literal `npm install && npm run typecheck`) |
| Supabase scope | **SQL + typed client only** — migrations, RLS, seed, env-driven client. No live project. |
| Brand tokens | **Extracted from the LOCAL test-bed** — `styles.css` + `fonts.css` + `photos\`. No live-site fetch. |
| Testbed backend | **Extend the existing `sdap_mock`** with a Jobcore-facing price-sheet feed (S7). Live site untouched. |
| Handoff docs | **Full stack-exact `HANDOFF.md`** — Android Studio + Mac Mini iOS (S8). |

**Hard constraints (non-negotiable, apply to every slice):**
- **The LIVE site (sdassemblypro.com) is strictly out of scope.** Never write, modify, or call PHP,
  forms, or the database on the live site. No phase writes, deploys, or modifies anything there.
- **The LOCAL test-bed copy is in scope for a backend extension** (user-directed this session):
  extend the existing throwaway `sdap_mock` PHP/MySQL mock only. It is an **unverified throwaway
  mock — never a hard dependency** of the app (Supabase stays the system of record).
- **Analytics stays Google.** Never add, change, or remove GTM/GA4 tags anywhere (`GTM-TNZSSDC`,
  `G-93R89491PL`).
- **Brand tokens are read-only** from the local test-bed's `styles.css`/`fonts.css`/`photos\` — no
  live-site fetch.
- Jobcore-app build follows *Build this* exactly. No job/lead/customer/scheduling tables (P2), no
  payment/commission/payroll code (P3/P5), no push/offline-queue/checklists (P2/P4/P7). The S7
  price-sheet feed is a **testbed-backend + typed-reader foundation only** — no in-app pricing UI
  or payment logic (that stays P3/P5).
- Zero PCI scope — no card data ever touches the app, the DB, or the handoff page.
- The Master Spec wins any disagreement with the phase file; a direct user directive this session
  (testbed backend + handoff docs) wins over both, and is fenced so it never contaminates the P1 ACs.

---

## Context strategy (how the window stays small)

This build exceeds the rolling-slice break-even (~300 lines / ≥3 files) many times over — the
finished tree is ~40 files. Mechanics per `.claude\reference\rolling-slice-cadence.md`:

1. **One slice live at a time.** Each slice below is self-contained. When a slice closes, its file
   bodies are evicted from main context; only its on-disk BUILD REPORT and a one-line manifest
   (paths + exported symbols) survive.
2. **Sub-agents hold the bulk.** Each build slice is dispatched to a **`general-purpose` agent**
   with a written spec + the interface contract it must honor. The agent writes the files and
   returns **≤20 lines**: files created, exported symbols, deviations. Full file bodies never enter
   main context. The main session keeps every interpretation, gate, and yield decision.
3. **Just-in-time anchors via Magellan** (`Explore`) — when a later slice needs to know what an
   earlier slice actually emitted, Magellan re-derives the anchor rather than the main session
   re-reading files.
4. **Argus band read at every slice boundary.** Red band after eviction = saturation → `/checkpoint`
   → `/clear` instead of continuing (CLAUDE.md Context Budget rule).
5. **Slice ledger** at `E:\Jeff\.claude\plans\jobcore-p1-foundation.slice-ledger.md` (gitignored)
   tracks slice status so a post-`/clear` session resumes without re-reading the tree.
6. **Interface-first ordering.** S1 (the contract) and S2 (tokens) precede everything that consumes
   them, so downstream agents receive a *frozen* interface in their prompt and never need to read
   upstream source.

**Hound assignments:**

| Hound | Slug | Role in this build |
|---|---|---|
| Magellan | `Explore` | S2 — read-only extraction of brand tokens from the local `styles.css`/`fonts.css`; plus just-in-time anchor lookups at slice boundaries |
| Ziggy | `tempfile-hound` | S7 — Rule 11 temp-copy DB verify of the `sdap_mock` price-sheet extension |
| Karen | `verify-hound` | S9 — runs typecheck, lint, the AC-6 coupling grep, and the registry proof |
| Argus | `overflow-estimate-hound` | Band read at each slice boundary |
| Scout / Verdin | `recon-lead` / `verify-lead` | Rule 19 lead re-judge at the S9 milestone (gated: executable behavior + ≥3 files → leads fire) |

---

## Target layout

```
E:\Jeff\Codespace\SDAssemblyPros\app\
  package.json                    npm workspaces root, scripts: typecheck lint format
  tsconfig.base.json              strict; path aliases @jobcore/*
  .eslintrc.cjs  .prettierrc  .gitignore  .env.example  README.md
  apps/mobile/                    Expo managed + Expo Router
    app.json  eas.json  package.json  tsconfig.json
    app/_layout.tsx  app/(auth)/sign-in.tsx  app/(app)/_layout.tsx  app/(app)/[module]/[...rest].tsx
    src/session/SessionProvider.tsx  src/session/useSession.ts  src/lib/supabase.ts
    src/lib/pricefeed.ts             ← S7 typed reader for the sdap_mock feed (optional, env-gated, no UI)
    src/navigation/ModuleTabs.tsx   src/modules.ts        ← ONLY file naming module packages
  packages/module-sdk/            JobcoreModule, registerModule, getEnabledModules
  packages/core/                  Role, Organization, Profile shared types (minimal at P1)
  packages/ui/                    tokens.ts + Button Card ListItem EmptyState LoadingState ErrorState
  modules/admin-finance/  modules/field-tech/  modules/sales-marketing/
  supabase/0001_foundation.sql  supabase/seed.sql
  HANDOFF.md                    ← S8: Android Studio + Mac Mini iOS handoff (PIB, stack-exact)
```

`packages/core` is added at P1 holding **only** `Role`, `Organization`, `Profile` — the module SDK
and the app both need these types, and Master Spec §11 forbids modules importing each other, so a
shared type home is required now. No state machine, no job types (that is P2).

---

## Slices

Each slice ends with: agent manifest → on-disk BUILD REPORT → Argus band read → eviction → yield
(Rule 10).

### S0 — Workspace skeleton *(main session, small)*
`app/package.json` (workspaces: `apps/*`, `packages/*`, `modules/*`; scripts `typecheck`, `lint`,
`format`), `tsconfig.base.json` (`strict: true`, `composite: true`, path aliases
`@jobcore/module-sdk`, `@jobcore/ui`, `@jobcore/core`), `.eslintrc.cjs`, `.prettierrc`,
`.gitignore`, `.env.example` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and
`EXPO_PUBLIC_PRICEFEED_URL` — the optional S7 testbed feed URL, blank by default).
Small enough to write inline — no agent.

### S1 — `packages/module-sdk` + `packages/core` *(agent)*
`JobcoreModule` **verbatim from Master Spec §11** (`id, displayName, requiredRoles, routes,
navEntries, jobActions?, hooks?, migrations?, settings?`) plus `ModuleRoute`, `NavEntry`,
`JobAction`, `SettingsSchema`, and the two registry functions:

```ts
export function registerModule(m: JobcoreModule): void;
export function getEnabledModules(org: Organization, role: Role): JobcoreModule[];
```

`getEnabledModules` filters on **both** `org.enabled_modules` **and** `requiredRoles`, and sorts by
`navEntries` sort order. Registry is a module-scoped `Map<string, JobcoreModule>`; duplicate id
throws. A header comment documents **why runtime loading is impossible** (Master Spec §3: RN cannot
load native code at runtime; App Store review forbids it — "adding a module is a build, enabling one
is a config change"). `packages/core` exports `Role = 'owner'|'admin'|'tech'|'sales'`,
`Organization`, `Profile`. **This is the frozen interface every later slice is handed in prompt text.**

### S2 — Brand tokens + `packages/ui` *(Magellan local extraction, then agent)*
Magellan (`Explore`, read-only) extracts brand tokens from the **local test-bed** —
`wiki\admin\webpages\SDAssemblyPros\sdassemblypro.com\styles.css` (50,702 b), `fonts.css`, and the
`photos\` set — returning a compact palette/typography/spacing extraction (hex values, the Dancing
Script / Inter / Poppins font stacks with their weights, radius/shadow scale). **No live-site
fetch, no writes, no PHP, no tracking touched** — the 50 KB stylesheet stays in the hound's
context, never the main thread. That extraction is handed to a build agent that writes
`packages/ui/src/tokens.ts` plus six primitives — `Button`, `Card`, `ListItem`, `EmptyState`,
`LoadingState`, `ErrorState` — all consuming tokens, zero hardcoded colors. If a value is missing
from the local CSS, that token ships as a documented placeholder and the slice reports it rather
than inventing a brand.

### S3 — Supabase foundation SQL *(agent)*
`supabase/0001_foundation.sql`: `organizations`, `profiles`, `audit_log` exactly as specified, RLS
enabled on all three, a `current_org_id()` `security definer stable` helper reading the caller's
`profiles.organization_id`, and every policy expressed through it. `profiles.role` is a Postgres
enum `('owner','admin','tech','sales')`. `supabase/seed.sql`: one organization with
`enabled_modules = '{admin-finance,field-tech,sales-marketing}'` and one user per role.
Because no live project exists, the slice also emits `supabase/README.md` with the exact apply
order and the AC-3/4/5 test protocol to run once a project is provisioned.

### S4 — Expo shell + auth *(agent)*
`app.json` as readable configuration (brand name, bundle identifiers `com.sdassemblypros.jobcore`
for iOS and Android, scheme, plugins), `eas.json` with development/preview/production profiles.
`src/lib/supabase.ts` — client with a **SecureStore** storage adapter so a tech stays signed in
between shifts. `SessionProvider` hydrates the `profiles` row (org + role) after auth and exposes
`useSession()` returning a discriminated union: `loading | unauthenticated | authenticated`.
Expo Router `_layout.tsx` routes on that union. Sign-in/sign-out screens using `packages/ui`.

### S5 — Registry-driven navigation shell *(agent)*
`src/navigation/ModuleTabs.tsx` builds tabs **entirely** from `getEnabledModules(org, role)` —
**zero** hardcoded module ids or imports. A dynamic route renders whatever screen the registry
supplies. Explicit `EmptyState` when the filtered list is empty. This slice's agent is told
explicitly: *any literal string `admin-finance`, `field-tech`, or `sales-marketing` in
`apps/mobile/src` outside `modules.ts` is a build failure.*

### S6 — Three module stubs + compile-time registration *(agent)*
`modules/admin-finance` (`requiredRoles: ['owner','admin']`), `modules/field-tech`
(`['owner','admin','tech']`), `modules/sales-marketing` (`['owner','admin','sales']`) — each a valid
`JobcoreModule` with one placeholder screen built from `packages/ui`, importing **only**
`@jobcore/module-sdk`, `@jobcore/core`, `@jobcore/ui` — never each other. `src/modules.ts` imports
all three and calls `registerModule`, with a comment marking it the single coupling point.

### S7 — Local test-bed backend extension: Jobcore price-sheet feed *(agent + Ziggy verify)*
**User-directed addition, fenced outside the P1 ACs.** Extend the existing throwaway `sdap_mock`
mock at `wiki\admin\webpages\SDAssemblyPros\sdassemblypro.com\` — the live site is never touched:
- **DB:** add a `price_sheet` table to `schema.sql` (`id, sku, label, unit, base_price_cents,
  updated_at`) and seed a handful of rows. **No card/PCI data — prices only.**
- **Endpoint:** `api/pricesheet.php` — mirrors the existing `api/reviews.php` shape: include
  `api/db.php`, `SELECT` the rows, return `{ok, prices:[…]}` JSON. GET-only, read-only, no writes
  from the app.
- **App side (thin, optional):** `apps/mobile/src/lib/pricefeed.ts` — a typed `fetchPriceSheet()`
  reader guarded behind `EXPO_PUBLIC_PRICEFEED_URL`. **No UI, no pricing screen, no payment logic**
  (that is P3/P5). The feed is an **optional data source, never a build dependency** — Supabase
  stays the system of record; if the env var is unset the reader is inert.
- **Analytics + Forms + Reviews on the test-bed are untouched** (GTM/GA4, `submit.php`,
  `reviews.php` unchanged).
- **Verify (Ziggy, Rule 11):** serve with `C:/xampp/php/php.exe -S localhost:8000` at the test-bed
  root; exercise `api/pricesheet.php` against a **temp copy** of `sdap_mock` (never the live mock
  DB), assert JSON shape + row count, confirm the temp DB is torn down. This verify is **separate
  from the P1 ACs** so P1 contract-purity is never entangled with the testbed.
- Test-bed files sync to the vault via `sync-to-drive.bat` (never git-staged directly), and the
  completed record `wiki\admin\projects\completed\sdassemblypros-local-test-bed.md` gets a
  price-sheet-feed addendum.

### S8 — Handoff docs: `app/HANDOFF.md` *(main session, PIB-mode)*
A stack-exact (Rule 13, PIB) `HANDOFF.md` at the monorepo root covering the exact path from this
Windows build to native devices:
- **Prerequisites** on host `wolfgaard1`: Node **v22.22.2**, npm **10.9.7**, `npm install` clean,
  an Expo/EAS account.
- **Android Studio path:** `npx expo prebuild --platform android` to generate the native `android/`
  Gradle project, then open `SDAssemblyPros\app\apps\mobile\android` in Android Studio; or the
  cloud route `eas build --platform android --profile development`; plus the fastest inner loop
  (`npx expo start` + Expo Go / dev client on a physical Android). Bundle id
  `com.sdassemblypros.jobcore`.
- **Mac Mini iOS note (deferred until the Mac is ready):** iOS native builds and the simulator
  **require macOS** — from the Mac Mini: clone the repo, `npm install`, `npx expo prebuild
  --platform ios`, `cd apps/mobile/ios && pod install`, open in Xcode or run
  `eas build --platform ios`. An Apple Developer account + signing certs are the gating
  prerequisites; none of this is possible from Windows.
- Written from the actual repo layout (bundle ids in `app.json`, EAS profiles in `eas.json`), not
  generic Expo boilerplate.

### S9 — Verify + close *(Karen, then leads)*
Karen runs the P1 check list below. Then Rule 19 leads (Scout + Verdin) re-judge goal-met from the
artifacts. Milestone commit → BUILD REPORT → `/ground` (Web profile). The S7 testbed verify is
reported alongside but **kept distinct** from the P1 ACs.

---

## Verification

Karen's `check_list[]` — mechanical, all runnable without a live Supabase project:

1. `npm install` from a clean tree → exits 0.
2. `npm run typecheck` → **zero** errors (AC-1).
3. `npm run lint` → **zero** errors.
4. `grep -rn "admin-finance\|field-tech\|sales-marketing" apps/mobile/src` excluding `modules.ts`
   → **no matches** (AC-6). *Any hit fails the slice — the shell is coupled and the contract is broken.*
5. Unit-level registry proof (AC-3/AC-4 without a database): a small script constructs a fake
   `Organization` and calls `getEnabledModules` for each of the four roles, asserting four distinct
   nav sets, then drops an id from `enabled_modules` and asserts that module vanishes — **no code
   change**. This is the honest, runnable form of "the single most important test in this phase."
6. SQL sanity: `0001_foundation.sql` parses, RLS is enabled on all three tables, and **every**
   policy references `current_org_id()` (grep-asserted).

**S7 testbed-backend check (Ziggy, separate from the P1 ACs):** `api/pricesheet.php`, served under
`C:/xampp/php/php.exe -S localhost:8000`, returns well-formed `{ok, prices:[…]}` JSON with the
seeded row count, exercised against a **temp copy** of `sdap_mock` (Rule 11) with the temp DB torn
down and the live mock DB byte-unchanged.

**Deferred to Supabase provisioning** (documented in `supabase/README.md`, not claimed as passing):
AC-2 (boots on emulator/simulator — needs `npx expo start` on a device), AC-5 (org-A cannot read
org-B `profiles`, verified by direct query), and the live SQL-editor form of AC-3/AC-4.
The BUILD REPORT will state these as **deferred**, never as passed.

---

## Deliverables

- Monorepo at `E:\Jeff\Codespace\SDAssemblyPros\app\`
- Stack-exact `app/HANDOFF.md` (Android Studio + Mac Mini iOS)
- Testbed price-sheet feed extension on `sdap_mock` (`api/pricesheet.php` + `price_sheet` table +
  seed) under `wiki\admin\webpages\SDAssemblyPros\sdassemblypro.com\`, synced via
  `sync-to-drive.bat`; completed-record addendum
- Per-slice BUILD REPORTs at `E:\Jeff\.claude\build-reports\sdassemblypros\`
- Slice ledger at `E:\Jeff\.claude\plans\jobcore-p1-foundation.slice-ledger.md`
- Lead verdict at `E:\Jeff\.claude\state\lead-verdicts\M-p1.json`

**Forward contracts (Rule 25):** P2 must import job types from `packages/core` and register screens
through `JobcoreModule.routes` only; the `current_org_id()` helper in `0001_foundation.sql` is the
pattern every later migration's RLS policies copy; `src/modules.ts` remains the sole file in
`apps/mobile` permitted to name a module package; the S7 `sdap_mock` price-sheet feed is a
**throwaway testbed prototype** of the eventual price-sheet integration — P3/P5 may study its shape
but must **never** depend on it (Supabase / the real feed is the system of record), and
`EXPO_PUBLIC_PRICEFEED_URL` stays optional/inert when unset. The custody copy
`jobcore-p1-foundation.md` is re-synced to match this file on approval (Plan Mode blocks it now).
