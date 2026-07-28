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

**Slice-sizing rule (added 2026-07-27).** A microslice row qualifies only if all four hold:
(1) it names **one** primary file — a second may ride along only for a Rule 31 docs-ride fix;
(2) it answers **one** question stateable in a single sentence;
(3) it needs no more than ~150 lines of pre-read context;
(4) verification, commit, and build-report work never shares a row with authoring work.
IDs decompose by suffix (`P2d.2` → `P2d.2a/b/c`); no existing ID is ever renamed or deleted.

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
| P2c.1 | Dual `occurred_at` / `synced_at` + configurable skew threshold + skew flag | DONE a7650b3 | | | `en_route_at → completed_at` is the paid-hours surface |
| P2c.2a | `packages/core/src/index.ts` — add the optional audit-sink member to `Ctx` (types only) | DONE a7650b3 | | | optional-shaped like `serverNow?` — existing callers keep compiling |
| P2c.2b | `state-machine.ts` — import `evaluateSkew`, replace `void clockPair;`, emit exactly one insert-only row | DONE a7650b3 | | | audit rows are never UPDATEd |
| P2c.2c | Rule 31 docs-ride — `state-machine.ts` L8–12 header note, the L192 "does not write audit rows" line, and `02-P2-scheduling-core.md:19`'s stale `0002_scheduling.sql` pointer | DONE a7650b3 | | | none |
| P2c.3a | 45-minute skew check | DONE a7650b3 | | | none |
| P2c.3b | Audit-row count check, recorded OPEN (Supabase-gated) | DONE a7650b3 | | | count check deferred to the gated pass |
| P2c.3c | Commit + Tier-A build report | DONE a7650b3 | | | report also covers the 2026-07-27 ledger-refactor doc hygiene |

## P2-d — offline queue (ungated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2d.1a | `npx expo install expo-sqlite` | TODO | | | expo-sqlite is in-SDK; MMKV rejected (bare native module forces a dev-client build) |
| P2d.1b | Queue table schema (`id, op, payload, occurred_at, status, attempts`) | TODO | | | schema is the contract P2d.2a's types mirror |
| P2d.2a | `packages/core/src/offline/` — queue types + client-generated idempotency key | TODO | | | key is client-generated, never server-assigned |
| P2d.2b | Optimistic apply | TODO | | | goes through `applyTransition`; must not re-decide legality |
| P2d.2c | Replay + conflict rule | TODO | | | server wins on scheduling fields, device wins on `occurred_at` |
| P2d.3a | `useSyncStatus()` | TODO | | | none |
| P2d.3b | Persistent "N pending" indicator | TODO | | | none |
| P2d.4a | Airplane-mode replay test | TODO | | | none |
| P2d.4b | Commit + build report | TODO | | | none |

## P2-e — Calendar + Job Detail (ungated)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2e.1a | `npm install date-fns` | TODO | | | `@react-navigation/bottom-tabs@7.18.13` already resolvable via expo-router 4.0.22 — no install |
| P2e.1b | `(tabs)` group shell | TODO | | | none |
| P2e.2a | Calendar — day view | TODO | | | `typography.lineHeight` values are MULTIPLIERS, not px |
| P2e.2b | Calendar — week view | TODO | | | none |
| P2e.2c | `job_status` colour map + role gate | TODO | | | colour map keys must match the 13-member `JobStatus` union exactly |
| P2e.3a | Job Detail — shared canvas | TODO | | | hard AC: `JobDetail.tsx` imports NOTHING from `modules/` |
| P2e.3b | `jobActions` registry wiring | TODO | | | actions arrive from the registry only; any new UI primitive goes into `packages/ui` |
| P2e.4a | Airplane-mode day-view render test | TODO | | | none |
| P2e.4b | Commit + build report | TODO | | | none |

## P2-f — assertion suite + phase close (GATED)

| # | Microslice | Status | Commit | Build report | Forward contracts |
|---|-----------|--------|--------|--------------|-------------------|
| P2f.1a | `supabase/tests/0004_scheduling_rls.test.sql` — org-isolation + tech-sees-own-jobs assertions | TODO | | | hand-applied `do $$ … end $$;` form |
| P2f.1b | Audit-immutability + recursion-canary assertions | TODO | | | audit rows are never UPDATEd (asserted here) |
| P2f.1c | `supabase/README.md` test registration | TODO | | | none |
| P2f.2a | Full P2 AC sweep | TODO | | | gated ACs reported OPEN, never PASSED |
| P2f.2b | Phase build report + ledger close-out | TODO | | | P2 declared COMPLETE only here |

---

## Out of scope

P3 lead inbox / qualify / assignment UI / commission / price sheets · P4 checklists, photo capture,
tech greeting · P5 payment, QR handoff, reviews · P6 social posting · P7 real website intake.
Also deferred: `expo-font` + Poppins/Inter — the `packages/ui` tokens name those families but no
font loader exists, so headings currently fall back to system fonts. Tracked, not built here.
