# Jobcore P3 — Admin/Finance module

> Filename is harness-assigned. Per memory `feedback-plan-naming-goal-slug.md` this should be
> `jobcore-p3-admin-finance.md`; rename on first write out of Plan Mode.

## Context

Jobcore P2 (scheduling core) closed at ledger row P2f.2b — commits `18793a4` + `71b2560`, zero
`TODO` rows. The session has been holding at the P2→P3 boundary on Jeff's standing order:
*"approval goes only for P2 operations. When P3 starts up, I want a powow."* **This file is the
powwow material.** It authorizes nothing on its own.

P3 builds `modules/admin-finance` — the chief module, where a lead becomes a scheduled job, a job
becomes an assignment, and a completed job becomes money. Spec of record:
`Jobcore\03-P3-admin-finance.md` (179 lines) + `Jobcore\00-MASTER-SPEC.md` §9/§12.

---

## Corrections to the spec (verified on disk this session — do not build from the spec literally)

| # | Spec says | Disk says | Fix |
|---|---|---|---|
| 1 | "Migration `0003_money.sql`" (L33) | `0003_invitations_and_signup.sql` and `0004_scheduling.sql` both exist | **`0005_money.sql`** |
| 2 | `modules/…`, `packages/…`, `supabase/…` at repo root (Master §16) | monorepo root is `Jobcore\app`; `app\package.json:6-10` workspaces `["apps/*","packages/*","modules/*"]` | **prefix every spec path with `app/`** |
| 3 | Build item 1 reads as create-and-register | all three module packages exist and all three are already registered — `app\apps\mobile\src\modules.ts:11-18`, `modules\admin-finance\src\index.ts:52-54` | item 1 is a **stub-fill** |
| 4 | AC-4 `grep -rn "status *=" modules/admin-finance`; verify-8 `grep -rn "sdassemblypro\|GTM-\|G-93R" modules/admin-finance` | that path does not exist | both greps currently **false-pass**; re-point at `app/modules/admin-finance` |
| 5 | build item 4 warns on assignment outside a seeded community | `jobs` has **no `service_area_id`** (`0004_scheduling.sql:89-108`) | new `0006_job_service_area.sql`, see Decision 3 |

Settled inputs from Jeff: **26 communities, flat, all under San Diego County** (no hierarchy — the
existing 4-column `service_areas` shape is already correct and needs a reseed, not a schema change).
All six current placeholders (`seed.sql:113-127`) are members of the 26, so the reseed is **purely
additive** — no existing id is rewritten and `on conflict (id) do nothing` stays truthful.

---

## Blocker (Rule 15 R-A) — Jeff's action, does not gate the whole phase

**No live Supabase project exists** (`app\supabase\README.md` L44-45). Jeff creates the project and
populates `apps/mobile/.env` from `.env.example`; I never touch credentials.

This gates P3 ACs 1–3, 5, 7, 10 and verification steps 1–7 — but **not** ACs 6, 8, 9, which are pure
functions over fixtures. Those are the ungated track, which is why the money core is sequenced first.
Gated items are reported **OPEN, never PASSED**.

---

## Slice sizing — "how small is perfect", measured

P2 actuals (`git show --shortstat` per commit, cross-read against `handoff\P2-SLICE-LEDGER.md`):

| Group | Sub-rows | Commit | Files | +ins/−del | Ins per row |
|---|---|---|---|---|---|
| S5 | 8 | `0ffb2b9` | 24 | +676/−59 | 85 |
| P2-a | 7 | `ad3bb4d` | 5 | +523/−23 | 75 |
| P2-b | 3 | `e451d6e` | 2 | +283/−0 | 94 |
| P2-c | 7 | `a7650b3` | 8 | +428/−28 | 61 |
| P2-d | 10 | `9bcb019` | 13 | +767/−8 | 77 |
| P2-e | 9 | `d29581b` | 10 | +512/−0 | 57 |
| P2-f | 5 | `18793a4` | 3 | +361/−0 | 72 |
| **Total** | **49** | 7 code + 5 ledger | **65** | **+3550/−118** | **mean 72** |

**Verdict: the row rule worked; the commit rule did not.** Insertions per sub-row held 57–94 across
SQL, TS domain logic, React Native screens and docs — a ±26% band, which is the P2 sizing rule
(`P2-SLICE-LEDGER.md:19-24`) doing real work. Files per row before the rule: 3.0 (S5). After: 1.16.
The failures were at group scale: S5 shipped 24 files in one commit and is the only group that
carried debt forward; `a7650b3` ("P2-c dual-clock") smuggled in `0003_invitations_and_signup.sql`
(+189) that no P2-c ledger row names. P2-e fixed that by staging explicit per-file pathspecs and
echoing `git diff --cached --name-only` first — and P2-e is the only large group with zero smuggling.

**P3 rule — a row qualifies only if all six hold:**
1. One primary file. A second rides only for a Rule 31 docs fix.
2. One question, stateable in one sentence.
3. ≤ ~150 lines of pre-read context (this is also the roll-in budget — see below).
4. ≤ ~90 net new lines authored. Gated SQL tightens to **≤ 80 lines and one DDL family** — no
   compiler and no test run stand behind a gated row, so the only error-catching surface is reader
   attention; buy it back with a shorter row.
5. Verification, commit and build-report work never share a row with authoring work.
6. **New — a group is ≤ 8 sub-rows and ≤ 10 files**, one code commit staged by explicit pathspec.

IDs decompose by suffix (`P3c.2` → `P3c.2a/b`); no existing ID is ever renamed or deleted.

---

## Rolling-context protocol

**Roll-in** — when slice `P3x` starts, load in this order and nothing else:
1. `Jobcore\handoff\P3-SLICE-LEDGER.md` (whole file, target ≤ 200 lines).
2. The **Context-in** cell of the first non-`DONE` row of `P3x` — a bounded file:line list.
3. The newest build report in `.claude\build-reports\jobcore-p3-admin-finance\`, **only** if the
   previous row is in the same group. Cross-group, read only that group's Forward-contracts cells.
4. The files named in Context-in, chunk-read (Rule 6), never whole-directory.

**Must not load:** `00-MASTER-SPEC.md` or `03-P3-admin-finance.md` in full — the ledger row quotes
the spec lines it needs, and if it doesn't, that is a ledger defect to fix in the cell. Also barred:
`P2-SLICE-LEDGER.md` and every P2 build report (P2 contracts that still bind are copied forward once
into the P3 ledger preamble, then P2 is dead to P3); sibling-band files; any `dist/`,
`package-lock.json`, `node_modules`; any closed slice's implementation body.

**Hand to a hound, never read in the main session** (Rule 6 §context-offload, Rule 33): every write
(Rule 30 — Nestor/Spot/Marmanduke); any recon over >1 file or >150 lines, one hound = one file = one
closed-form question; grep sweeps over 20 hits (hound returns the count and classification, not the
hits); bulky cross-band reference via a scratchpad crib file.

**Roll-out** — on flipping a row to `DONE <hash>`: write its **Context-out** cell (≤2 sentences,
usually identical to its Forward contract; `none` is valid), then drop the file bodies, grep output,
tsc output and diff read for that row. Keep the row, the hash, and the Context-out sentence. At group
close, drop every Context-out cell not referenced by a later group's Context-in.

Two invariants keep this safe: **Rule 29** — a `DONE` flip requires a same-turn disk read of the
artifact the row names, and roll-out happens *after* that read, never instead of it. **Rule 29-B** —
every numeric claim ships its command; line counts use `[IO.File]::ReadAllLines('<path>').Length` or
`(Get-Content '<path>').Count` (`Measure-Object -Line` is banned).

**Restated as a sizing test:** a slice is correctly sized when its Context-in fits one read pass
(~150 lines) and its Context-out compresses to ≤2 sentences. If Context-out needs a paragraph, the
slice answered more than one question and rule 2 was violated.

---

## Slice map (14 groups, merged from three planning bands — letter collisions reconciled)

| Group | Scope | Gate |
|---|---|---|
| **P3-a** | `app/supabase/migrations/0005_money.sql` — enums, `is_org_admin()`, the 7 money tables, immutability triggers, `publish_price_sheet()` RPC, RLS on all 7 | EXEC-GATED |
| **P3-b** | `0006_job_service_area.sql` (nullable `jobs.service_area_id` FK) + additive 20-row `seed.sql` reseed to 26 + `supabase/README.md` ride | EXEC-GATED |
| **P3-c** | **Money core, pure TS** — `money/types.ts`, `calculateCommission`, `deriveBillableHours`, `BonusRule`/`NullBonusRule`, `rollUpPeriodPay`, assertions | **UNGATED** |
| **P3-d** | Module shell — `data/ports.ts`, `lib/module-session.ts`, `AdminFinanceRoot.tsx`, manifest fill in `src/index.ts` | ungated |
| **P3-e** | Lead inbox — `Lead` type, `classifyLead`/`missingFields`, fixtures incl. the hero lead, `LeadRow`, `LeadInboxScreen` | ungated |
| **P3-f** | Qualify — `domain/transition.ts` (sole `applyTransition` call site), `validateQualify`/`buildJobFromLead`, `AxisPicker`, `QualifyScreen`, `flows/qualify-lead.ts` | authoring ungated |
| **P3-g** | Assignment board — `overlaps()`, `warningsFor()`, `TechColumn`, `AssignmentBoardScreen`, `WarningSheet`, `flows/assign-job.ts` | authoring ungated |
| **P3-h** | Close-out — `awaitingCloseOut`/`closeOutBlockers`, queue + review screens, `flows/close-out-job.ts` writing the one `commissions` row | write gated |
| **P3-i** | Price-sheet editor — pure `planPublish`, `PriceSheetRepo`, list + editor screens, publish action | split |
| **P3-j** | Edge Function `price-sheet-current` — `functions/deno.json` scaffold, pure `buildFeed`, Deno transport, README ride | EXEC-GATED |
| **P3-k** | Reimbursement approval + payout batches — pure `buildPayoutBatch` (freeze by value copy), queue screen, batch screen, repos | split |
| **P3-l** | Reporting — `byStatus/bySource/byAttachTiming`, `slotHitRate`, revenue/commission rollups, `ReportsScreen` | ungated |
| **P3-m** | `app/supabase/tests/0005_money_rls.test.sql` — AC-10/verify-7 zero-row probes, trigger-denial probes, `audit_log` policy-count canary | EXEC-GATED |
| **P3-n** | AC sweep + phase build report + ledger close | — |

**Sequencing.** P3-c merges in parallel with P3-a (pure functions, zero dependencies — it is the
ungated track that keeps working while the Supabase gate is closed). P3-d…P3-h then run in order.
P3-i…P3-l are independent of each other once P3-c and P3-d land. P3-m follows P3-a. P3-n last.

`Jobcore\handoff\P3-SLICE-LEDGER.md` does not exist and is created first, mirroring the P2 shape
(status cell `DONE <hash>`, Commit and Build-report cells **empty**, no dates) plus three columns the
rolling protocol needs:

```
| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
```

---

## Key design decisions

**Published-sheet immutability = a `before update or delete` trigger**, not policy absence and not
RLS. Policy absence works for `audit_log` because that table has zero legal mutations; `price_sheets`
has exactly one (`published → superseded`). RLS is decisively wrong here because the service role
bypasses it — and the service role is exactly what the Edge Function runs as. A trigger sees OLD vs
NEW and fires for the service role too. Companions: `enforce_rate_row_immutability` (otherwise
immutability is defeated by editing the rates instead of the sheet), `enforce_commission_immutability`
(this is **AC-6 in the database**, not a promise about app code), `enforce_payout_line_freeze`.
Because the trigger permits exactly one delta, `publish_price_sheet(uuid)` must ship in the same
migration or publishing is impossible.

**AC-5 "exactly one commission" is a partial unique index**, not an app convention:
`unique (job_id) where voided_at is null` — which preserves Master Spec §10's correction seam (a new
row with a reason, never a mutation).

**AC-9 is enforced by two absences plus one CHECK**: `reimbursements` has no `commission_id` column,
no `adjusts_commission` flag, and `amount > 0`. A reimbursement is structurally incapable of being a
deduction.

**AC-4 is satisfied structurally, not by grep** — four compile-time mechanisms: the port type's key
union excludes `'status'`; the only status-writing method takes a `Job` that `applyTransition`
produced; one chokepoint file (`domain/transition.ts`) is the module's sole importer, enforced by an
ESLint `no-restricted-imports` rule on the existing `npm run lint`; jobs are `Readonly<Job>` inside
the module. Grep-trap worth naming: `status *=` also matches `status ===`, which is why P2-e had to
hand-adjudicate 10 auth-discriminant hits — `module-session.ts` returns a pre-narrowed object and
status membership uses `Set.has()` so the literal never appears.

**Only `routes[0]` ever renders** — `app\apps\mobile\app\m\[moduleId].tsx:52`, because
`typedRoutes: true` means Expo Router cannot mint route files for dynamically-registered paths. So
the module contributes **one** route, `AdminFinanceRoot`, an internal state-driven switcher. This is
a constraint, not a preference.

**No new dependencies.** `date-fns` belongs to `apps/mobile` only; overlap math is ~20 lines of
`Date.getTime()`. `JOB_STATUS_COLORS` lives in `apps/mobile` and is unreachable from a module — the
board renders only two statuses, so a local chip style over existing `colors.info`/`colors.warning`
tokens is correct and cheaper than a cross-package refactor.

---

## Three decisions for Jeff (recommendations baked in; say the word to override)

1. **Test runner.** None exists — no `test` script anywhere (`app\package.json:11-16`), and P2 logged
   this gap twice. P3 is ~60% pure functions, so the gap now costs real coverage. **Recommend Node
   20's built-in `node:test` + `node:assert/strict`** — zero install, `"node": ">=20"` already
   declared. Alternative: vitest (a dependency install, its own row).
2. **When the commission row is written.** `completed → paid` carries `requirePaymentSettled`
   (`state-machine.ts:95-106`), which passes automatically when `payer !== 'customer'` but otherwise
   needs a P5 payment record. **Recommend: close-out writes the commission on a successful
   `completed → paid`.** Partner-payer jobs then close fully inside P3; customer-payer jobs sit in
   the queue showing `canTransition`'s exact reason until P5. Keeps zero PCI scope and zero P5
   dependency, and honours "commission is not contingent on any review".
3. **Out-of-area warning.** **Recommend adding `jobs.service_area_id`** (nullable FK, own migration
   `0006`). Text-matching `jobs.address` fails outright: La Jolla, Pacific Beach, Rancho Bernardo and
   Carmel Valley are neighborhoods *inside* the City of San Diego, so a real address reads
   `…, San Diego, CA 92037` and the string "La Jolla" is absent — the seed hides this only because
   `seed.sql:133` writes a stylized address. "San Diego" is also a substring of nearly every address
   in the county, so a naive match classifies everything as in-area and the warning never fires.
   `jobs.address` is nullable too, so text matching cannot separate *outside the area* from *address
   unknown* — two states Qualify must keep apart. Resolve once at Qualify, where a human is already
   confirming the address; the board then reads a foreign key.

---

## Verification

**Ungated, provable with no Supabase project (the R-A parallel track):**
- `npm run typecheck` exit 0 at each group close; `npm run lint` clean (this is what enforces AC-4's
  import chokepoint).
- **AC-8** fixture — tech, 2 jobs (2.0h and 1.5h spans), `hourly_base = 25`, commissions 40 + 60, one
  18.75 receipt, `NullBonusRule` → `total === 206.25` with all five parts exposed separately.
- **AC-9** — every `commissionLines[i].amount` is byte-identical whether `reimbursements` is `[]` or
  carries the 18.75 line; no `CommissionLine` field is negative; the type has no reimbursement-shaped
  field at all (compile-time).
- **AC-6** pure half — sheet v1 (rate 100) → line L1; publish v2 (rate 200); recompute from L1's
  snapshot `price_sheet_id` → identical to the cent. Plus: `calculateCommission` never reads a
  "current sheet" global; it is a pure function of its arguments.
- **AC-1** — `classifyLead(heroLead) === 'needs_info'`, `missingFields` deep-equals
  `['preferredDate','address']`, the row renders (not filtered), `validateQualify` returns
  `{ok:false}` with no `NewJob`, submit is disabled.
- **AC-3 static half** — `grep -rn "admin-finance" app/apps/mobile/app app/apps/mobile/src` returns
  exactly one hit, `modules.ts:12`; `calendar.tsx` and `JobDetail.tsx` import nothing from `modules/`.
- **AC-4** — `grep -rn "status *=" app/modules/admin-finance/src` returns **zero raw lines**, not
  zero-after-adjudication.
- **Verify-8** — `grep -rn "sdassemblypro\|GTM-\|G-93R" app/modules/admin-finance` returns zero.
- Structural SQL checks: balanced `$$`, pure ASCII, `attach_timing` CHECK values matched byte-for-byte
  against `0004_scheduling.sql:78,97`, and `0005` adds **no policy to `audit_log`**.

**Gated on the Supabase project** — run in one pass at provisioning, reported OPEN until then:
`0005_money_rls.test.sql` in full (tech and sales see zero rows from all seven tables, with owner-sees-N
planted first so the probes cannot pass vacuously, plus write-denial survival checks); verify-3's two
snapshot ids; verify-4's byte-identical `amount::text` after a doubled republish (text, not numeric —
`100.00 = 100.0` is TRUE and would hide scale drift); verify-5's `curl` before/after publish;
verify-6's hand-computed period pay to the cent; verify-1/2's seeded-lead and sign-in-as-tech halves.

**Edge Function note:** deploy requires `--no-verify-jwt` / `verify_jwt = false`. A default-deployed
function rejects anonymous callers and silently fails AC-7.

---

## Close-out ritual (P3 keeps P2's two-commit pattern — it held five-for-five)

Per group, in order: (1) verification row, own sub-row, no authoring, numbers ship their commands;
(2) code commit, group files only, staged by explicit pathspec with `git diff --cached --name-only`
echoed first, no ledger edit inside it; (3) same-turn disk read of every artifact about to be called
`DONE`, with an N-row present/absent table when N>1; (4) ledger commit — one file, `TODO`→`DONE <hash>`
naming that hash in the message, **and the Context-out cell filled in the same commit** (a `DONE` row
with an empty Context-out is an incomplete close); (5) Tier-A build report at
`.claude\build-reports\jobcore-p3-admin-finance\` with a `Forward contracts:` field (Rule 25) and a
DEFERRED table listing every gated item as OPEN; (6) **new for P3** — state which files are being
dropped from context and which Context-out sentences carry forward; a group close that does not name
its drop set has not closed; (7) yield at the group boundary (Rule 10).

All Jobcore commits go to the **nested repo** `E:\Jeff\Codespace\SDAssemblyPros\Jobcore`, never the
admin repo. `plans-deliveries/` is untracked by design — never stage it.

## Out of scope

P4 tech-facing screens · P5 payment capture/QR/reviews · P6 social posting · P7 intake adapters and
push · any change to sdassemblypro.com, its PHP, its forms, or its GTM/GA4 tags (permanent) · any card
data anywhere (zero PCI scope).
