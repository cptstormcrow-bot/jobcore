---
classification: sdassemblypros/jobcore
comments: "Jobcore P3 — context protocol and conventions"
origin: Codespace/SDAssemblyPros/Jobcore/handoff/P3-CONTEXT-PROTOCOL.md
tags: [sdassemblypros, jobcore]
---
# Jobcore P3 — context protocol and conventions

> Pointer back: see [P3-SLICE-LEDGER.md](P3-SLICE-LEDGER.md) for the goal, spec pointers, the
> Rule 15 R-A blocker, the P2 contracts still binding, all group tables, out-of-scope, and carried
> debts from P2.

## Spec corrections (verified on disk — do NOT build from the spec literally)

1. Spec says migration `0003_money.sql`; `0003_invitations_and_signup.sql` and `0004_scheduling.sql`
   already exist. The money migration is **`0005_money.sql`**.
2. Master Spec §16 shows a flat repo root. The real monorepo root is `Jobcore\app`
   (`app/package.json:6-10` workspaces `["apps/*","packages/*","modules/*"]`). **Prefix every spec
   path with `app/`.**
3. Build item 1 reads as create-and-register. All three module packages already exist and are already
   registered (`app/apps/mobile/src/modules.ts:11-18`; `app/modules/admin-finance/src/index.ts:52-54`).
   Item 1 is a **stub-fill**, not a create.
4. AC-4 and verification step 8 grep `modules/admin-finance`, a path that does not exist, so both
   currently **false-pass**. Re-point both at `app/modules/admin-finance`.
5. Build item 4 needs an out-of-area warning but `jobs` has no `service_area_id`
   (`0004_scheduling.sql:89-108`). Added as a nullable FK in `0006_job_service_area.sql` (P3-b).

Settled input: **31 community names, flat, all under San Diego County.** No hierarchy; the existing
4-column `service_areas` shape is correct. All 6 current placeholders (`seed.sql:113-127`) are members
of the 31, so the reseed is purely additive and `on conflict (id) do nothing` stays truthful. Count
corrected from 26 after live-site verification of sdassemblypro.com (sitemap + /about/ + /contact/ +
/faq/ cross-check), merge approved by Jeff.

## Sizing rule (measured from P2: 49 sub-rows, +3550/-118, mean 72 insertions per row, band 57-94)

A row qualifies only if ALL SIX hold:
1. One primary file. A second rides only for a Rule 31 docs fix.
2. One question, stateable in one sentence.
3. <= ~150 lines of pre-read context (this is also the roll-in budget).
4. <= ~90 net new lines authored. **Gated SQL tightens to <= 80 lines and one DDL family** — no
   compiler and no test run stands behind a gated row, so reader attention is the only error-catching
   surface.
5. Verification, commit and build-report work never share a row with authoring work.
6. A group is <= 8 sub-rows and <= 10 files, one code commit staged by explicit pathspec.

IDs decompose by suffix (`P3c.2` -> `P3c.2a/b`). No ID is ever renamed or deleted.

## Rolling-context protocol

**Roll in**, in this order and nothing else: (1) this ledger whole; (2) the **Context in** cell of the
first non-DONE row of the group; (3) the newest build report in
`.claude\build-reports\jobcore-p3-admin-finance\` ONLY if the previous row is in the same group —
cross-group, read only that group's **Forward contracts** cells; (4) the named files, chunk-read.

**Must not load:** `00-MASTER-SPEC.md` or `03-P3-admin-finance.md` in full (a row quotes the spec
lines it needs; if it does not, that is a ledger defect — fix the cell, do not read the spec);
`P2-SLICE-LEDGER.md` or any P2 build report; sibling-band files; `dist/`, `package-lock.json`,
`node_modules`; any closed slice's implementation body.

**Hand to a hound, never read in the main session:** every write (Rule 30 — Nestor / Spot /
Marmanduke); any recon over more than one file or 150 lines (Rule 33: one hound = one file = one
closed-form question); grep sweeps over 20 hits (return the count and classification, not the hits);
bulky cross-band reference via a scratchpad crib file.

**Roll out** on flipping a row to `DONE <hash>`: fill its **Context out** cell (<= 2 sentences;
`none` is valid), then drop that row's file bodies, grep output, tsc output and diff. Keep the row,
the hash and the sentence. At group close, drop every Context out cell not named by a later group's
Context in. Rule 29 still binds: the DONE flip requires a same-turn disk read, and roll-out happens
AFTER that read, never instead of it.

**Sizing test restated:** a slice is correctly sized when its Context in fits one read pass (~150
lines) and its Context out compresses to <= 2 sentences. If Context out needs a paragraph, the slice
answered more than one question.

## Close-out ritual (per group, in order)

1. Verification row — its own sub-row, no authoring; every number ships the command that produced it.
2. Code commit — group files only, staged by explicit pathspec, `git diff --cached --name-only`
   echoed first, no ledger edit inside it.
3. Same-turn disk read of every artifact about to be called DONE (N-row present/absent table if N>1).
4. Ledger commit — one file, TODO -> `DONE <hash>` naming that hash in the message, **and the Context
   out cell filled in the same commit**. A DONE row with an empty Context out is an incomplete close.
5. Tier-A build report at `.claude\build-reports\jobcore-p3-admin-finance\` with a
   `Forward contracts:` field (Rule 25) and a DEFERRED table listing every gated item as OPEN.
6. Name the drop set — which files leave context, which Context out sentences carry forward. A group
   close that does not name its drop set has not closed.
7. Yield (Rule 10).

All commits go to the NESTED repo `E:\Jeff\Codespace\SDAssemblyPros\Jobcore`, never the admin repo.
`plans-deliveries/` is untracked BY DESIGN — never stage it.

## Decisions carried into the rows

- **Test runner:** Node 20 built-in `node:test` + `node:assert/strict`. Zero install; `"node": ">=20"`
  already declared at `app/package.json:29`. Wired in P3c.6.
- **Commission write point:** close-out writes the `commissions` row on a successful
  `completed -> paid` transition. `requirePaymentSettled` (`state-machine.ts:95-106`) auto-passes when
  `payer !== 'customer'`, so partner-payer jobs close fully inside P3; customer-payer jobs sit in the
  queue showing `canTransition`'s exact reason until P5. Zero PCI scope, zero P5 dependency.
- **Out-of-area warning:** resolved by `jobs.service_area_id` (nullable FK), set once at Qualify.
  Address text-matching is rejected: La Jolla, Pacific Beach, Rancho Bernardo and Carmel Valley are
  neighborhoods INSIDE the City of San Diego, so a real address reads `..., San Diego, CA 92037` and
  the community string is absent — it would pass on the seed and fail in production.
- **Published-sheet immutability:** a `before update or delete` trigger, not policy absence and not
  RLS. RLS is bypassed by the service role, which is exactly what the Edge Function runs as.
- **AC-5 "exactly one commission":** a partial unique index `(job_id) where voided_at is null`, which
  preserves Master Spec §10's correction seam (a new row with a reason, never a mutation).
- **AC-9:** enforced by two absences plus one CHECK — `reimbursements` has no `commission_id`, no
  `adjusts_commission` flag, and `amount > 0`.
- **No new dependencies.** `date-fns` belongs to `apps/mobile` only; overlap math is ~20 lines of
  `Date.getTime()`. `JOB_STATUS_COLORS` stays in `apps/mobile` and is not moved.

## Sequencing

P3-c runs in parallel with P3-a (ungated R-A track). P3-d through P3-h run in order. P3-i, P3-j, P3-k
and P3-l are independent of each other once P3-c and P3-d land. P3-m follows P3-a. P3-n last.

## Ledger preamble (moved from P3-SLICE-LEDGER.md, Rule 21 preamble/row split)

- Goal slug: `jobcore-p3-admin-finance`.
- Spec of record: `Jobcore\handoff\03-P3-admin-finance.md` (see Spec corrections above — do not
  build from it literally).
- Plan of record: `E:\Jeff\.claude\plans\jobcore-p3-admin-finance-execution.md`.

## P2 contracts still binding

- `JobStatus` union lives in `packages/core`; the module imports it, never redeclares it.
- `applyTransition` / `canTransition` are the ONLY legal state-machine entry points (P3f.1 is P3's
  sole call site).
- `packages/core` owns the money boundary types; the module's `money/types.ts` extends, never
  duplicates.
- `audit_log`'s immutability is policy-ABSENCE, not a policy — P3-a's RLS row (P3a.7) must prove
  `0005` adds NO policy to `audit_log` (verified by the canary in P3m.4a).
- `tokens.typography.lineHeight` values are MULTIPLIERS, not pixels (carried into P3-p).
- `jobs.requested_window` is untyped text — reporting (P3-l) treats unparseable values as `unknown`,
  never a hit or a miss.
- Only `routes[0]` renders for a module — `AdminFinanceRoot` (P3d.3) is the module's ONE route.

## Blocker (Rule 15 R-A) — CLEARED 2026-08-01

Hosted Supabase project ref `vogkxkcceahtwyovpxsg` confirmed reachable; EXEC-GATED rows (P3-a, P3-b,
P3-o, P3-j, P3-m) may run against it via the SQL Editor per the close-out ritual. This note is
historical — the blocker is cleared, not a live condition to re-check.

## Carried decisions (P3-0 wrapper group)

**Batch concept** (P3-0.1/P3-0.2): A *batch* is <= 9 sub-rows, <= 6 files, one code commit staged by
explicit pathspec. A group may run as N sequential batches, each closing with its own verification
row and its own commit row. Group letters and row IDs are untouched — a batch is a run boundary, not
an identifier. This supersedes the old "one code commit per group" framing in the Sizing rule above;
the group-level cap in that section (<= 8 sub-rows, <= 10 files) is superseded by this batch cap for
any group that now exceeds 8 sub-rows.

**Test runner decision** (P3-0.3, folds in plan row P3-0.3): Keep `node:test`. Keep the data-URI
loader shim (`app/package.json` — it resolves extensionless relative `.ts` imports, which
type-stripping does not cover). Raise `engines.node` to `>=22.6`. No new dependencies added. This
supersedes the "Test runner" bullet under Decisions carried into the rows above, which still names
the old `">=20"` floor without the shim.

**P3a.2 correction, historical**: `P3a.2b` (`price_sheet_rates.attach_timing`) INTRODUCES the
canonical value-set CHECK — it does not byte-match `0004_scheduling.sql:97` as an earlier draft
claimed. Corrected on disk by commit `b25c99e`; P3-a is now terminal DONE, so this is history, not a
live instruction.
