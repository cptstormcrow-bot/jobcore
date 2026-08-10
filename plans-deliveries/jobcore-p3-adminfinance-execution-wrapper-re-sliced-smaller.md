# Jobcore P3 — Admin/Finance — execution wrapper, re-sliced smaller

> Harness-assigned filename. Per memory `feedback-plan-naming-goal-slug.md` rename to
> `jobcore-p3-admin-finance-execution.md` on the first write out of Plan Mode.

## Context

The session opened on "let's go on P4." Reading disk showed P4 cannot start: **P3 is fully planned,
formally approved, and zero-executed.** Jeff redirected — *"Pause P4, run P3 first."*

Three artifacts already exist and are the substrate. Nothing here replaces them:

| Artifact | State |
|---|---|
| `E:\Jeff\.claude\plans\jobcore-p3-admin-finance.md` | Plan of record, approved 2026-08-01. 18882 bytes / 273 lines. Byte-identical (`diff -q` → IDENTICAL) to `Jobcore\plans-deliveries\jobcore-p3-adminfinance-module.md`. |
| `Jobcore\handoff\P3-SLICE-LEDGER.md` | 89 rows. **`TODO` = 75, `DONE` = 15** as of `b25c99e` — groups **P3-c and P3-d are terminal**, both landed by a parallel session. Cells filled for those 14 rows only. |
| `Jobcore\handoff\P3-CONTEXT-PROTOCOL.md` | Sizing rule, roll-in/roll-out order, close-out ritual, 5 spec corrections, carried decisions. |

**Execution has since started — in a parallel session, not this one, and it is moving fast.**
Re-measured **2026-08-05** (`git log --oneline -8`; `grep -c "^| P3" handoff/P3-SLICE-LEDGER.md`;
`grep -o "TODO" handoff/P3-SLICE-LEDGER.md | wc -l`): HEAD has moved `8e42c3e` → `f28dcaa` →
**`b25c99e`**, seven commits in two days —

```
b25c99e docs(handoff): correct falsified P3a.2 row - CHECK is introduced, not byte-matched
ca4debf docs(handoff): mark P3d.1-P3d.6 DONE at 705613f
24f2057 docs(handoff): mark P2d.4a headless half DONE at 2724914
2724914 test(admin-finance): P3d.7 headless replay assertion for P2d.4a
705613f feat(admin-finance): P3-d module wiring - ports, session seam, root screen, manifest
f28dcaa docs(handoff): mark P3-c rows DONE at ee4a4f8
ee4a4f8 feat(admin-finance): P3-c money core - commission, billable hours, bonus seam, rollup
```

Ledger rows still 89; `TODO` 89 → 81 → **75**, `DONE` 1 → 9 → **15**. **Groups P3-c *and* P3-d are both
terminal and cannot be re-sliced.** `b25c99e` also falsified one of this plan's own row texts (see
P3a.2b below). **Every state claim in this file is stale the moment the parallel session commits
again — re-measure before any write.**

The Rule 15 R-A blocker is **cleared** (ledger L21-26): hosted Supabase `vogkxkcceahtwyovpxsg` is live,
four migrations applied, seeds applied, both hosted RLS suites PASSED. `(EXEC-GATED)` now means
"needs the live DB to verify", not "blocked".

**This plan does one thing: it makes the slices smaller and then runs them.** Jeff's instruction was
*"slice it smaller, go."* The existing 89-row decomposition is sound but its rows are too fat to
survive a context boundary intact — several carry three or four DDL objects, or a whole screen, in one
row. The wrapper tightens the sizing rule, re-slices the 89 against it, resolves **four**
reconciliations the P4-framed answers left dangling, and adds the two groups the ledger is
missing. Net of the moot P3-c group and the new rows, the target is **~154**.

## Tightened sizing rule (replaces the rule in `P3-CONTEXT-PROTOCOL.md`)

A row qualifies only if **all six** hold. Changed numbers in **bold**.

1. **One primary file.** A second file rides only for a Rule 31 docs fix.
2. **One question in one sentence.**
3. Pre-read context **≤ ~80 lines** (was ~150).
4. Net new lines authored **≤ ~45** (was ~90). **Gated SQL tightens to ≤ 40 lines and ONE DDL
   object** — one table, one trigger, one function — not one DDL *family* (was ≤ 80 / one family).
5. **One exported symbol per pure-TS row** where the file exports more than one. Verification,
   commit, and report never share a row with authoring.
6. A group is **≤ 18 sub-rows**, ≤ 10 files, one code commit staged by explicit pathspec.

The **ID rule is unchanged and binding**: IDs decompose by suffix (`P3c.2` → `P3c.2a/b`). **No existing
ID is renamed or deleted.** Every new row is a suffix of an existing one, or lives in a new group
letter. That is why the re-slice is non-destructive — a reader of the old ledger can still find every
row they knew.

## Re-slice: 89 → ~154 rows

Two new groups bracket the existing fourteen. Splits below name the *rule that forced them*, not just
the outcome.

| Group | Was | Now | What forced the split |
|---|---:|---:|---|
| **P3-0** *(new, first)* | — | 4 | Re-slice the ledger itself + Rule 31 protocol ride + the `P3-0.4` test-script fix |
| P3-a `0005_money.sql` (EXEC-GATED) | 8 | **18** | Rule 4 — one DDL object per row |
| P3-b `0006` + 26-community reseed (EXEC-GATED) | 5 | **8** | Two seed files with *different* idempotency requirements |
| ~~P3-c money core, pure TS (UNGATED)~~ | 8 | **—** | **MOOT — group landed terminal `DONE` at `ee4a4f8`. A `DONE` row cannot be re-sliced.** |
| P3-d module shell | 6 | **12** | Ports file and manifest each carry two concerns + the session-prop seam (reconciliation 4) |
| P3-e lead inbox | 7 | **10** | Rule 5 + screen split render/behaviour |
| P3-f Qualify | 7 | **12** | Chokepoint file and its ESLint rule are separate commits-worth |
| P3-g assignment board | 8 | **12** | Two warning kinds, two transition edges |
| P3-h close-out | 6 | **9** | Transition call and the commissions write are distinct risks |
| P3-i price-sheet editor | 6 | **9** | `planPublish` carries version-assignment *and* supersede logic |
| P3-j Edge Function (EXEC-GATED) | 6 | **8** | Handler purity vs. the Deno serve shell |
| P3-k reimbursement + payout | 7 | **10** | Freeze-by-value and provenance-hash are separable |
| P3-l reporting | 6 | **9** | Grouping primitive vs. the three concrete groupers |
| P3-m `0005_money_rls.test.sql` (EXEC-GATED) | 5 | **9** | Three role probes, two trigger probes |
| P3-n phase close | 4 | **5** | AC sweep splits 1-5 / 6-10 |
| **P3-o** *(new, last SQL)* | — | **5** | The `jobs_select_org` RLS defect — see below |
| **P3-p** *(new — brand fidelity)* | — | **6** | Master Spec §2.7 has **zero coverage** in the 89 — see below |
| **Total** | **89** | **~154** | 152 − 7 (P3-c moot) + 6 (P3-p) + 1 (P3-0.4) + 2 (P3-d session prop) |

### New group P3-p — brand fidelity (Master Spec §2.7)

Master Spec §2 constraint 7 is binding and unrepresented in the ledger: *"copy the site's color scheme
and formatting. the look and feel. colors, fonts, readability and continuity remain identical to the
website sdassemblypro.com despite being an android or iOS app."* Every P3 screen is built on
`packages/ui` primitives + `tokens.ts`, so the tokens are the single chokepoint where that constraint
is either met or silently violated. Fixing it after nine screens ship is a repaint; fixing it before
P3-e is a token edit.

```
P3p.1  read-only capture of sdassemblypro.com palette + type stack (no write, no request to the site's backend — §2.1/§2.3 stay intact)
P3p.2  audit app\packages\ui\src\tokens.ts against that capture — table of drift, no edit
P3p.3  correct tokens.ts colors to the captured palette
P3p.4  correct tokens.ts typography (remember: lineHeight values are MULTIPLIERS, not pixels)
P3p.5  add AC-11 — every P3 screen composes only packages/ui primitives; grep proves zero raw StyleSheet colors in modules/admin-finance
P3p.6  verify + commit + report
```
Runs **before P3-e** (the first screen group). Read-only against the website; no PHP, no forms, no
tracking tags touched.

### Worked example — P3-a, the fattest group

Old `P3a.4` was *"`reimbursements` + `payout_batches` + `payout_lines` + the sum CHECK"* — three tables
and a constraint in one row. Under rule 4 that is four rows. The full P3-a expansion:

```
P3a.1a  three enums (publication_status, reimbursement_status, payout_batch_status)
P3a.1b  public.is_org_admin()  — security definer / stable / search_path=''
P3a.2a  price_sheets           + unique(org,version) + partial unique (org) where status='published'
P3a.2b  price_sheet_rates      + attach_timing text CHECK byte-matched to 0004_scheduling.sql:97
P3a.3a  compensation_policies
P3a.3b  commissions            + commissions_one_per_job_idx (job_id) where voided_at is null
P3a.4a  reimbursements         + amount > 0 CHECK   (AC-9 half)
P3a.4b  payout_batches
P3a.4c  payout_lines           + check(total = hours + commission + bonus + reimbursement)
P3a.5a  trigger enforce_rate_row_immutability  + price_sheets published→superseded-only trigger
P3a.5b  trigger enforce_commission_immutability            ← AC-6 in the database
P3a.5c  trigger enforce_payout_line_freeze
P3a.6   publish_price_sheet(uuid) RPC   — MUST land with 5a-5c or publishing is impossible
P3a.7a  RLS enable + policies, 4 price/comp tables, via is_org_admin()
P3a.7b  RLS enable + policies, 3 reimbursement/payout tables
P3a.7c  read-back proving 0005 adds ZERO policy to audit_log
P3a.8a  verify (every number ships its command, Rule 29-B)
P3a.8b  commit + Tier-A build report
```

Every other group follows the same shape; the ledger rewrite in **P3-0.1** is where all ~154 rows are
written out. This plan file does not enumerate them — the ledger is their home.

## Four reconciliations — decisions taken, each reversible in one row

Jeff's earlier three answers were given under a **P4 framing, before any P3 artifact had been read**.
Two of them collide with the approved P3 plan of record. Taking the P3 artifact's side, and flagging it:

**1. Test runner → keep `node:test`; drop the loader shim and raise `engines`. DECIDED by Jeff
2026-08-04, superseding the 2026-08-03 vitest override.** *(new row — see P3-0.4)*

The 2026-08-03 override was decided *before* the parallel session shipped `ee4a4f8`, which wired the
test script as `node --test`, not vitest. Re-measured on disk 2026-08-04
(`grep -n '"test"\|vitest\|node --test' app/package.json`; `grep -n -A3 '"engines"' app/package.json`;
`grep -n -A12 '"devDependencies"' app/package.json`):

- `app/package.json:15` — `"test": "node --experimental-strip-types --experimental-loader \"data:text/javascript,…\" --test modules/admin-finance/src/money/__assertions__/*.assert.ts"`. No `vitest` anywhere.
- `app/package.json:18-20` — `"engines": { "node": ">=20" }`.
- devDependencies = exactly 8 entries, **zero test-runner packages**. Installed Node is **v22.22.2**.

The real defect is not the runner choice, it is that **the declared engine floor cannot run the shipped
test script**: `--experimental-strip-types` landed in Node 22.6 *(knowledge-based claim, not
disk-verified — confirm before the row executes)*, so on Node 20, 21, or 22.0–22.5 the suite will not
start. Jeff's decision fixes that at the floor rather than by installing a runner:

- **Keep `node:test`.** The 207-line `rollup.assert.ts` keeps its `node:assert/strict` + `test()` idiom
  untouched — no `assert.equal` → `expect` rewrite, which was the vitest option's hidden cost.
- **Drop the data-URI `--experimental-loader`** from the test script; keep `--experimental-strip-types`.
- **Raise `engines.node` `">=20"` → `">=22.6"`** so the declared floor matches the feature the script needs.
- **`P3-CONTEXT-PROTOCOL.md`'s carried decision "No new dependencies" stays TRUE** — zero installs, so
  no Rule 31 amendment is owed for it.

**Placement.** Row `P3c.6` is terminal `DONE` and cannot be re-sliced, and the ID rule forbids renaming
it. This work therefore lands as **`P3-0.4`** — a new row in the pre-code group that already rewrites
the ledger and rides the protocol fix. It is a single-file `package.json` edit plus a doc ride, which is
exactly what P3-0 is for. (Rejected alternative: a new suffix row `P3c.9` inside a terminal group —
legal, but it re-opens a group the ledger already closed.)

**2. Field-tech plumbing → deferred with P4, not folded into P3.** *(no row)*
The earlier answer said *"Build it as a P4 prelude, labelled as P2 back-fill"* — jobs read path, SQLite
cache, snake→camel mapper, Supabase replay transport, `pending_uploads`, connectivity drain, plus
`expo-camera` / `expo-image-picker` / `expo-location` / `expo-file-system` / netinfo. With P4 paused, that
work has no home in the 89 rows and every one of those five deps is P4-facing. P3 stays props-in /
callbacks-out against `src/data/ports.ts`; its EXEC-GATED verification runs against the hosted DB
directly, which is exactly what the plan of record already specifies. Recorded in the phase build
report's DEFERRED table. *(Mitigating fact worth knowing: `@supabase/supabase-js ^2.45.0` is already a
dependency, so a ports-implementing adapter group would cost zero new deps if Jeff later wants P3 live
in the app rather than SQL-verified.)*

**3. The `jobs_select_org` RLS defect → new group P3-o.** *(5 rows)*
`app\supabase\0004_scheduling.sql:221-279` — `jobs_select_org` carries **no role predicate**. Postgres
permissive policies **OR** together and the seed has exactly one org, so a tech sees **every job in the
org**; `jobs_select_tech` (which joins through `job_assignments`, *not* `assigned_tech_id`) narrows
nothing. This has **no row among the 89** and it directly undermines P3's AC-10 and P4's AC-1.

```
P3o.1  0007_jobs_select_narrowing.sql — drop policy jobs_select_org; recreate role-narrowed
P3o.2  extend tests/0004_scheduling_rls.test.sql + .hosted twin: tech-sees-only-assigned probe
P3o.3  apply + run hosted via the SQL Editor            (EXEC-GATED)
P3o.4  verify — zero cross-tech rows, owner/admin unchanged
P3o.5  commit + report
```
Runs after P3-b, before P3-m.

**4. The session seam → a `session` prop passed down the module route. DECIDED by Jeff 2026-08-04.**
*(+2 rows in P3-d)*
Module packages have **no sanctioned way to read the current session**, and every P3 screen needs
`role` and `orgId`. Measured on disk: `useSession()` lives in `apps\mobile\src\lib\session.tsx` and is
not exported to module packages; `Ctx` in `packages\core\src\index.ts` carries nine fields and **none**
of them is `userId` or `orgId`; `app\apps\mobile\app\m\[moduleId].tsx:52` mounts `routes[0]` with **no
props at all**.

The decision: **P3-d adds a `ModuleRouteProps { session }` shape in `packages\module-sdk`, and
`m/[moduleId].tsx` passes it to `routes[0]`.** Costs ~2 extra rows in P3-d and one edit to a file
outside the module (`apps/mobile`), but keeps modules pure props-in and **does not touch
`packages/core`**. AC-3's *"exactly one hit for `admin-finance` in `apps/mobile`"* stays true because
the prop is **generic** — `m/[moduleId].tsx` never names a module.

Rejected: a `getSession()` accessor exported from `module-sdk` (hidden global state, a second
initialization order to get wrong, and it widens a contract P1 deliberately kept minimal); and
deferring entirely (P3 screens would declare `role`/`orgId` props that nothing wires).

## Files this touches

**Written in P3-0 (before any code):**
- `Jobcore\handoff\P3-SLICE-LEDGER.md` — 89 → ~154 rows, suffix-decomposed, all `TODO`
- `Jobcore\handoff\P3-CONTEXT-PROTOCOL.md` — tightened sizing rule; Rule 31 ride

**Then, per group** (all paths take the protocol's mandatory `app/` prefix — spec correction #2):
- `Jobcore\app\supabase\0005_money.sql`, `0006_job_service_area.sql`, `0007_jobs_select_narrowing.sql`
- `Jobcore\app\supabase\seed.sql` + `seed.hosted.sql` + `README.md`
- `Jobcore\app\supabase\tests\0005_money_rls.test.sql` (+ `.hosted` twin)
- `Jobcore\app\supabase\functions\price-sheet-current\` — **does not exist yet**; P3j.1 is the layout precedent
- `Jobcore\app\modules\admin-finance\src\` — `money/` (6 files) and `__assertions__/` **now exist** as of `ee4a4f8`; `index.ts` is still the P1 stub, and `domain/`, `data/`, `flows/`, `screens/`, `components/`, `reporting/` are still to be created
- `Jobcore\app\packages\module-sdk\src\index.ts` — declares `ModuleRouteProps { session }` (reconciliation 4); the SDK gains a type, no behaviour
- `Jobcore\app\apps\mobile\app\m\[moduleId].tsx` — passes `session` into `routes[0]`; stays module-agnostic so AC-3's one-hit grep still holds
- `Jobcore\app\package.json` — the `test` script + `engines` floor (**P3-0.4**) and the ESLint `no-restricted-imports` entry (P3f.1b)

## Reuse — nothing here gets rewritten

| Existing | Path | Use |
|---|---|---|
| `applyTransition` / `canTransition` | `app\packages\core\src\state-machine.ts:202` / `:172` | The **only** legal status write. Module calls it from exactly one file, `domain/transition.ts`. |
| `PreconditionResult` reason strings | same file | Surfaced verbatim by `closeOutBlockers` — never paraphrased. |
| `Job`, `Role`, `JobStatus` | `app\packages\core\src\index.ts` | `Readonly<Job>` inside the module (AC-4 mechanism 4). |
| `JobcoreModule` / `registerModule` | `app\packages\module-sdk\src\index.ts` | Manifest fill only — the SDK is not extended. |
| `current_org_id()` | `app\supabase\0001_foundation.sql` | Every 0005 policy composes with it. |
| `packages/ui` primitives | `app\packages\ui\src\` | Button · Card · EmptyState · ErrorState · ListItem · LoadingState + `tokens.ts`. **`lineHeight` values are multipliers, not pixels.** |
| `@supabase/supabase-js ^2.45.0` | already in deps | Edge Function + repos. No install. |

**Traps carried forward, do not re-learn:** only `routes[0]` ever renders
(`app\apps\mobile\app\m\[moduleId].tsx:52`) — the module contributes ONE route with an internal
switcher · `readSyncProbe` fails closed on a Promise, so every `ctx` probe must be **synchronous** ·
`audit_log` is immutable **by policy absence** — adding an UPDATE or DELETE policy silently breaks it ·
`jobs.requested_window` is untyped `text` with no format constraint, so an unparseable value counts as
**unknown, never a hit or a miss** · migrations are **flat** under `app\supabase\`, next number `0005`,
**not idempotent** by convention, no rollback convention · the grep trap: `status *=` also matches
`status ===`, which is why `module-session.ts` returns a pre-narrowed session.

## Binding constraints (restated — Master Spec §2 / README)

Website backend out of scope, permanently — no PHP, no forms, no database on sdassemblypro.com ·
analytics stays Google, never touch `GTM-TNZSSDC` / `G-93R89491PL` · zero PCI scope, no card data
anywhere · no review gating · **payout feeds review, never the reverse** · timestamps are payroll-grade
audit rows, never editable telemetry · **`NullBonusRule` returns zero with a reason string and no
formula is invented** — README "Before P3 ships" is explicit that a guessed bonus formula is a wage
dispute waiting to happen.

**Do NOT build** (from `03-P3-admin-finance.md`): any tech-facing screen (P4) · payment capture, QR
handoff, reviews (P5) · social posting or review library (P6) · real intake adapters or push (P7).

## Verification

**Ungated, runs every group close:** `npm run typecheck` exit 0 · `npm run lint` clean.

**Ungated assertions** (**`node:test`**, already shipped at `ee4a4f8`; the script is de-shimmed and the
`engines` floor raised at **P3-0.4** — `npm run test` → `node --experimental-strip-types --test
modules/admin-finance/src/money/__assertions__/*.assert.ts`, no `--experimental-loader`):
- **AC-8** — 2 jobs (2.0h + 1.5h), base 25, commissions 40 + 60, receipt 18.75, `NullBonusRule` → **total 206.25**, itemized as a breakdown, never one number
- **AC-9** — the same roll-up with and without the receipt is byte-identical on every commission line
- **AC-6 pure half** — v1 rate 100 → line; publish v2 rate 200; recompute from the snapshot id → identical to the cent
- **AC-1** — `classifyLead(heroLead) === 'needs_info'`, `missingFields` deep-equals `['preferredDate','address']`
- **AC-3 static half** — `grep -rn "admin-finance" app/apps/mobile/app app/apps/mobile/src` returns **exactly one** hit: `modules.ts:12`
- **AC-4** — `grep -rn "status *=" app/modules/admin-finance/src` returns **ZERO raw lines** (not zero-after-adjudication)
- **verify-8** — `grep -rn "sdassemblypro\|GTM-\|G-93R" app/modules/admin-finance` → no matches

**EXEC-GATED** — hosted Supabase SQL Editor is the **sole apply channel** (`supabase` CLI, `psql`, and
docker are all absent on this machine); a pasted script runs as **one transaction**:
- `0005_money_rls.test.sql` in full — fixtures planted under `reset role` **first**, then owner-sees-N on all 7 tables (the falsifiability gate), then zero-row probes for **tech and sales** plus point-lookup-by-PK variants
- trigger-denial probes run under `reset role` as well as authenticated owner — passing under `reset role` proves the guarantee is a **trigger**, not RLS
- AC-6 captures **`amount::text`** — text, not numeric, because `100.00 = 100.0` is TRUE and would hide scale drift
- `audit_log` policy-count canary: `select count(*) from pg_policies where tablename='audit_log'` = exactly **2**, zero UPDATE/DELETE
- AC-7 — `curl` the Edge Function before and after publish. Deploy **requires `--no-verify-jwt`**; a default-deployed function rejects anonymous callers and silently fails AC-7
- AC-10 — `select * from price_sheets` as a tech → zero rows, by direct query not by UI
- **P3-o** — a tech's `select count(*) from jobs` returns only their assignments

Gated items are reported **OPEN, never PASSED**. Hosted user UUIDs are real and `order by email` returns
them **alphabetically, not in placeholder order** — positional substitution silently swaps identities.

## Execution discipline

Rule 38 rolling slices: one hound per row, findings to a scratchpad crib, one-line return, evict before
the next dispatch. Rule 30: every write goes to Nestor / Spot / Marmanduke — no main-session
`Edit`/`Write` above 200 chars. Rule 33: one hound = one file = one closed-form question.

Per-group close-out ritual, in order (unchanged from the protocol): verification row alone, every number
shipping its command → code commit, group files only, explicit pathspec, `git diff --cached --name-only`
echoed first, no ledger edit inside it → same-turn disk read of every artifact about to be called DONE →
ledger commit flipping `TODO` → `DONE <hash>` naming that hash **and filling `Context out` in the same
commit** → Tier-A build report at `.claude\build-reports\jobcore-p3-admin-finance\` carrying
`Forward contracts:` (Rule 25) and `## Deviations / Defects` (Rule 37), with a DEFERRED table listing
every gated item as OPEN → name the drop set → yield.

**All commits go to the nested repo `E:\Jeff\Codespace\SDAssemblyPros\Jobcore`, never the admin repo.
`plans-deliveries\` is untracked by design — never stage it.**

Build reports are delivered by copying to `E:\Jeff\Desktop\`; the custody copy under
`.claude\build-reports\` is the permanent one.
