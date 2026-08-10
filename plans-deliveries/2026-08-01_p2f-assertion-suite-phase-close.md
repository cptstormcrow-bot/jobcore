---BUILD REPORT---

# P2-f — assertion suite + phase close (GATED)

Goal slug: `jobcore-p1s5-p2-scheduling`
Date: 2026-08-01
Ledger: `Jobcore\handoff\P2-SLICE-LEDGER.md` rows P2f.1a … P2f.2b
Plan of record: `.claude\plans\toasty-puzzling-kahn.md`

## What changed

| File | Change | Lines |
|------|--------|-------|
| `app/supabase/tests/0004_scheduling_rls.test.sql` | NEW — org-isolation (AC-3.1 / 3.5) and tech-sees-only-assigned-jobs (AC-7) assertions | 162 |
| `app/supabase/tests/0001_foundation_rls.test.sql` | NEW — audit-log immutability (AC-5.2 / 5.3 / 5.4) and the profiles recursion canary | 178 |
| `app/supabase/README.md` | Registered both test files: two `## Files` rows, apply-order step 7, new `### Automated assertions — tests/` subsection | 139 → 160 (+21) |

Measurement provenance (Rule 29-B): every count above from
`[IO.File]::ReadAllLines('<absolute path>').Length`, re-run in the main session.

Both test files are pure ASCII, wrapped `begin; … rollback;`, and use double-dollar
anonymous blocks (`do $$ … end $$;`) — 6/6 balanced in 0004, 7/7 in 0001.

## Falsifiability design

The immutability suite plants an `audit_log` fixture row with `reset role` before probing, so the
0-row UPDATE/DELETE assertions cannot pass vacuously against an empty table. An AC-5.3b survival
check re-reads the fixture to distinguish "denied by RLS" from "silently succeeded but reported 0
rows". An AC-5.2 append check guards against satisfying immutability by revoking everything.
The scheduling suite asserts tech visibility by id-array equality against the three assigned jobs,
with two seeded jobs deliberately left unassigned so AC-7 is falsifiable.

## P2 acceptance-criteria sweep (P2f.2a)

Source of truth: `Jobcore\02-P2-scheduling-core.md` L102-123.

| # | Acceptance criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | Full happy path + illegal transitions rejected with a reason | OPEN | State machine authored (P2-a/P2-b); unit suite not written — P2b.3 forward contract |
| 2 | `canTransition` is the only place legality is decided | **PASS** | Recursive `Select-String 'status ==='` over `app\apps` + `app\modules`, `node_modules` excluded: 12 source hits (`_layout.tsx` ×5, `calendar.tsx` ×4, `jobs.tsx` ×2, `session.tsx` ×1) — all on the auth `SessionState` union, none on `JobStatus`. `dist\` mirrors excluded as emitted output |
| 3 | Day view renders in airplane mode from cached data | OPEN | `handoff/P2E-AIRPLANE-MODE-TEST.md` authored; re-run required once a job data seam lands |
| 4 | Offline mutation replays exactly once | OPEN | `replay` unwired (P2-d forward contract) |
| 5 | `occurred_at` survives sync; only `synced_at` server-assigned | OPEN (GATED) | No live Supabase project |
| 6 | Every transition produces exactly one `audit_log` row | OPEN (GATED) | No live Supabase project |
| 7 | A tech querying `jobs` sees only their assigned jobs | OPEN (GATED) | Asserted in `tests/0004_scheduling_rls.test.sql`; unexecuted |

| # | Verification step | Status |
|---|-------------------|--------|
| 1 | Run the state-machine unit suite | OPEN — suite not authored |
| 2 | Airplane-mode transition walk | OPEN — needs a device + data seam |
| 3 | Clock-skew flag at +45 min | OPEN — recording-only per P2c.3b |
| 4 | `select count(*) from audit_log where entity_id = '<job>'` | OPEN (GATED) |
| 5 | Run `supabase/tests/` RLS assertions — all pass | OPEN (GATED) — authored, unexecuted |
| 6 | `JobDetail.tsx` imports nothing from `modules/` | **PASS** — `JobAction` comes from `@jobcore/module-sdk`, the contract package |

## DEFERRED (Rule 15 R-A — externally gated)

| Item | Blocker |
|------|---------|
| Execute both `tests/*.test.sql` suites | No live Supabase project exists — `app/supabase/README.md` L44-45 |
| AC-5, AC-6, AC-7 and verification steps 2, 4, 5 | Same |
| State-machine unit suite (AC-1, step 1) | Not authored; carried forward from P2b.3 |
| Offline replay wiring (AC-4) | `replay` unwired; carried forward from P2-d |
| San Diego County community names | Awaiting Jeff's decision — ASSUMPTION 1, P2-a report |
| Supabase project + `apps/mobile/.env` | Awaiting Jeff |

Every gated item above is reported **OPEN, never PASSED.**

## Forward contracts

- `app/supabase/tests/` is the sole home for runnable RLS assertions; any new test file uses the
  double-dollar `do $$ … end $$;` form and wraps itself in `begin; … rollback;`.
- Both suites assert against `seed.sql` identifiers; changing a seeded uuid breaks them.
- Audit immutability is enforced by **policy absence** (no UPDATE, no DELETE policy on
  `audit_log`) — adding either policy silently breaks AC-5.3 / 5.4. This discharges P2c.2b.
- `app/supabase/README.md` § Apply order step 7 is the registration point for future test files.
- P2 closes here. **P3 does not start without Jeff's powwow.**

## Scope

No sdassemblypro.com PHP/backend, no GTM/GA4 changes, no review gating, zero PCI scope.
SQL + Markdown only — no TypeScript touched, so the `tsc --build` gate is not applicable.

---END BUILD REPORT---
