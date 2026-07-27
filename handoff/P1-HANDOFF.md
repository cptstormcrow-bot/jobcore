# P1 Foundation — Session Handoff

**Purpose:** everything a fresh build session needs to finish P1. Read this, then work from the two
spec files below. This file replaces re-reading the whole repo.

---

## 1. How to start the build session

1. Open a **fresh session**.
2. Paste **`00-MASTER-SPEC.md`** + **`01-P1-foundation.md`** (only those two — one phase per session).
3. **Then read this handoff.** It corrects one false premise in `01` and tells you what is already on disk.

Conflict rule: **Master Spec wins.** A phase file that disagrees with it is a bug.

---

## 2. Premise correction (read before you build)

`01-P1-foundation.md` says under *What exists already*: **"Nothing. This is a greenfield repository."**
**That is false.** A partial scaffold already exists at **`Jobcore/app/`** — that directory **is the
monorepo root** (specs live in `Jobcore/`, the monorepo lives in `Jobcore/app/`; Master Spec §16's
internal layout is satisfied inside it). Do **not** re-create what section 3 lists as DONE.

---

## 3. State of P1 — done vs. remaining

### Already built (in `Jobcore/app/` — reference, do not rebuild)
- **Root workspace config** — `package.json` (name `jobcore`, workspaces `apps/* packages/* modules/*`;
  scripts `typecheck`/`lint`/`format`; node ≥20; TS 5.6, ESLint 8.57, Prettier 3.3).
- **TS config chain** — `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, composite, path
  aliases `@jobcore/core|module-sdk|ui`) + root `tsconfig.json` (references core + module-sdk).
- **Lint/format** — `.eslintrc.cjs`, `.prettierrc`, `.gitignore`.
- **`.env.example`** — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_PRICEFEED_URL` (anon key is RLS-gated/safe; never service_role).
- **`packages/core`** — `Role` union (`owner|admin|tech|sales`), `Organization`, `Profile` types.
- **`packages/module-sdk`** — **the §11 contract is fully implemented**: `JobcoreModule` interface;
  `registerModule` (throws on duplicate id); `getEnabledModules(org, role)` (filters by BOTH
  `org.enabledModules` AND `requiredRoles`, fail-closed on empty roles, sorted by nav order);
  WHY-no-runtime-loading comment. **This is build-item #5 — treat it as done; do not rewrite it.**
  Wiring is now complete: `apps/mobile/src/modules.ts` exists and calls `registerModule()` for
  all three modules, fired via a side-effect import in `app/_layout.tsx`. Also note
  `ModuleRoute.component` is now `React.ComponentType` (was `string`) — there was never a
  string→component resolver.
- **Registry-driven nav shell** — built: `app/index.tsx` launcher (calls `getEnabledModules()`,
  flattens `navEntries`, sorts by `order`, pushes `/m/<moduleId>`) + `app/m/[moduleId].tsx`
  dynamic segment. Zero hardcoded module refs.
- **Three module stub packages** — built at `Jobcore/app/modules/{admin-finance,field-tech,sales-marketing}/`.

### Still to build (this is your actual P1 work)
| # | Item | Notes |
|---|------|-------|
| 2 | `apps/mobile` Expo shell | Expo managed + Expo Router, EAS iOS+Android, brand name as config in `app.json`. |
| 3 | `supabase/0001_foundation.sql` | `organizations` / `profiles` / `audit_log`; RLS on all three; `current_org_id()` helper used in every policy. |
| 4 | Auth | Email/password, `SessionProvider` + `useSession()`, SecureStore persistence, explicit loading/unauth states. |
| 8 | `packages/ui` | Tokens + `Button/Card/ListItem/EmptyState/LoadingState/ErrorState`, styled to match sdassemblypro.com. |
| 9 | `supabase/seed.sql` | One org + one user per role. |

The three module references, the three `apps/mobile/tsconfig.json` references, the six
`tsconfig.base.json` paths entries, and the three `apps/mobile/package.json` deps are all now
in place, and `tsc --build` passes across all 8 projects.

---

## 4. Non-negotiables (hold across all of P1)

1. **Website backend out of scope** — there is a local copy of sdassemblypro.com as a testbed that can be edited. That backend can be developed, but stay away from the deployed site entirely. PHP/forms/DB.
2. **Analytics stays Google** — never add/change/remove GTM/GA4.
3. **Zero PCI scope** — no card data in app/DB/handoff.
4. **No review gating** — same review links for every customer regardless of rating.
5. **Payout feeds review, not the reverse** — no rating input affects any payout.
6. **Timestamps payroll-grade** — `en_route_at → completed_at` = paid hours; audit rows never editable.
7. **UI copies the site** — `packages/ui` matches sdassemblypro.com colors/fonts/look.

---

## 5. Definition of done (from `01`, by reference — don't re-derive)

Ship against **Acceptance criteria 1–6** and run **Verification steps 1–5** in `01-P1-foundation.md`.
The linchpin is **criterion #4 + verification #3/#5**: removing a module id from
`organizations.enabled_modules` hides its tab with **no code change**, and
`grep -r "admin-finance\|field-tech\|sales-marketing" apps/mobile/src --exclude=modules.ts` returns
**no matches**. If either fails, the plug-in contract is broken.
