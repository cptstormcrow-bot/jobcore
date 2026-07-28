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
| S5.2 | `packages/module-sdk/src/index.ts` — adds ModuleRoute.component type and @types/react dep. | DONE | 0ffb2b9 | | module stubs in S5.3 must supply a component, not a string |
| S5.3 | Three module stub packages under `app/modules/`. | DONE | 0ffb2b9 | | ids pinned by seed.sql L23; displayName/requiredRoles/navEntries are a documented ASSUMPTION (per-module roles+order); satisfies AC-3 + P1 step 2. |
| S5.4 | Reference graph updates (tsconfig paths/refs, mobile package.json deps) + npm install. | DONE | 0ffb2b9 | | npm install verified (3 packages added, 1152 audited, @jobcore symlinks present); 49 pre-existing npm-audit vulns (4 mod, 44 high, 1 crit) not introduced here; triage deferred to S5.8. |
| S5.5 | `apps/mobile/src/modules.ts` + `apps/mobile/app/m/[moduleId].tsx`. | DONE | 0ffb2b9 | | modules.ts (18 lines, 3 registerModule calls) is the ONLY file permitted to name a module id (P1 verify step 5); deep links resolve via getEnabledModules org+role gate. |
| S5.6 | `apps/mobile/app/index.tsx` replaced wholesale with registry-driven launcher. | DONE | 0ffb2b9 | | index.tsx (87→105 lines) verified zero module-id occurrences (P1 verify step 5); org/role gate, sorted nav, EmptyState, sign-out preserved. |
| S5.7 | `apps/mobile/app/_layout.tsx` + `src/lib/session.tsx` add an unprovisioned session state. | DONE | 0ffb2b9 | | session.tsx (235→241) adds 'unprovisioned' SessionState, fixing an invisible login-loop bug; _layout.tsx (85→103) adds registry import + AuthGate branch + moduleId route; other branches preserved. |
| S5.8 | Docs ride + typecheck/lint + AC-3/AC-4 + commit + build report. | DONE | 0ffb2b9 | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_s5-p1-gap-close.md | P2b.3 baseline: 6 `status ===` hits on auth SessionState union — evaluate as no NEW hits; AC-3/AC-4 remain GATED/open pending a provisioned Supabase project; 49 pre-existing npm-audit vulns (4 mod, 44 high, 1 crit) triage deferred. |

## P2-a — schema + RLS + seed (GATED: authored now, verified when Supabase exists)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2a.1 | `app/supabase/0004_scheduling.sql` — sections 1 Types + 2 Tables + indexes | DONE | ad3bb4d | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2a-scheduling-schema-rls-seed.md | enum value list is the state machine's source of truth (P2b.1) |
| P2a.2 | `0004_scheduling.sql` section 3 — RLS policies | DONE | ad3bb4d | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2a-scheduling-schema-rls-seed.md | tech-sees-own-jobs rule asserted in P2f.1 |
| P2a.3 | `app/supabase/seed.sql` — customers/services/service_areas/leads/jobs/job_assignments rows | DONE | ad3bb4d | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2a-scheduling-schema-rls-seed.md | UUID blocks 02NN–07NN reserved |
| P2a.4 | Enum-pointer fix — the state-machine table lives in `00-MASTER-SPEC.md` §10, not in the P2 spec; correct both `02-P2-scheduling-core.md` and `.claude\checkpoints\2026-07-27_162410_checkpoint.md` | DONE | ad3bb4d | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2a-scheduling-schema-rls-seed.md | §10 is the sole enum source for P2b.1 |
| P2a.5 | Ledger hygiene — cap every forward-contract cell at 3 lines | DONE | ad3bb4d | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2a-scheduling-schema-rls-seed.md | none |
| P2a.6 | Ledger hygiene — compact rows S5.1–S5.8 to one sentence each | DONE | ad3bb4d | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2a-scheduling-schema-rls-seed.md | none |
| P2a.7 | `supabase/README.md` Files table + Apply order + commit + build report | DONE | ad3bb4d | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2a-scheduling-schema-rls-seed.md | none |

## P2-b — domain types + state machine (ungated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2b.1 | `packages/core/src/index.ts` — `JobStatus`, `Job`, `Ctx`, `PreconditionResult` | DONE | e451d6e | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2b-domain-types-state-machine.md | `JobStatus` must match the P2a.1 enum exactly |
| P2b.2 | `packages/core/src/state-machine.ts` — declarative transition table + `canTransition` / `applyTransition` | DONE | e451d6e | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2b-domain-types-state-machine.md | preconditions are ctx-injected; core must not know about checklists (P4) or payments (P5) |
| P2b.3 | AC sweep `grep -rn "status ===" apps modules` → no hits · typecheck · commit · build report | DONE | e451d6e | .claude\build-reports\jobcore-p1s5-p2-scheduling\2026-07-27_p2b-domain-types-state-machine.md | roles arrays in TRANSITIONS are an inference (Master Spec §10 has no from→to→roles table); unit suite OPEN — no test runner wired |

## P2-c — payroll-grade clocks + immutable audit (partly gated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2c.1 | Dual `occurred_at` / `synced_at` + configurable skew threshold + skew flag | TODO ← next | | | `en_route_at → completed_at` is the paid-hours surface |
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
