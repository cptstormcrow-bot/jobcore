# P1 — Foundation: monorepo, auth, roles, module system

> Paste this together with `00-MASTER-SPEC.md`. Build **only** what is in *Build this*.

## Context

You are starting **Jobcore**, a modular cross-platform field-service scheduling app
(React Native + Expo + Supabase). This phase builds the skeleton every later phase plugs into:
the workspace, authentication, the role model, and — most importantly — the **module contract**
that makes the app pluggable. No business feature is built here.

## What exists already

Nothing. This is a greenfield repository.

## Build this

### 1. Monorepo
An npm or pnpm **workspace** monorepo at the layout in Master Spec §16. TypeScript strict mode,
ESLint + Prettier, a shared `tsconfig.base.json` that every package extends via project references.

### 2. Expo app shell — `apps/mobile`
Expo (managed workflow) with **Expo Router**, configured for EAS Build on both iOS and Android.
`app.json` must carry the bundle identifiers and be readable as configuration, not scattered
constants. The brand name is a config value.

### 3. Supabase project — `supabase/`
Migration `0001_foundation.sql` creating **only**:

- `organizations` — `id, name, slug, enabled_modules text[], created_at`
- `profiles` — `id` (FK `auth.users`), `organization_id`, `full_name`, `phone`,
  `role` (`owner|admin|tech|sales`), `active`, `created_at`
- `audit_log` — `id, organization_id, actor_id, entity_type, entity_id, action, from_state,
  to_state, occurred_at, synced_at, metadata jsonb`

Enable RLS on all three. Policy: a user reads and writes only rows in their own
`organization_id`. Add a `current_org_id()` SQL helper and use it in every policy — later phases
will copy this pattern dozens of times, so make it clean now.

### 4. Auth
Email/password sign-in and sign-out via Supabase Auth. A session provider that hydrates the
`profiles` row (org + role) and exposes `useSession()`. Persist the session with SecureStore so a
tech is not logged out between shifts. Handle the loading and unauthenticated states explicitly.

### 5. The module SDK — `packages/module-sdk`
Implement the `JobcoreModule` interface **exactly** as given in Master Spec §11, plus:

```ts
export function registerModule(m: JobcoreModule): void;
export function getEnabledModules(org: Organization, role: Role): JobcoreModule[];
```

`getEnabledModules` filters by **both** `org.enabled_modules` and `requiredRoles`. Registration is
compile-time: a single `apps/mobile/src/modules.ts` imports each module package and calls
`registerModule`. Document in a code comment why runtime loading is not possible (Master Spec §3).

### 6. Navigation shell
A tab/drawer navigator built **entirely** from the registry — the shell must contain **zero**
hardcoded references to any specific module. Empty state when no module is enabled.

### 7. Three module stubs
`modules/admin-finance`, `modules/field-tech`, `modules/sales-marketing`. Each exports a valid
`JobcoreModule` with correct `id`, `requiredRoles`, and one placeholder screen.

### 8. Shared UI — `packages/ui`
Design tokens (color, spacing, typography) and a small primitive set: `Button`, `Card`,
`ListItem`, `EmptyState`, `LoadingState`, `ErrorState`. All UI should match the sdassemblypro.com website, Later phases must never restyle from scratch.

### 9. Seed script
`supabase/seed.sql` — one organization, and one user per role.

## Do NOT build

- Any job, lead, customer, or scheduling table or screen — that is P2
- Any payment, commission, price sheet, or payroll code — P3/P5
- Push notifications, offline queue, or checklists — P2/P4/P7
- Anything that reads from or writes to sdassemblypro.com

## Acceptance criteria

1. `npm install && npm run typecheck` passes clean from a fresh clone.
2. The app boots on both an Android emulator and an iOS simulator (or Expo Go).
3. Signing in as each of the four seeded roles shows a **different** set of nav entries.
4. Removing a module id from `organizations.enabled_modules` makes its tab disappear **with no code
   change**. This is the single most important test in this phase.
5. A user in org A cannot read org B's `profiles` rows — verified by a direct query, not just the UI.
6. `apps/mobile` imports nothing from `modules/*` except through the registry.

## Verification steps

1. `npm run typecheck` and `npm run lint` — expect zero errors.
2. Run the app; sign in as `tech@…` and confirm no Admin tab appears.
3. In the Supabase SQL editor, `UPDATE organizations SET enabled_modules = '{field-tech}'` and
   reload the app — only the tech module remains.
4. Sign in as org-A admin and run `select * from profiles` — confirm zero org-B rows return.
5. `grep -r "admin-finance\|field-tech\|sales-marketing" apps/mobile/src --exclude=modules.ts` —
   expect **no matches**. Any hit means the shell is coupled to a module and the plug-in contract is
   already broken.
