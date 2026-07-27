# P2 Slice Ledger — Jobcore

Goal slug: `jobcore-p1s5-p2-scheduling`
Build reports: `E:\Jeff\.claude\build-reports\jobcore-p1s5-p2-scheduling\`
Plan of record: `E:\Jeff\.claude\plans\toasty-puzzling-kahn.md`
Repo: `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\` (nested git, separate from the outer SDAssemblyPros repo)

**How to resume after a context clear:** read this file top-to-bottom, find the first row whose
status is not `DONE`, then read the newest build report in the goal-slug directory. Do not re-read
the whole codebase — each row names its own file set.

**Standing rules for every microslice** (full text in the plan of record):
Rule 30 all writes via hounds · Rule 18 dual-surface persona narration · Rule 6 recon via Explore ·
Rule 29 same-turn disk read behind every status claim · Rule 31 docs ride the change ·
Rule 8 build report per slice group · Glob is hook-gated — use PowerShell `Test-Path` /
`Get-ChildItem` · Master Spec §2 prohibitions stay in force (no sdassemblypro.com PHP/backend,
no GTM/GA4 changes, no review gating, zero PCI scope).

**Two tracks (Rule 15 R-A).** No live Supabase project exists, so every SQL-side acceptance
criterion is unverified by construction. SQL rows below are authored and committed on schedule;
their verification lines go into the build report's DEFERRED table and are re-run in one pass once
the project is provisioned. Gated ACs are reported as OPEN, never as PASSED.

---

## S5 — close the P1 gap (ungated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| S5.1 | This ledger scaffold | DONE | — | — | none |
| S5.2 | `packages/module-sdk/src/index.ts` — `ModuleRoute.component: React.ComponentType`; `@types/react` dep | DONE | | | module stubs in S5.3 must supply a component, not a string |
| S5.3 | Three module stub packages under `app/modules/` (ids + roles read from `00-MASTER-SPEC.md` in-slice, never guessed) | DONE | | | ids pinned by seed.sql L23; displayName/requiredRoles/navEntries are a documented ASSUMPTION (no spec supplies them) — admin-finance: owner+admin, order 10; field-tech: owner+admin+tech, order 20; sales-marketing: owner+sales, order 30; satisfies AC-3 (4 roles, 4 distinct nav sets) + P1 verify step 2 (tech sees no Admin). Record in the S5.8 build report. |
| S5.4 | Reference graph: `tsconfig.base.json` paths · root `tsconfig.json` refs · `apps/mobile/tsconfig.json` refs · `apps/mobile/package.json` deps · then `npm install` from `Jobcore/app/` | DONE | | | npm install run from Jobcore/app — "added 3 packages, audited 1152"; all three @jobcore/<module> workspace symlinks verified present under node_modules/@jobcore/. npm audit reports 49 pre-existing vulnerabilities (4 moderate, 44 high, 1 critical) — NOT introduced by this slice; triage deferred, note in the S5.8 build report. |
| S5.5 | `apps/mobile/src/modules.ts` (calls `registerModule` ×3) + `apps/mobile/app/m/[moduleId].tsx` | DONE | | | apps/mobile/src/modules.ts (18 lines, three registerModule calls) + apps/mobile/app/m/[moduleId].tsx (70 lines). Resolution goes through getEnabledModules (org-enabled AND role gate), not a raw registry lookup, so a deep link to a disabled/forbidden module lands on EmptyState. modules.ts is the ONLY file in apps/mobile permitted to name a module id (P1 verification step 5). |
| S5.6 | `apps/mobile/app/index.tsx` — wholesale replace with registry-driven launcher | DONE | | | apps/mobile/app/index.tsx replaced wholesale (87 -> 105 lines). Registry-driven launcher — resolves enabled modules via org/role gate, flattens and sorts nav entries globally by order, renders one list item each via Ionicons/@expo/vector-icons (already resolvable at 14.0.4, no install), navigates via expo-router, shows EmptyState when the resolved set is empty, sign-out preserved — see apps/mobile/app/index.tsx. Verified: zero occurrences of any module id in the file (P1 verification step 5). |
| S5.7 | `apps/mobile/app/_layout.tsx` (`m/[moduleId]` screen + `unprovisioned` branch) + `src/lib/session.tsx` (`unprovisioned` variant) | DONE | | | src/lib/session.tsx (235 → 241 lines): unprovisioned SessionState variant — see apps/mobile/src/lib/session.tsx; the missing-profile branch now returns it instead of collapsing into 'unauthenticated' — fixes an invisible login loop (sign in succeeds, bounces back to /sign-in, no error, no escape). app/_layout.tsx (85 → 103 lines): registry side-effect import (registers all three modules exactly once, before any getEnabledModules call — the registry was empty at runtime until now) + new 'unprovisioned' AuthGate branch (message + sign-out, modelled on 'disabled') + moduleId route screen declaration — see apps/mobile/app/_layout.tsx. Original loading/error/disabled/unauthenticated branches preserved verbatim. |
| S5.8 | Docs ride (`apps/mobile/README.md`, `handoff/P1-HANDOFF.md`) + `typecheck`/`lint` + AC-3/AC-4 + commit + build report | DONE | | | typecheck PASS (tsc --build --verbose, all 8 projects, exit 0) · lint PASS (eslint . --ext .ts,.tsx, exit 0, no output) · docs ride done: apps/mobile/README.md (stale "no npm install" + "S5 replaces this entirely" claims corrected) and handoff/P1-HANDOFF.md §3 (items 5/6/7 moved to built) · 02-P2-scheduling-core.md "What exists already" confirmed true, not edited · Karen's reported path apps/mobile/app/(auth)/session.tsx DOES NOT EXIST — recursive listing found only app/_layout.tsx and src/lib/session.tsx; that report was a mangled path · BASELINE: 6 `status ===` hits, ALL on the auth SessionState union (loading/error/disabled/unprovisioned/unauthenticated/authenticated) — this is correct TS discriminated-union idiom and is NOT a P2 AC failure; the P2 AC targets JobStatus decisions routed through canTransition, which does not exist yet. At P2b.3 evaluate as "no NEW hits beyond this 6-hit baseline" or refine the grep to exclude the session union · ASSUMPTION RECORD: displayName / requiredRoles / navEntries are specified by NEITHER 00-MASTER-SPEC.md NOR 01-P1-foundation.md; chosen to satisfy AC-3 (all four roles resolve to distinct nav sets) and P1 verification step 2 (tech sees no Admin) · AC-3/AC-4 ungated proxies OBTAINED: typecheck-clean registry + code inspection proving app/index.tsx has zero hardcoded module ids; the literal SQL-editor scripts remain GATED/open pending a provisioned Supabase project · 49 pre-existing npm-audit vulnerabilities (4 moderate, 44 high, 1 critical) in the Expo/RN tree — pre-existing, not actioned |

## P2-a — schema + RLS + seed (GATED: authored now, verified when Supabase exists)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2a.1 | `app/supabase/0004_scheduling.sql` — sections 1 Types + 2 Tables + indexes | TODO ← next | | | enum value list is the state machine's source of truth (P2b.1) |
| P2a.2 | `0004_scheduling.sql` section 3 — RLS policies | TODO | | | tech-sees-own-jobs rule asserted in P2f.1 |
| P2a.3 | `app/supabase/seed.sql` — customers/services/service_areas/leads/jobs/job_assignments rows | TODO | | | UUID blocks 02NN–07NN reserved |
| P2a.4 | `supabase/README.md` Files table + Apply order + commit + build report | TODO | | | none |

## P2-b — domain types + state machine (ungated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2b.1 | `packages/core/src/index.ts` — `JobStatus`, `Job`, `Ctx`, `PreconditionResult` | TODO | | | `JobStatus` must match the P2a.1 enum exactly |
| P2b.2 | `packages/core/src/state-machine.ts` — declarative transition table + `canTransition` / `applyTransition` | TODO | | | preconditions are ctx-injected; core must not know about checklists (P4) or payments (P5) |
| P2b.3 | AC sweep `grep -rn "status ===" apps modules` → no hits · typecheck · commit · build report | TODO | | | none |

## P2-c — payroll-grade clocks + immutable audit (partly gated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2c.1 | Dual `occurred_at` / `synced_at` + configurable skew threshold + skew flag | TODO | | | `en_route_at → completed_at` is the paid-hours surface |
| P2c.2 | `applyTransition` writes exactly one insert-only `audit_log` row per transition | TODO | | | audit rows are never UPDATEd |
| P2c.3 | 45-minute skew test + audit-row count check (GATED) + commit + build report | TODO | | | count check deferred to the gated pass |

## P2-d — offline queue (ungated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2d.1 | `npx expo install expo-sqlite` + queue table schema (`id, op, payload, occurred_at, status, attempts`) | TODO | | | expo-sqlite is in-SDK; MMKV rejected (bare native module forces a dev-client build) |
| P2d.2 | `packages/core/src/offline/` — optimistic apply, replay, client-generated idempotency key | TODO | | | conflict rule: server wins on scheduling fields, device wins on `occurred_at` |
| P2d.3 | `useSyncStatus()` + persistent "N pending" indicator | TODO | | | none |
| P2d.4 | Airplane-mode replay test + commit + build report | TODO | | | none |

## P2-e — Calendar + Job Detail (ungated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2e.1 | `npm install date-fns` + `(tabs)` group shell | TODO | | | `@react-navigation/bottom-tabs@7.18.13` already resolvable via expo-router 4.0.22 — no install |
| P2e.2 | Calendar — day + week, colour-coded by `job_status`, role-aware | TODO | | | `typography.lineHeight` values are MULTIPLIERS, not px |
| P2e.3 | Job Detail — shared canvas, actions from the registry's `jobActions` | TODO | | | hard AC: `JobDetail.tsx` imports NOTHING from `modules/` |
| P2e.4 | Airplane-mode day-view render + commit + build report | TODO | | | any new UI primitive goes into `packages/ui`, never inlined |

## P2-f — assertion suite + phase close (GATED)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2f.1 | `supabase/tests/0004_scheduling_rls.test.sql` — hand-applied `do $$ … end $$;` assertions + README registration | TODO | | | org isolation, tech-sees-own-jobs, audit immutability, recursion canary |
| P2f.2 | Full P2 AC sweep + phase build report + ledger close-out | TODO | | | P2 declared COMPLETE only here |

---

## Out of scope

P3 lead inbox / qualify / assignment UI / commission / price sheets · P4 checklists, photo capture,
tech greeting · P5 payment, QR handoff, reviews · P6 social posting · P7 real website intake.
Also deferred: `expo-font` + Poppins/Inter — the `packages/ui` tokens name those families but no
font loader exists, so headings currently fall back to system fonts. Tracked, not built here.
