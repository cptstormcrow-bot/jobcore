# Jobcore P3 — Admin/Finance module — Slice Ledger

Goal slug: `jobcore-p3-admin-finance`
Spec of record: `03-P3-admin-finance.md` (179 lines) + `00-MASTER-SPEC.md` §9 / §12.
Plan of record: `E:\Jeff\.claude\plans\jobcore-p3-admin-finance.md` (approved 2026-08-01).

> Sizing rule, rolling-context protocol, close-out ritual, spec corrections, the 26 communities, and the phase decisions live in [P3-CONTEXT-PROTOCOL.md](P3-CONTEXT-PROTOCOL.md). Read it once per phase, not per slice.

## P2 contracts still binding (copied forward once — do NOT read the P2 ledger or P2 reports)

- `JobStatus` is the 13-member union in `app/packages/core/src/state-machine.ts:11-25`.
- `applyTransition` (`state-machine.ts:202`) is the ONLY legal status write. `canTransition` (`:172`)
  is the only place legality is decided.
- `packages/core` must not know about money (`state-machine.ts:63`). Money lives in the module.
- Audit immutability is by POLICY ABSENCE — `audit_log` carries SELECT + INSERT only
  (`0001_foundation.sql:159-176`). Adding an UPDATE or DELETE policy silently breaks it.
- `tokens.typography.lineHeight` values are MULTIPLIERS, not pixels (`packages/ui/src/tokens.ts`).
- `jobs.requested_window` is untyped `text` (`0004_scheduling.sql:98`) with no format constraint.
- Only `routes[0]` ever renders (`app/apps/mobile/app/m/[moduleId].tsx:52`).

## Blocker (Rule 15 R-A) — CLEARED 2026-08-01

Hosted Supabase project live (ref `vogkxkcceahtwyovpxsg`, `README.md` L6-9): four migrations applied,
four auth users created, `seed.hosted.sql` applied, both hosted RLS suites executed and PASSED,
`apps/mobile/.env` populated and verified. Nothing external gates P3. `(EXEC-GATED)` below now means
"needs the live DB to verify", not "blocked". P3-c is still the parallel track alongside P3-a.

---

## P3-a — `app/supabase/0005_money.sql` (EXEC-GATED)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3a.1 | Enums (`publication_status`, `reimbursement_status`, `payout_batch_status`) + `public.is_org_admin()` helper, `security definer / stable / search_path=''` | TODO | | | `0001_foundation.sql:74-89,111-117`; enum doctrine `0004_scheduling.sql:8-10` | | |
| P3a.2 | `price_sheets` + `price_sheet_rates` tables; `unique (organization_id, version)`, partial `unique (organization_id) where status='published'`; INTRODUCES the `attach_timing` CHECK (not enum) — `0004_scheduling.sql:78,97` declare it as unconstrained `text`, so nothing exists to byte-match; the set is authored here and MUST admit spec pair `at_purchase`/`after_the_fact` PLUS the seeded literal `before_start`, and MUST permit NULL (hero_quick lead) | TODO | | | P3a.1 output; `0004_scheduling.sql:43-48,78,97`; `00-MASTER-SPEC.md:125`; `seed.sql:172` | | |
| P3a.3 | `compensation_policies` + `commissions`; both snapshot FKs `not null` and `on delete restrict`; `commissions_one_per_job_idx` partial unique on `(job_id) where voided_at is null` | TODO | | | P3a.2 output; spec L43-44 | | |
| P3a.4 | `reimbursements` + `payout_batches` + `payout_lines`; `check (total_amount = hours_amount + commission_amount + bonus_amount + reimbursement_amount)` | TODO | | | P3a.3 output; spec L45-46, L106-111 | | |
| P3a.5 | Four immutability triggers: `price_sheets`, `price_sheet_rates`, `commissions`, `payout_lines` | TODO | | | P3a.2-P3a.4 output | | |
| P3a.6 | `publish_price_sheet(uuid)` RPC — must ship with P3a.5 or publishing is impossible | TODO | | | P3a.5 trigger predicate | | |
| P3a.7 | RLS enable + policies on all 7 tables via `is_org_admin()`; read-back proving `0005` adds NO policy to `audit_log` | TODO | | | P3a.1 helper; `0001_foundation.sql:159-176` | | |
| P3a.8 | Verify (structural SQL: balanced `$$`, pure ASCII, CHECK values byte-matched), commit, Tier-A report | TODO | | | P3a.1-P3a.7 file only | | |

## P3-b — `0006_job_service_area.sql` + 26-community reseed (EXEC-GATED)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3b.1 | `0006_job_service_area.sql` — nullable `jobs.service_area_id` FK, own migration so it can revert independently | TODO | | | `0004_scheduling.sql:52-57,89-108` | | |
| P3b.2 | Additive reseed of BOTH `seed.sql` and `seed.hosted.sql` — keep ids `...0401`-`...0406`, append 20 rows `...0407`-`...041a`, no existing id rewritten; the hosted rows are ALREADY APPLIED to the live DB, so the append must be idempotent against it (`on conflict (id) do nothing`, plus a guarded `update ... where id = ... and <col> is null` for any correction — mirror the `converted_job_id` guard near the end of `seed.sql`) | TODO | | | `seed.sql:105-127`; `seed.hosted.sql` §5; the 26 names | | |
| P3b.3 | `app/supabase/README.md` ride (Rule 31) — register `0005` and `0006`; ALSO fix the stale L19 "6 service areas (placeholder … none are enumerated yet)" note, add the three unlisted `.hosted.` files (`seed.hosted.sql`, `tests/0001_foundation_rls.hosted.test.sql`, `tests/0004_scheduling_rls.hosted.test.sql`) to the Files table, and correct the stale L3-4 "No Supabase client lives here" claim | TODO | | | `README.md` L3-4, L11-21 | | |
| P3b.4 | Verify — 26 distinct service-area rows in EACH seed file (count via the `8000-0000000004` uuid pattern; baseline is 6 in both), zero id collisions, `on conflict (id) do nothing` still truthful | TODO | | | P3b.2 files only | | |
| P3b.5 | Commit + Tier-A report | TODO | | | | | |

## P3-c — Money core, pure TS (UNGATED — the R-A parallel track)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3c.1 | `money/types.ts` — `CommissionLine`, `PeriodPayResult`, `BonusResult`, `UnpaidSpanPolicy`. `CommissionLine` has NO reimbursement-shaped field (AC-9 compile-time half) | DONE ee4a4f8 | | | spec L100-122 quoted here; `state-machine.ts:63` | | |
| P3c.2 | `money/commission.ts` — `calculateCommission(job, priceSheet, policy)`; REJECTS any sheet whose `status !== 'published'` with a reason string; pure, reads no global | DONE ee4a4f8 | | | P3c.1 types; spec L73-80 | | |
| P3c.3 | `money/billable-hours.ts` — `deriveBillableHours`, summing `en_route_at -> completed_at`; emits `unpaidSpans` so travel/idle exclusion is a named policy field, not a query artifact | DONE ee4a4f8 | | | P3c.1 types; spec L113-116 | | |
| P3c.4 | `money/bonus.ts` — `BonusRule.evaluate(period, tech, jobs[])` + `NullBonusRule` (amount 0, reason string). Invent NO bonus formula; mark the seam | DONE ee4a4f8 | | | P3c.1 types; spec L117-120 | | |
| P3c.5 | `money/rollup.ts` — `rollUpPeriodPay`; breakdown only, `total` derived over the parts, never a single number | DONE ee4a4f8 | | | P3c.2-P3c.4 signatures; spec L106-111 | | |
| P3c.6 | Test-runner wiring — `"test": "node --test ..."` in `app/package.json` + `money/__assertions__/rollup.assert.ts` | DONE ee4a4f8 | | | `app/package.json:11-16,29` | | |
| P3c.7 | Verify AC-8 (2 jobs 2.0h+1.5h, base 25, commissions 40+60, receipt 18.75, NullBonus -> total 206.25 itemized), AC-9 (byte-identical with and without the receipt), AC-6 pure half (v1 rate 100 -> line; publish v2 rate 200; recompute from the snapshot id -> identical to the cent) | DONE ee4a4f8 | | | P3c.6 assertions only | | |
| P3c.8 | Commit + Tier-A report | DONE ee4a4f8 | | | | | |

## P3-d — Module shell (ungated)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3d.1 | `src/data/ports.ts` — every repo interface; `JobSchedulingPatch = Partial<Pick<Job,'assignedTechId'|'scheduledStart'|'scheduledEnd'|'requestedWindow'>>` so `{status: ...}` is a TS excess-property error (AC-4 mechanism 1) | DONE 705613f | | | `state-machine.ts:202-220`; `packages/core` Job type | | |
| P3d.2 | `src/lib/module-session.ts` — returns a pre-narrowed `{org, role, userId} \| null` so no `status ===` discriminant ever appears (AC-4 grep-trap fix) | DONE 705613f | | | `module-sdk/src/index.ts:65-78` | | |
| P3d.3 | `src/screens/AdminFinanceRoot.tsx` — the ONE route; internal state-driven switcher, because only `routes[0]` renders | DONE 705613f | | | `app/apps/mobile/app/m/[moduleId].tsx:52-58`; `packages/ui/src/index.ts:1-7` | | |
| P3d.4 | `src/index.ts` manifest fill — `routes: [AdminFinanceRoot]`, nav entries, `jobActions`, `migrations: ['0005_money.sql','0006_job_service_area.sql']` | DONE 705613f | | | `src/index.ts:52-54` (61-line stub) | | |
| P3d.5 | Verify — `npm run typecheck` exit 0, `npm run lint` clean, AC-3 static half (`grep -rn "admin-finance" app/apps/mobile/app app/apps/mobile/src` returns exactly one hit, `modules.ts:12`) | DONE 705613f | | | P3d.1-P3d.4 files only | | |
| P3d.6 | Commit + Tier-A report | DONE 705613f | | | | | |

## P3-e — Lead inbox (ungated)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3e.1 | `domain/lead.ts` — `Lead` type mirroring `leads` (`attach_timing` is plain text) | TODO | | | `0004_scheduling.sql:64-82` | | |
| P3e.2 | `domain/lead-readiness.ts` — `classifyLead` / `missingFields`. Incomplete leads are first-class: never hidden, never defaulted | TODO | | | P3e.1 type; spec L50-53 | | |
| P3e.3 | `fixtures/leads.ts` — including the hero lead with null `preferred_date` and null `address` | TODO | | | P3e.1-P3e.2 | | |
| P3e.4 | `components/LeadRow.tsx` — three axis fields visible, `needs info` badge | TODO | | | P3e.2; `packages/ui` primitives | | |
| P3e.5 | `screens/LeadInboxScreen.tsx` — unconverted leads, newest first, props-in / callbacks-out against `ports.ts` | TODO | | | P3d.1 ports; P3e.3-P3e.4 | | |
| P3e.6 | Verify AC-1 — `classifyLead(heroLead) === 'needs_info'`, `missingFields` deep-equals `['preferredDate','address']`, row renders (not filtered) | TODO | | | P3e.2-P3e.3 only | | |
| P3e.7 | Commit + Tier-A report | TODO | | | | | |

## P3-f — Qualify (authoring ungated)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3f.1 | `domain/transition.ts` — the module's SOLE `applyTransition` call site + an ESLint `no-restricted-imports` entry enforcing it on the existing `lint` script (AC-4 mechanisms 3 and 4) | TODO | | | `state-machine.ts:172,202-249`; `app/package.json:14` | | |
| P3f.2 | `domain/qualify.ts` — `validateQualify` / `buildJobFromLead`; resolves `service_area_id`; distinguishes "outside the area" from "address unknown" | TODO | | | P3e.2; P3b.1 column; spec L55-57 | | |
| P3f.3 | `components/AxisPicker.tsx` — `source` / `payer` / `attach_timing`, values byte-matched to `0004_scheduling.sql` | TODO | | | `0004_scheduling.sql:95-97` | | |
| P3f.4 | `screens/QualifyScreen.tsx` — submit disabled until validation passes | TODO | | | P3f.2-P3f.3 | | |
| P3f.5 | `flows/qualify-lead.ts` — create job in `new`, advance to `qualified` via P3f.1, stamp `converted_job_id` + `qualified_at` | TODO | | | P3f.1-P3f.2; `state-machine.ts:115` | | |
| P3f.6 | Verify — AC-2 authoring half; AC-4 `grep -rn "status *=" app/modules/admin-finance/src` returns ZERO RAW LINES, not zero-after-adjudication | TODO | | | P3f.1-P3f.5 files only | | |
| P3f.7 | Commit + Tier-A report | TODO | | | | | |

## P3-g — Assignment board (authoring ungated)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3g.1 | `domain/time-window.ts` — `overlaps()`, ~20 lines of `Date.getTime()`. Add NO dependency | TODO | | | none | | |
| P3g.2 | `domain/assignment-warnings.ts` — `warningsFor()` returns warnings, never a boolean block: tech overlap + `service_area_id is null` | TODO | | | P3g.1; P3b.1 column; spec L65-66 | | |
| P3g.3 | `components/TechColumn.tsx` — local status chip over `colors.info` / `colors.warning`; `JOB_STATUS_COLORS` stays in `apps/mobile` | TODO | | | `packages/ui/src/tokens.ts:54-59` | | |
| P3g.4 | `components/WarningSheet.tsx` — confirm is ALWAYS enabled (warn, do not hard-block) | TODO | | | P3g.2 | | |
| P3g.5 | `screens/AssignmentBoardScreen.tsx` — day/week board of `qualified` + `scheduled` against active techs | TODO | | | P3g.3-P3g.4; P3d.1 ports | | |
| P3g.6 | `flows/assign-job.ts` — sets `assigned_tech_id`, writes `job_assignments`, drives `qualified -> scheduled -> assigned` (TWO edges, one flow) via P3f.1 | TODO | | | `state-machine.ts:116-117`; `0004_scheduling.sql:121` | | |
| P3g.7 | Verify — AC-3 authoring half (calendar renders it with no admin-module code involved), AC-4 grep still zero | TODO | | | P3g.1-P3g.6 files only | | |
| P3g.8 | Commit + Tier-A report | TODO | | | | | |

## P3-h — Close-out and commission recording (write gated)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3h.1 | `domain/closeout.ts` — `awaitingCloseOut` (via `Set.has()`, never a `status ===`) and `closeOutBlockers` surfacing `canTransition`'s reason string verbatim | TODO | | | `state-machine.ts:95-106,128-138` | | |
| P3h.2 | `screens/CloseOutQueueScreen.tsx` — awaiting-close-out queue showing each blocker reason | TODO | | | P3h.1 | | |
| P3h.3 | `screens/CloseOutReviewScreen.tsx` — photos and quality notes, then close | TODO | | | P3h.2; P3d.1 ports | | |
| P3h.4 | `flows/close-out-job.ts` — on a successful `completed -> paid`, write exactly ONE `commissions` row carrying both snapshot ids and who closed it; not contingent on any review | TODO | | | P3c.2 signature; P3a.3 columns; spec L68-80 | | |
| P3h.5 | Verify — AC-5 structural half (the partial unique index is the enforcement, not app code); DB half OPEN pending Supabase | TODO | | | P3h.4 file only | | |
| P3h.6 | Commit + Tier-A report | TODO | | | | | |

## P3-i — Price-sheet editor (split: pure half ungated, publish gated)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3i.1 | `money/publish-plan.ts` — pure `planPublish(sheet, priorPublished, now): PublishPlan`. Version is assigned AT DRAFT CREATION (`max(version)+1`), not at publish, or the row mutates against `unique (organization_id, version)` and races concurrent publishers | TODO | | | P3a.2 constraints; P3a.6 RPC | | |
| P3i.2 | `data/price-sheet-repo.ts` — `PriceSheetRepo` interface + the `publish_price_sheet` RPC call | TODO | | | P3i.1; P3d.1 ports | | |
| P3i.3 | `screens/PriceSheetListScreen.tsx` — draft / published / superseded | TODO | | | P3i.2 | | |
| P3i.4 | `screens/PriceSheetEditorScreen.tsx` — grid, rows = services, columns = `attach_timing`, editable ONLY while draft | TODO | | | P3i.2-P3i.3; spec L82-85 | | |
| P3i.5 | Verify — `planPublish` fixture assertions (version arithmetic + supersede semantics); DB half OPEN | TODO | | | P3i.1 only | | |
| P3i.6 | Commit + Tier-A report | TODO | | | | | |

## P3-j — Edge Function `price-sheet-current` (EXEC-GATED)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3j.1 | `app/supabase/functions/deno.json` — the layout precedent row; `functions/` does not exist yet | TODO | | | `app/supabase/` listing | | |
| P3j.2 | `functions/price-sheet-current/handler.ts` — pure `buildFeed(sheet, rates): FeedBody`, fixture-provable without Deno or a DB; selects NOTHING but published sheets and their rates | TODO | | | P3a.2 columns; spec L89-92 | | |
| P3j.3 | `functions/price-sheet-current/index.ts` — GET-only `Deno.serve`, 405 otherwise, service-role read, `Cache-Control`, no auth by design | TODO | | | P3j.2 | | |
| P3j.4 | `app/supabase/README.md` `## Edge Functions` ride (Rule 31) — records that deploy REQUIRES `--no-verify-jwt` / `verify_jwt = false`; a default-deployed function rejects anonymous callers and silently fails AC-7 | TODO | | | `README.md` tail | | |
| P3j.5 | Verify — `buildFeed` fixture assertion; AC-7 and verify-5 recorded OPEN (Supabase-gated) | TODO | | | P3j.2 only | | |
| P3j.6 | Commit + Tier-A report | TODO | | | | | |

## P3-k — Reimbursement approval and payout batches (split)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3k.1 | `money/payout-batch.ts` — pure `buildPayoutBatch`, freezing each line BY VALUE COPY with `frozen_at` and a source hash | TODO | | | P3c.5 `PeriodPayResult`; P3a.4 columns | | |
| P3k.2 | `data/reimbursement-repo.ts` + `data/payout-batch-repo.ts` — approve / reject (reason required on reject) | TODO | | | P3a.4 columns; P3d.1 ports | | |
| P3k.3 | `screens/ReimbursementQueueScreen.tsx` | TODO | | | P3k.2 | | |
| P3k.4 | `screens/PayoutBatchScreen.tsx` — carries the literal banner "Records only - this app does not move money" | TODO | | | P3k.1-P3k.2; spec L124-128 | | |
| P3k.5 | `money/__assertions__/payout-freeze.assert.ts` — a frozen line survives a later rate change unchanged | TODO | | | P3k.1 | | |
| P3k.6 | Verify — the freeze assertion passes; AC-9 re-checked (no negative adjustment reaches any commission line) | TODO | | | P3k.5 only | | |
| P3k.7 | Commit + Tier-A report | TODO | | | | | |

## P3-l — Reporting (ungated)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3l.1 | `reporting/group-by.ts` — `byStatus` / `bySource` / `byAttachTiming`, pure | TODO | | | `0004_scheduling.sql:95-97`; spec L130-133 | | |
| P3l.2 | `reporting/slot-hit-rate.ts` — `requested_window` is untyped text, so an unparseable value counts as `unknown`, NEVER a hit or a miss. Document the parse contract in the file | TODO | | | `0004_scheduling.sql:86-88,98` | | |
| P3l.3 | `reporting/revenue.ts` — revenue and commission by service and period, read from `commissions` SNAPSHOT amounts, never recomputed | TODO | | | P3a.3 columns | | |
| P3l.4 | `screens/ReportsScreen.tsx` — no charting dependency | TODO | | | P3l.1-P3l.3 | | |
| P3l.5 | Verify — fixture assertions for all three pure modules incl. the unparseable-window case | TODO | | | P3l.1-P3l.3 only | | |
| P3l.6 | Commit + Tier-A report | TODO | | | | | |

## P3-m — `app/supabase/tests/0005_money_rls.test.sql` (EXEC-GATED)

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3m.1 | Fixture plant under `reset role` FIRST, then owner-sees-N on all 7 tables — the falsifiability gate, so the later probes cannot pass vacuously | TODO | | | `tests/0004_scheduling_rls.test.sql` pattern; P3a.2-P3a.4 | | |
| P3m.2 | Zero-row probes for `tech` AND `sales` on all 7 tables, plus a point-lookup-by-PK variant (AC-10 / verify-7). Testing only `tech` under-covers the AC | TODO | | | P3m.1 | | |
| P3m.3 | Trigger-denial and survival probes, run under `reset role` as well as authenticated owner — passing under `reset role` is the point: it proves the guarantee is a TRIGGER, not RLS. AC-6 captures `amount::text` (text, not numeric: `100.00 = 100.0` is TRUE and would hide scale drift) | TODO | | | P3a.5 triggers | | |
| P3m.4 | `audit_log` policy-count canary — `select count(*) from pg_policies where tablename='audit_log'` must equal exactly 2 with zero UPDATE/DELETE; plus README registration (Rule 31) | TODO | | | `0001_foundation.sql:159-176`; `README.md` tests section | | |
| P3m.5 | Commit + Tier-A report | TODO | | | | | |

## P3-n — Phase close

| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3n.1 | Full AC sweep, 1-10, each PASS carrying its evidence and each gated item recorded OPEN, never PASSED. Includes verify-8: `grep -rn "sdassemblypro\|GTM-\|G-93R" app/modules/admin-finance` returns zero | TODO | | | every group's Forward contracts cells | | |
| P3n.2 | Phase Tier-A build report with the `Forward contracts:` field and the DEFERRED table | TODO | | | P3n.1 | | |
| P3n.3 | Ledger close — every row DONE, every Context out cell filled, commit naming the hash | TODO | | | this ledger | | |
| P3n.4 | Checkpoint + yield (Rule 10) | TODO | | | | | |

## Out of scope

P4 tech-facing screens (greeting, checklists, photo capture, earnings view) - P5 payment capture, the
QR handoff page, reviews - P6 social posting and the review library - P7 real website intake adapters
and push notifications - any change to sdassemblypro.com, its PHP, its forms, or its GTM/GA4 tags
(permanently out of scope) - any card data anywhere in the app or database (zero PCI scope).

## Carried debts from P2 (not P3 rows; do not read the P2 ledger for these)

- State-machine unit suite (P2b.3) - unblocked once P3c.6 lands a test runner.
- Offline `replay` wiring (P2-d).
- Re-run `handoff/P2E-AIRPLANE-MODE-TEST.md` once a job data seam lands (P2-e) - P3d.1 is that seam.
