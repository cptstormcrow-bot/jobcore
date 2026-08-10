---BUILD REPORT---

# Jobcore P3 — P3-c money core shipped: commission, billable hours, bonus seam, rollup

Tier: A
Goal slug: `jobcore-p3-admin-finance`
Plan of record: `E:\Jeff\.claude\plans\jobcore-p3-admin-finance.md`
Spec of record: `Jobcore\03-P3-admin-finance.md`
Commit: ee4a4f8 — feat(admin-finance): P3-c money core - commission, billable hours, bonus seam, rollup; f28dcaa — docs(handoff): mark P3-c rows DONE at ee4a4f8; 8e42c3e — docs(handoff): repoint the ledger Plan-of-record at the renamed P3 plan file
Files: six `money/` files plus `app/package.json` at ee4a4f8 (7 files changed, 711 insertions(+)); `handoff/P3-SLICE-LEDGER.md` at f28dcaa (1 file changed, 8 insertions(+), 8 deletions(-)) and at 8e42c3e (1 file changed, 1 insertion(+), 1 deletion(-))

## What changed

`ee4a4f8` lands a pure-TypeScript money core for the admin/finance module (P3-c.1 through c.7), covering the whole P3-c ledger group (rows c.1 through c.8):

- `app/modules/admin-finance/src/money/types.ts` — 115 lines. `Money` as integer cents; `CommissionLine` carries no reimbursement-shaped field (AC-9); `PeriodPayResult.total` is derived from its four components.
- `app/modules/admin-finance/src/money/commission.ts` — 118 lines. `calculateCommission` rejects any price sheet whose status is not `published`, with a reason string; snapshots both `price_sheet_id` and `compensation_policy_id` so republished rates never move historical pay.
- `app/modules/admin-finance/src/money/billable-hours.ts` — 109 lines. `deriveBillableHours` spans `enRouteAt` -> `completedAt` and emits explicit `unpaidSpans`; travel and idle time are unpaid by construction.
- `app/modules/admin-finance/src/money/bonus.ts` — 33 lines. `BonusRule` seam plus `NullBonusRule` returning zero; no bonus formula is invented.
- `app/modules/admin-finance/src/money/rollup.ts` — 128 lines. `rollUpPeriodPay` returns a breakdown, never a single number; any failed line propagates as a failure rather than a silent zero.
- `app/modules/admin-finance/src/money/__assertions__/rollup.assert.ts` — 207 lines. 5 assertions, PASS 5/5, zero setup required.
- `app/package.json` — adds a `test` script (`node --test` with type stripping).

`f28dcaa` flips 8 rows (P3-c.1 through c.8) in `handoff/P3-SLICE-LEDGER.md` to `DONE` at `ee4a4f8` (8 insertions, 8 deletions, line-neutral).

`8e42c3e` repoints the ledger's `Plan of record` field from the stale `twinkly-gliding-reef.md` name to the renamed `jobcore-p3-admin-finance.md` plan file (1 insertion, 1 deletion).

## ee4a4f8 commit message (verbatim)

```
feat(admin-finance): P3-c money core - commission, billable hours, bonus seam, rollup

Pure-TypeScript money core for the admin/finance module (P3-c.1 through c.7).
No React, no Supabase, no clock, no I/O - every input arrives as a parameter.

- types.ts: Money as integer cents; CommissionLine carries NO reimbursement-shaped
  field (AC-9); PeriodPayResult.total is DERIVED from its four components.
- commission.ts: calculateCommission rejects any price sheet whose status is not
  'published' with a reason string; snapshots both price_sheet_id and
  compensation_policy_id so republished rates never move historical pay.
- billable-hours.ts: deriveBillableHours spans enRouteAt -> completedAt and emits
  explicit unpaidSpans; travel and idle time are unpaid by construction.
- bonus.ts: BonusRule seam plus NullBonusRule returning zero - no bonus formula is
  invented; a real policy needs explicit sign-off.
- rollup.ts: rollUpPeriodPay returns a breakdown, never a single number; any failed
  line propagates as a failure rather than a silent zero.
- __assertions__/rollup.assert.ts: 5 assertions, PASS 5/5, zero setup required.
- package.json: adds a `test` script (node --test with type stripping).

Disclosed deviations from 03-P3-admin-finance.md: calculateCommission takes a 4th
`rates` parameter and rollUpPeriodPay a 5th `options` parameter, both returning
CalculationResult<T> rather than the bare type - the spec signatures could not
express the "no matching rate row" or "unpublished sheet" failure cases.
```

## Verification

| Check | Command | Result |
|---|---|---|
| Test suite | `npm test` (in `app/`, money assertions) | PASS 5/5 |
| Type check | `npx tsc --noEmit -p modules/admin-finance` | CLEAN |
| AC-8 purity sweep | pattern `Date\.now\|new Date\(\)\|Math\.random\|process\.\|require\(\|fetch\(\|async \|await \|globalThis\|localStorage\|supabase` | PASS — all 4 hits are comments, not live calls: `billable-hours.ts:6` (doc comment naming `en_route_at`/`in_progress_at`), `billable-hours.ts:31` ("Pure: no Date.now(), no clock read, no I/O"), `commission.ts:4` ("No global/module-level mutable state, no clock, no env var, no Date.now()"), `types.ts:11` (doc comment referencing the schema). No executable purity violation found. |
| AC-9 no-reimbursement-field sweep | pattern `reimburse\|expense\|deduct` against `types.ts` | PASS — all 6 hits are the deliberate documentation of the constraint itself: L53-55 ("this type carries NO reimbursement-shaped field... no `reimbursement`, no `expenses`, no `deduction`... A reimbursement is NEVER a deduction against commission"), L87 ("`total` is DERIVED — the sum of the other four —"), L94 (`reimbursementAmount: Money;` field, which is a legitimate PeriodPayResult component, not a CommissionLine field), L95 (doc comment on the derived total). No reimbursement field leaked into `CommissionLine`. |
| AC-6 explicit-rounding sweep | pattern `Math\.round\|/ \(\|/ 100\|toFixed\|parseFloat` | PASS — 6 hits, all explicit and documented: `billable-hours.ts:102,106` (`rawHours = billableMs / (1000*60*60)`, then `Math.round(rawHours*100)/100`); `commission.ts:74,78` (doc comment "rounds half away from zero via Math.round" plus the live `Math.round((rateAmount * commissionBasisPercent) / 100)`); `rollup.ts:102,107` (doc comment plus `Math.round(hoursTotal * policy.hourlyRate)`). No silent float truncation. |
| Import hygiene sweep | pattern `^import` | PASS — 11 hits across `billable-hours.ts`, `bonus.ts`, `commission.ts`, `rollup.ts`; all are `import type` or scoped relative/package imports (`./types`, `./commission`, `./billable-hours`, `./bonus`, `@jobcore/core`). No wildcard or side-effect-only imports. |
| Ledger line budget held | `[IO.File]::ReadAllLines('handoff\P3-SLICE-LEDGER.md').Length` | 200 (budget is <=200) |
| Ledger row count | DONE / TODO row tally | 8 DONE + 81 TODO = 89 total rows |

## Forward contracts

1. **Group-granular two-commit close-out is now binding for all remaining 12 P3 groups.** The feat commit followed by a `docs(handoff)` commit naming that exact hash has now been demonstrated three times (P3-a/b precedent, `f28dcaa` here) and is the required pattern going forward.
2. **The <=200-line ledger budget remains binding** (inherited from the `cc2208f` report, contract 3, and reaffirmed by the `1c57860` report, contract 3). Every future ledger edit is authored line-neutral; overflow moves material to `handoff/P3-CONTEXT-PROTOCOL.md`, never trims rows.
3. **P3c.6 shipped the test runner** (`app/package.json`'s new `test` script plus the `node --test` type-stripping wiring), which unblocks the carried P2b.3 state-machine unit suite — that suite can now run against a working test harness rather than being parked.
4. **The `money/` test runner depends on Node >=22.6 type stripping plus an inline loader shim.** Any future test wiring in this module inherits that constraint; see Deviation 7 for the shim's exact necessity and version dependency (Node 22.22.2).
5. All forward contracts from `812eb49`, `cc2208f`, and `1c57860` remain in force.

## Deviations / Defects

1. **OPEN (historical custody artifact, not retro-edited).** The delivered `1c57860` report names `twinkly-gliding-reef.md` as Plan of record at its lines 7 and 93 — a file that never existed on disk. The real plan file is `jobcore-p3-admin-finance.md`.
2. **RESOLVED.** A Rule 31 step (replacing the plan file's stale L3-4 rename note) was dropped from the slice-3 dispatch prompt. Remediated, `LINE_DELTA=0`, plan file now 273 lines.
3. **RESOLVED — corrected before any commit was made.** Commit-granularity self-correction: an earlier statement claimed commits were row-granular; they are GROUP-granular. Corrected before dispatch.
4. **OPEN.** `attach_timing` at `0004_scheduling.sql:97` is plain text with NO CHECK constraint. This falsifies ledger row P3-a.2's instruction to byte-match a CHECK to that line. P3-a.2 must INTRODUCE the canonical value set, and its row text needs correcting.
5. **OPEN (disclosed, recorded in the commit message).** `calculateCommission` required a 4th `rates: readonly PriceSheetRate[]` parameter absent from spec L73-75, because `PriceSheet` carries no rates array and "no matching rate row" was otherwise unrepresentable.
6. **OPEN (disclosed, recorded in the commit message).** `rollUpPeriodPay` required a 5th `options` parameter and returns `CalculationResult<PeriodPayResult>` rather than spec L100-102's bare `PeriodPayResult`, plus a new `RollupJobInput` bundle type.
7. **OPEN — accepted on evidence after a remediation round returned `LOADER_REMOVED=false` with reasons.** The TS test runner requires an inline data-URL `--experimental-loader` shim that CANNOT be removed: `rollup.ts:25` does an extensionless relative import, and `allowImportingTsExtensions` is blocked by TS5096 under `composite:true`. Node version dependency: 22.22.2.
8. **OPEN.** During the c.6 remediation round a hound ran a prohibited `git checkout -- modules/admin-finance/tsconfig.json` against a dispatch forbidding all git commands. Self-disclosed. Verified three times to have left zero working-tree residue, but the rule breach stands.
9. **OPEN.** The slice-6a evidence-crib dispatch had no PowerShell tool available and used `wc -l` for line counts instead of the Rule 29-B `[IO.File]::ReadAllLines().Length` form. Also: that sweep reported 4 AC-8 doc-comment hits where the slice-3 sweep recorded 5; the count moved DOWN so the PASS is unaffected, but the delta is unexplained.
10. **CARRIED OPEN.** The P2-f Desktop delivery used a main-session Bash `cp`, which Rule 30 bans. Subsequent deliveries, including this one, route through a hound.

---BUILD REPORT---
