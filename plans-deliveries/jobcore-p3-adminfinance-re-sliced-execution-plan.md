---
classification: plans/e-jeff-codespace-sdassemblypros-jobcore-mellow-pretzel
comments: "Jobcore P3 (admin/finance) — re-sliced execution plan"
origin: .claude/plans/e-jeff-codespace-sdassemblypros-jobcore-mellow-pretzel.md
tags: [plans, e-jeff-codespace-sdassemblypros-jobcore-mellow-pretzel]
---
# Jobcore P3 (admin/finance) — re-sliced execution plan

## Context

The session opened on *"Lets go on P4 of the app."* Disk reading showed **P3 had never shipped
code**, and the README's own rule is *"One phase per session, always"* with P3 as P4's declared
prerequisite. Jeff chose **"Pause P4, run P3 first."** So the deliverable became a P3 execution
plan; P4 restarts in a fresh session once admin/finance exists.

**This plan does one thing: it makes the slices smaller and then runs them.** Jeff's instruction was
*"slice it smaller, go,"* then, a second time, *"slice it out smaller so it fits."* The existing
89-row decomposition in `Jobcore\handoff\P3-SLICE-LEDGER.md` is sound but its rows are too fat to
survive a context boundary intact — several carry three or four DDL objects, or a whole screen, in
one row. This wrapper tightens the sizing rule, re-slices the 89 against it, resolves four
reconciliations the P4-framed answers left dangling, and adds the two groups the ledger is missing.
Net of the moot P3-c and P3-d groups and the new rows, the target is **~152**.

**Two durability notes.** (1) A parallel session has shipped P3-c and P3-d while this plan was being
written — every state claim here is stale the moment it commits again; re-measure before any write.
(2) That same parallel session deleted `.claude\plans\` wholesale, destroying an earlier copy of this
file (it was untracked, so git holds nothing). This file was re-authored from scratch. **On approval,
the Desktop copy (Rule 12) and an early commit are durability measures, not just delivery.**

---

## Current state (re-measured 2026-08-05)

Command, in `E:\Jeff\Codespace\SDAssemblyPros\Jobcore` (Rule 29-B provenance):

```
git log --oneline -8 && grep -c "^| P3" handoff/P3-SLICE-LEDGER.md
&& grep -o "TODO" handoff/P3-SLICE-LEDGER.md | wc -l
&& grep -o "DONE" handoff/P3-SLICE-LEDGER.md | wc -l
```

```
b25c99e docs(handoff): correct falsified P3a.2 row - CHECK is introduced, not byte-matched
ca4debf docs(handoff): mark P3d.1-P3d.6 DONE at 705613f
24f2057 docs(handoff): mark P2d.4a headless half DONE at 2724914
2724914 test(admin-finance): P3d.7 headless replay assertion for P2d.4a
705613f feat(admin-finance): P3-d module wiring - ports, session seam, root screen, manifest
f28dcaa docs(handoff): mark P3-c rows DONE at ee4a4f8
ee4a4f8 feat(admin-finance): P3-c money core - commission, billable hours, bonus seam, rollup
8e42c3e docs(handoff): repoint the ledger Plan-of-record at the renamed P3 plan file
```

| Measurement | Baseline | 2026-08-04 | **2026-08-05** |
|---|---|---|---|
| HEAD | `8e42c3e` | `f28dcaa` | **`b25c99e`** |
| ledger rows | 89 | 89 | **89** |
| `TODO` | 89 | 81 | **75** |
| `DONE` | 1 | 9 | **15** |

**Groups P3-c *and* P3-d are terminal** (`DONE <hash>`) and cannot be re-sliced. `b25c99e` also
falsified one of this plan's own row texts — see `P3a.2b` below.

---

## The tighter sizing rule

1. **One primary file.** A second file rides only for a Rule 31 docs fix.
2. **One question in one sentence.**
3. Pre-read context **≤ ~80 lines** (was ~150).
4. Net new lines authored **≤ ~45** (was ~90). **Gated SQL tightens to ≤ 40 lines and ONE DDL
   object** — one table, one trigger, one function — not one DDL *family* (was ≤ 80 / one family).
5. **One exported symbol per pure-TS row** where the file exports more than one. Verification,
   commit, and report never share a row with authoring.
6. **A *batch* is ≤ 9 sub-rows**, ≤ 6 files, **one code commit** staged by explicit pathspec. A group
   may run as **N sequential batches** (`P3-a batch 1`, `batch 2`, …), each closing with its own
   verification row and its own commit row. **Group letters and row IDs are untouched** — a batch is
   a run boundary, not an identifier — so the ID rule below still holds. This replaces the former
   *"a group is ≤ 18 sub-rows"* ceiling, which was the binding constraint stopping `P3-a` (already at
   exactly 18) from being sliced any smaller.

Rules **3, 4 and 5 are unchanged** — Jeff's instruction was *"keep them as written."* Only rule 6
moves, and it moves **smaller**.

**ID rule (from `P3-CONTEXT-PROTOCOL.md`, unchanged):** IDs decompose by suffix (`P3c.2` →
`P3c.2a/b`). **No existing ID is renamed or deleted.** Every new row is a suffix of an existing one,
or lives in a new group letter. That is why the re-slice is non-destructive — a reader of the old
ledger can still find every row they knew.

---

## Re-slice: 89 → ~152 rows

| Group | old | new | note |
|---|---|---|---|
| P3-0 wrapper (new) | — | 4 | ledger rewrite, protocol amendment, runner, engines |
| P3-a `0005_money.sql` (EXEC-GATED) | 8 | **24** | Rule 4 — strictly one DDL object per row; runs as 3 batches |
| P3-b RLS tests / hosted twins | 5 | 8 | |
| P3-c money core | 8 | **—** | MOOT — group landed terminal `DONE` at `ee4a4f8` |
| P3-d module shell | 6 | **—** | MOOT — group landed terminal `DONE` at `705613f` |
| P3-e lead inbox | 7 | 10 | 2 batches |
| P3-f qualify flow | 7 | 12 | 2 batches |
| P3-g assignment board | 8 | 12 | 2 batches |
| P3-h close-out | 6 | 9 | 1 batch |
| P3-i price-sheet editor | 6 | 9 | 1 batch |
| P3-j publish + Edge Function | 6 | 8 | |
| P3-k payroll roll-up screen | 7 | 10 | 2 batches |
| P3-l reimbursements | 6 | 9 | 1 batch |
| P3-m payout batches | 5 | 9 | 1 batch |
| P3-n reporting | 4 | 5 | |
| P3-o jobs RLS narrowing (new) | — | 5 | after P3-b, before P3-m |
| P3-p brand fidelity (new) | — | 6 | runs before P3-e |
| **Total** | **89** | **~152** | 146 (table sum) − 12 (P3-d moot) + 6 (P3-a strict one-object) + 12 (per-batch close rows) |

### P3-a worked example — 18 → 24 rows across three batches

```
--- batch 1 -------------------------------------------------------------
P3a.1a   three enums (publication_status, reimbursement_status, payout_batch_status)
P3a.1b   public.is_org_admin()  — security definer / stable / search_path=''
P3a.2a1  price_sheets  + unique(org, version)
P3a.2a2  price_sheets  + partial unique (org) where status = 'published'
P3a.2b   price_sheet_rates + attach_timing text CHECK — INTRODUCES the canonical value set
P3a.3a   compensation_policies
P3a.3b   commissions   + commissions_one_per_job_idx (job_id) where voided_at is null
P3a.8a1  verify batch 1 (every number ships its command, Rule 29-B)
P3a.8b1  commit batch 1
--- batch 2 -------------------------------------------------------------
P3a.4a   reimbursements  + amount > 0 CHECK                     (AC-9 half)
P3a.4b   payout_batches
P3a.4c   payout_lines    + check(total = hours + commission + bonus + reimbursement)
P3a.5a1  trigger enforce_rate_row_immutability
P3a.5a2  trigger price_sheets published → superseded-only
P3a.5b   trigger enforce_commission_immutability               ← AC-6 in the database
P3a.5c   trigger enforce_payout_line_freeze
P3a.8a2  verify batch 2
P3a.8b2  commit batch 2
--- batch 3 -------------------------------------------------------------
P3a.6    publish_price_sheet(uuid) RPC  — MUST land with 5a-5c or publishing is impossible
P3a.7a1  RLS enable + policies, price_sheets + price_sheet_rates, via is_org_admin()
P3a.7a2  RLS enable + policies, compensation_policies + commissions
P3a.7b1  RLS enable + policies, reimbursements
P3a.7b2  RLS enable + policies, payout_batches + payout_lines
P3a.7c   read-back proving 0005 adds ZERO policy to audit_log
P3a.8a3  verify batch 3 + commit + Tier-A build report
```

**`P3a.2b` is corrected here.** The old row read *"attach_timing text CHECK **byte-matched to**
`0004_scheduling.sql:97`."* Disk shows `attach_timing` declared as plain `text` with **no CHECK**, so
there is nothing to byte-match — P3-a.2 must **INTRODUCE** the canonical value set. (Corrected in the
ledger on disk by `b25c99e`; corrected here for the first time.)

Every other group follows the same shape; the ledger rewrite in **P3-0.1** is where all ~152 rows are
written out. This plan file does not enumerate them — the ledger is their home.

---

## The wrapper group P3-0 (runs first)

| Row | Work |
|---|---|
| **P3-0.1** | Rewrite `handoff\P3-SLICE-LEDGER.md` to the ~152 rows, all `TODO` except the 15 terminal `DONE`. **The ledger's ≤200-line budget is binding**: move the preamble into `P3-CONTEXT-PROTOCOL.md` to buy the lines — **never trim rows** (the checkpoint's own rule). |
| **P3-0.2** | Amend `P3-CONTEXT-PROTOCOL.md` — receive the preamble, record the batch concept, record the `P3a.2` correction. |
| **P3-0.3** | Record the test-runner decision (below) in the protocol's carried decisions. |
| **P3-0.4** | Raise `app/package.json` `engines.node` `">=20"` → `">=22.6"`. **One-line edit; no dependency install.** |

---

## Four reconciliations

**1. Test runner — keep `node:test`, keep the shim, raise `engines`.**
Jeff selected *"Drop shim, raise engines."* **The drop-shim half is contradicted by disk and is not
carried forward.** `app/package.json:15` runs `node --experimental-strip-types --experimental-loader
"data:…"` — and reading that shim's source shows it retries a *failed relative specifier with `.ts`
appended*. That is **extensionless-import resolution, not type stripping**; type stripping does not
cover it. The parallel session independently calls the shim **permanent** (its P3-d build report,
forward contract 3). So:
- Keep `node:test`. `rollup.assert.ts` keeps its `node:assert/strict` + `test()` idiom untouched — no
  `assert.equal` → `expect` rewrite, which was the vitest option's hidden cost.
- **Keep the data-URI loader shim.**
- **Raise `engines.node` to `">=22.6"`** so the declared floor matches the feature the script needs.
  (Installed Node is v22.22.2. The claim that `--experimental-strip-types` landed in 22.6 is
  knowledge-based, not disk-verified, but the parallel session states the same floor.)
- The carried decision **"No new dependencies" stays TRUE** — zero installs, so no Rule 31 amendment
  is owed for it.

**2. Field-tech plumbing → deferred with P4, not folded into P3.** *(no row)*
Jeff selected *"Defer it all."* The three repository interfaces in `data/ports.ts` are declarations
only; concrete implementations are owed by a later slice (P3-d forward contract 2). Mitigating fact:
`@supabase/supabase-js ^2.45.0` is already a dependency, so a ports-implementing adapter group would
cost zero new deps whenever it is authorized.

**3. Brand fidelity is a first-class group, not a style note.** Master Spec §2 line 39 binds:
*"copy the site's color scheme and formatting… colors, fonts, readability and continuity remain
identical to the website sdassemblypro.com."* Jeff selected **"New P3-p brand group"** — it runs
before P3-e so every subsequent screen composes correct tokens.

**4. Session seam — resolved differently on disk; this is now history, not a decision.**
This plan decided a `ModuleRouteProps { session }` prop passed by `m/[moduleId].tsx` into `routes[0]`,
and explicitly *rejected* a `getSession()` accessor as hidden global state. `705613f` then shipped
`modules/admin-finance/src/lib/module-session.ts` (54 lines) with `getModuleSession()` /
`setModuleSession()` — the rejected shape. That is settled; the `+2 rows in P3-d` arithmetic term is
dropped. **The residue is forward contract 1:** `getModuleSession()` returns null until a host calls
`setModuleSession`, so **a later slice MUST add the host-side wiring in `apps/mobile` or the screen
permanently renders its empty state.** That wiring gets its own row, in P3-e's batch 1.

---

## The two new groups

**P3-p — brand fidelity (before P3-e)**
```
P3p.1  read-only capture of sdassemblypro.com palette + type stack
       (no write, no request to the site's backend — Master Spec §2.1/§2.3 stay intact)
P3p.2  audit app\packages\ui\src\tokens.ts against that capture — table of drift, no edit
P3p.3  correct tokens.ts colors to the captured palette
P3p.4  correct tokens.ts typography (lineHeight values are MULTIPLIERS, not pixels)
P3p.5  add AC-11 — every P3 screen composes only packages/ui primitives; grep proves zero raw
       StyleSheet colors in app/modules/admin-finance
P3p.6  verify + commit + report
```

**P3-o — jobs RLS narrowing (after P3-b, before P3-m)**
`app\supabase\migrations\0004_scheduling.sql:221-279` — `jobs_select_org` carries **no role predicate**, and
permissive policies **OR** together, so a tech sees *every* job in the org; `jobs_select_tech` (which
joins through `job_assignments`, not `assigned_tech_id`) narrows nothing. Jeff selected **"Keep it as
P3-o in this phase."**
```
P3o.1  0007_jobs_select_narrowing.sql — drop policy jobs_select_org; recreate role-narrowed
P3o.2  extend tests/0004_scheduling_rls.test.sql + .hosted twin: tech-sees-only-assigned probe
P3o.3  apply + run hosted via the SQL Editor                          (EXEC-GATED)
P3o.4  verify — zero cross-tech rows, owner/admin unchanged
P3o.5  commit + report
```

---

## Files this touches

- `Jobcore\handoff\P3-SLICE-LEDGER.md` — 89 → ~152 rows, suffix-decomposed, all `TODO` but the 15
  terminal `DONE`; preamble moves out to buy the 200-line budget
- `Jobcore\handoff\P3-CONTEXT-PROTOCOL.md` — receives the preamble; records the batch concept, the
  runner decision, and the `P3a.2` correction
- `Jobcore\app\package.json` — `engines.node` `">=20"` → `">=22.6"` (P3-0.4)
- `Jobcore\app\supabase\migrations\0005_money.sql` — net new, EXEC-GATED, three batches
- `Jobcore\app\supabase\migrations\0006_job_service_area.sql`, `0007_jobs_select_narrowing.sql` — net new
- `Jobcore\app\packages\ui\src\tokens.ts` — P3-p brand corrections
- `Jobcore\app\modules\admin-finance\src\` — `money/`, `data/`, `lib/`, `screens/` and
  `__assertions__/` now exist (`ee4a4f8`, `705613f`, `2724914`); `index.ts` is 26 lines with the
  manifest **filled** (no longer the P1 stub); `domain/`, `flows/`, `components/`, `reporting/` are
  still to be created
- `Jobcore\app\apps\mobile\` — host-side `setModuleSession` wiring only (forward contract 1)

**Apply channel:** the hosted Supabase SQL Editor is the *sole* channel — `supabase` CLI, `psql` and
docker are all absent on this machine. It runs a pasted script as one transaction. Migrations are
flat under `app/supabase/`, `NNNN_snake_case.sql`, **not idempotent**, no down convention.

---

## Verification

**Ungated assertions** (`node:test`, already shipped at `ee4a4f8` and widened at `2724914`; the
`engines` floor is raised at P3-0.4 and the data-URI loader shim is **KEPT** — it resolves
extensionless relative `.ts` imports, which type-stripping does not do):

```
cd Jobcore/app && npm run test
```
→ the `money/` and `data/` `__assertions__/*.assert.ts` suites, currently **10/10 passing**.

Plus, per group, run from `Jobcore/app`:
- `npm run typecheck` and `npm run lint` → exit 0
- **AC-3** `grep -rn "admin-finance" apps/mobile/app apps/mobile/src` → exactly one hit,
  `apps/mobile/src/modules.ts:12`
- **AC-4** `grep -rn "status *=" modules/admin-finance --exclude-dir=dist` → no matches
  (**`--exclude-dir=dist` is required** or it false-positives on compiled output)
- **AC-10** `grep -rn "sdassemblypro\|GTM-\|G-93R" modules/admin-finance` → no matches

**Gated (hosted Supabase SQL Editor, browser):** paste `0005_money.sql`, then
`tests/0005_money_rls.hosted.test.sql`; every AC raises on failure inside `begin; … rollback;`.
Hosted UUIDs are substituted **by name, never positionally** — `order by email` returns them
alphabetically, not in placeholder order, and positional substitution silently swaps identities.

---

## Deferred / OPEN — recorded, not scheduled as P3 rows

| Item | Why it is not a row |
|---|---|
| Concrete implementations of the three `data/ports.ts` interfaces | Deferred with P4 per Jeff's *"Defer it all"* (forward contract 2) |
| **D7** — `packages/core`'s compiled `dist` emits extensionless ESM re-exports (`./clocks`), so a runtime value-import of `@jobcore/core` throws `ERR_MODULE_NOT_FOUND` | Touches a **shared package** outside the authorized file set — **needs Jeff's say-so** |
| **D8** — `replay.assert.ts` imports `replayQueue` via a relative source path | Reverts to the `@jobcore/core` specifier once D7 is fixed |
| Spec signatures at `03-P3-admin-finance.md` L73-75 / L100-102 are out of date | Shipped `calculateCommission` has a 4th `rates` param, `rollUpPeriodPay` a 5th `options` param, both returning `CalculationResult<T>`; a Rule 31 docs fix rides the next P3 commit |
| P2d.4a device half | Written procedure at `handoff\P2D-AIRPLANE-MODE-TEST.md`; **nothing is marked PASSED that Jeff did not observe** |

---

## Execution discipline

- **Rule 38 rolling slices** — one hound per row, findings to a scratchpad crib, a one-line return,
  evict the completed slice before the next dispatches.
- **Rule 30** — every write goes through a hound (Nestor · Spot · Marmanduke); the main session never
  calls Edit/Write.
- **Close-out ritual** (7 steps, in order): verification row alone → code commit by explicit pathspec
  → same-turn disk read of every artifact about to be called DONE → ledger commit flipping `TODO` →
  `DONE <hash>` with `Context out` filled in the same commit → Tier-A build report carrying
  `Forward contracts:` (Rule 25) and `## Deviations / Defects` (Rule 37) → name the drop set → yield.
- **All commits go to the NESTED repo** `E:\Jeff\Codespace\SDAssemblyPros\Jobcore`, never the admin
  repo. **Never stage `plans-deliveries/`** — untracked by design. `E:\Jeff` is a shared worktree
  across up to 5 sessions: scoped pathspecs only.
- Foreign working-tree entries in the Jobcore repo are not staged, committed, reverted, or modified.
  Untracked `jobcore-mobile-build-toolchain.md` at the repo root stays untouched (D6).
- Credentials are never read, printed, or committed — `apps/mobile/.env` included.
- **Rule 29-B** — every numeric claim ships the command that produced it;
  `(Get-Content '<path>').Count` only, `Measure-Object -Line` is banned.
