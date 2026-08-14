---
classification: plans/jobcore-p1-foundation-slice-ledger
comments: "Jobcore P1 — Foundation · Rolling-Slice Ledger"
origin: .claude/plans/jobcore-p1-foundation.slice-ledger.md
tags: [plans, jobcore-p1-foundation-slice-ledger]
---
# Jobcore P1 — Foundation · Rolling-Slice Ledger

> Gitignored working ledger for the rolling-slice build. One row per slice.
> Authoritative plan: `E:\Jeff\.claude\plans\jobcore-p1-foundation-build-rolling-slice-hound-delegated.md`
> Monorepo root (on disk): `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\`

| Slice | Scope | Status | Evidence / Report | Notes |
|-------|-------|--------|-------------------|-------|
| S0 | Workspace skeleton (`tsconfig.base.json`, root `package.json`, dir scaffold) | ✅ committed `97c4845` | — | monorepo root confirmed `Jobcore\app\` |
| S1 | Frozen module contract (`@jobcore/core` + `@jobcore/module-sdk`) | ✅ built (unverified compile) | build-reports/sdassemblypros/2026-07-20_s1-module-contract.md | 7 files on disk; typecheck/lint deferred to S9 (Karen) |
| S2 | Brand tokens + `packages/ui` primitives | ✅ built (unverified compile) | build-reports/sdassemblypros/2026-07-22_s2-brand-tokens-ui-primitives.md | 10 files; 4 status colors PLACEHOLDER; typecheck deferred to S9 |
| S3 | Supabase `0001_foundation.sql` + `seed.sql` + RLS | ✅ committed `314d957` | build-reports/sdassemblypros/2026-07-22_s3-supabase-foundation-sql.md | `current_org_id()` helper in every policy; 8 forward contracts |
| S4 | Expo shell + auth (SecureStore `useSession()`) | ✅ committed `b69d8a5` | build-reports/sdassemblypros/2026-07-22_s4-expo-shell-auth.md | 11 files +668 lines; 9 forward contracts; typecheck deferred to S9 |
| S5 | Registry-driven nav shell (zero hardcoded module refs) | ☐ pending | — | AC-4 target |
| S6 | Three module stubs + `src/modules.ts` | ☐ pending | — | AC-6 grep gate |
| S7 | `sdap_mock` local price-sheet feed (OUT-OF-CONTRACT) | ☐ pending | — | Ziggy Rule 11; LOCAL mock only |
| S8 | `app/HANDOFF.md` (PIB) | ☐ pending | — | |
| S9 | Karen verify + leads (Scout/Verdin) + milestone commit | ☐ pending | — | AC-1/3/4/6 verification |

## Frozen interface (S1 — do not redefine downstream, only extend)
- `@jobcore/core`: `Role = 'owner'|'admin'|'tech'|'sales'`; `Organization`, `Profile` (camelCase, `enabledModules ↔ enabled_modules`).
- `@jobcore/module-sdk`: `JobcoreModule` (§11 verbatim); `registerModule` (throws on dup id); `getEnabledModules(org, role)` — **fail-closed** double-filter (`enabledModules` membership AND `requiredRoles.includes(role)`), sorted by lowest `NavEntry.order`.
- 6 supporting types (minimal, extend in P2+): `ModuleRoute`, `NavEntry`, `JobAction`, `SettingsSchema`, `JobStatusEvent`, `JobCompletedEvent`.
