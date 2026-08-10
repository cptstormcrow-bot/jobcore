---BUILD REPORT---

# P2-c — Dual-clock skew detection and insert-only audit rows

- Date: 2026-07-28
- Tier: A
- Slice: P2c.1 · P2c.2a · P2c.2b · P2c.2c · P2c.3a · P2c.3b · P2c.3c
- Ledger: `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\handoff\P2-SLICE-LEDGER.md` (123 lines, rows L70–L76)
- Plan of record: `E:\Jeff\.claude\plans\toasty-puzzling-kahn.md`
- Commit: `a7650b3` — feat(P2-c): dual-clock skew detection and insert-only audit rows
- Repo: `E:\Jeff\Codespace\SDAssemblyPros\Jobcore` (nested; NEVER committed from the admin repo)

## Forward contracts

1. `evaluateSkew` compares with a strict `>` — a skew exactly equal to `skewThresholdMs` is NOT flagged. Any later caller or test that assumes `>=` is wrong.
2. `evaluateSkew` fails loudly-but-safely on an unparseable date: it returns `{ skewMs: NaN, skewed: true }`. Downstream code must not treat `skewed: true` as proof a real skew was measured — check `Number.isNaN(skewMs)` first.
3. Audit fields (`from_state`, `to_state`, `occurred_at`, `synced_at`, skew flag) ride inside the already-shipped `metadata jsonb not null default '{}'` column of `audit_log`. No migration adds dedicated columns. A later slice that wants them promoted to real columns owes a new migration.
4. Audit rows are INSERT-ONLY by RLS policy omission (`0001_foundation.sql`: RLS enabled L97; exactly two policies — select L165–166, insert L170–171). No UPDATE or DELETE policy exists. Nothing downstream may attempt to UPDATE an audit row.
5. The `Ctx` seams `serverNow?`, `clockConfig?`, and `writeAudit?` are all OPTIONAL. Existing callers keep compiling. A later slice must not make any of them required without sweeping every construction site.
6. P2 is COMPLETE only at ledger row P2f.2b. **At the P2→P3 boundary the session STOPS for a powwow with Jeff before any P3 work begins** (Jeff instruction, 2026-07-28: "approval goes only for P2 operations. When P3 starts up, I want a powow").

## What changed

8 files, 428 insertions / 28 deletions.

| File | Status | Role |
|---|---|---|
| `app/packages/core/src/clocks.ts` | NEW | `ClockConfig`, `DEFAULT_CLOCK_CONFIG` (5 min = 300000 ms), `evaluateSkew` |
| `app/packages/core/src/index.ts` | M | optional `writeAudit?` / `serverNow?` / `clockConfig?` seams on `Ctx`; barrel re-export |
| `app/packages/core/src/state-machine.ts` | M | imports `evaluateSkew`, replaces `void clockPair;`, emits exactly one insert-only audit row per transition |
| `app/supabase/0001_foundation.sql` | M | foundation schema touch-up |
| `app/supabase/0003_invitations_and_signup.sql` | NEW | invitations + signup |
| `app/apps/mobile/src/lib/supabase.ts` | M | client wiring |
| `app/.gitignore` | M | ignore hygiene |
| `02-P2-scheduling-core.md` | M | Rule 31 docs-ride: L19 stale `0002_scheduling.sql` pointer corrected to `0004_scheduling.sql` |

## Verification

### Compile (Rule 29 — same-turn disk read)

```powershell
Set-Location 'E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\packages\core'
npx tsc --build --force
"EXITCODE=$LASTEXITCODE"
```
```
EXITCODE=0
```

`dist/` is gitignored; `git status --porcelain` was byte-identical before and after the forced rebuild, proving the rebuild introduced no commit churn.

### P2c.3a — 45-minute clock-skew check (AC `02-P2-scheduling-core.md:120`)

Run against the COMPILED artifact (`dist/clocks.js`, 1422 bytes, SHA256 `1532D2B6C94090AFDAC7A57956651401CDFE778070AAB21D13B15B6377FD14F3`) via a byte-identical `.mjs` sibling in the scratchpad — required because `packages/core` emits ESM under `"module": "ESNext"` with no `"type"` field in its `package.json`.

```powershell
node "<SCRATCH>\skew-check.mjs"
"EXITCODE=$LASTEXITCODE"
```
```
PASS  A threshold is 5 min  actual=300000  expected=300000
PASS  B 45min ahead  skewMs  actual=2700000  expected=2700000
PASS  B 45min ahead  skewed  actual=true  expected=true
PASS  C 45min behind  skewMs  actual=2700000  expected=2700000
PASS  C 45min behind  skewed  actual=true  expected=true
PASS  D at-threshold skewMs  actual=300000  expected=300000
PASS  D at-threshold skewed  actual=false  expected=false
PASS  E over-threshold skewed  actual=true  expected=true
PASS  F bad input  skewMs is NaN  actual=true  expected=true
PASS  F bad input  skewed  actual=true  expected=true
PASS  G custom 60min threshold skewed  actual=false  expected=false
RESULT: ALL PASS
EXITCODE=0
```

Rule 14 teardown: both scratchpad files (`skew-check.mjs`, `clocks.mjs`) deleted; `Get-ChildItem -LiteralPath <SCRATCH> -Force` returned 0 entries in the MAIN session — confirmed, not assumed.

## DEFERRED (Rule 15 R-A — externally gated, reported OPEN, never PASSED)

| Item | Row | Status | Gate |
|---|---|---|---|
| `select count(*) from audit_log where entity_id = '<job>'` returns exactly one row per transition | P2c.3b | **OPEN** | No live Supabase project exists |
| Every SQL-side AC in `0001_foundation.sql` / `0003_invitations_and_signup.sql` | P2-c | **OPEN** | Same |
| `occurred_at` survives sync unchanged; only `synced_at` is server-assigned (`02-P2-scheduling-core.md:110`) | P2-c | **OPEN** | Same |
| Three-offline-transition replay with `occurred_at` intact (`:119`) | P2-c | **OPEN** | Same |

Blocked on Jeff: create the Supabase project and populate `apps/mobile/.env` from `.env.example`. Until then every SQL-side AC is reported OPEN.

## ASSUMPTIONS

1. **`metadata jsonb` carriage.** `audit_log` as shipped (`0001_foundation.sql` L45–56) has eight columns and none of them are `from_state`/`to_state`/`occurred_at`/`synced_at`. `0004_scheduling.sql` was scanned end-to-end (279 lines, ZERO hits for `audit|occurred_at|synced_at|from_state|to_state`), proving no later migration adds backing columns. Those fields therefore ride inside the existing `metadata jsonb not null default '{}'`. Rejected alternative: a new `0005_*.sql` adding real columns — deferred so P2-c ships with a zero-migration footprint.

## Open defects carried

| # | Defect | State |
|---|---|---|
| 3 | Four admin artifacts sat untracked at the Jobcore repo root (`2026-07-27_p2a-…md`, `2026-07-27_p2b-…md`, `2026-07-27_s5-…md`, `refactor-the-p2-slice-ledger-into-smaller-slices.md`). Hash-compared against the admin copies: all four byte-identical duplicates (the plan file matched on FULL SHA-256 `E5A0C6DC…B38C`). Excluded from `a7650b3` and deleted from the Jobcore tree; custody preserved in `.claude\`. | RESOLVED |
| 4 | P2-b report omits two honest-reporting items: the ledger edit landed in a follow-up commit, and its `- Commit:` line (L7) does not name `f823842`. | OPEN |
| 5 | P2-b report L12/L13/L27 measurably falsified by P2-c: `index.ts` recorded 101 (now 166); `state-machine.ts` recorded 211 (now 252); "Exactly one import, and it is type-only" is now THREE imports, one a VALUE import of `evaluateSkew`. The "zero imports outside `packages/core/src`" contract STILL HOLDS. | OPEN — historical record, corrected here |
| 6 | 2026-07-27 21:16 checkpoint Rule 29 table (L55–57) records stale `index.ts` 113 / `state-machine.ts` 221. | OPEN — historical record |
| 8 | `INDEX.md` L60 and the 21:16 checkpoint L42 still record "Owed: context clear at the S5.8 boundary" — discharged on the facts, never corrected at either locus. | OPEN |
| 9 | `INDEX.md` rendering defect (rows at L60–L63 sit below the prose notes, outside the markdown table) plus a multi-ACTIVE defect (L17 and L63 both `ACTIVE`). Both rows belong to FOREIGN sessions; reclassifying another session's anchor is not this session's call. | OPEN — recorded, not silently fixed |
| 11 | `/checkpoint` confirmations did not float the full absolute path. Memory `feedback-checkpoint-float-full-path.md` written. | RESOLVED |

## Measurement provenance (Rule 29-B)

- Line counts: `[IO.File]::ReadAllLines('<path>').Length`. `Measure-Object -Line` is banned (skips blank lines).
- File sizes / hashes: `Get-ChildItem … | Select-Object Name, Length` and `Get-FileHash -Algorithm SHA256`.
- Diff stat: `git -C <repo> commit` output — `8 files changed, 428 insertions(+), 28 deletions(-)`.
- Commit surface: `git -C <repo> diff --cached --name-status` and `git -C <repo> status --porcelain`.
- **Caveat:** a prior record claimed the ledger holds "30 rows after refactor" while the sections as read contain 48. Neither figure was produced by an approved Rule 29-B command; both are recorded as unverified.
- **Standing caution:** subagent numeric claims are not trusted. Nestor previously returned two byte figures (1911 / 2445) that main-session measurement disproved (actual 1422 / 2484) while its byte-identity verdict was correct. Every hound-reported count is re-measured in the main session.

## Next

P2-d (offline queue) → P2-e (Calendar + Job Detail) → P2-f (RLS assertion suite + phase close). **P2 closes at P2f.2b, and the session stops there for the P2→P3 powwow.**

---END BUILD REPORT---
