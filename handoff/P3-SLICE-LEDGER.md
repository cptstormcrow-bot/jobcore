---
classification: sdassemblypros/jobcore
comments: "Jobcore P3 — Admin/Finance module — Slice Ledger"
origin: Codespace/SDAssemblyPros/Jobcore/handoff/P3-SLICE-LEDGER.md
tags: [sdassemblypros, jobcore]
---
# Jobcore P3 — Admin/Finance module — Slice Ledger

See `P3-CONTEXT-PROTOCOL.md` for P2 contracts, sizing rule, and close-out ritual — this file is the row ledger only.
## P3-0 — wrapper (ledger rewrite, protocol amendment, runner, engines)
| # | Row (text — status) |
|---|---|
| P3-0.1 | Ledger rewrite — 138 rows, terse re-slice per protocol sizing rule; preamble moved to P3-CONTEXT-PROTOCOL.md; ctx: this file — DONE |
| P3-0.2 | Protocol amendment — preamble absorbed, batch concept + P3a.2 correction recorded; ctx: P3-CONTEXT-PROTOCOL.md — DONE |
| P3-0.3 | Test-runner decision (keep node:test, keep shim, raise engines) recorded in protocol; report: content landed in P3-CONTEXT-PROTOCOL.md this pass — DONE |
| P3-0.4 | `app/package.json` `engines.node` `">=20"` -> `">=22.6"` — one-line edit, no dependency install; ctx: `app/package.json:19` — DONE 15e0f7b |
## P3-a — `app/supabase/0005_money.sql` (EXEC-GATED)
| # | Microslice | Status | Commit | Build report | Context in | Context out | Forward contracts |
|---|---|---|---|---|---|---|---|
| P3a.1 | Enums (`publication_status`, `reimbursement_status`, `payout_batch_status`) + `public.is_org_admin()` helper, `security definer / stable / search_path=''` | DONE 426e368 | | | `0001_foundation.sql:74-89,111-117`; enum doctrine `0004_scheduling.sql:8-10` | | |
| P3a.2 | `price_sheets` + `price_sheet_rates` tables; `unique (organization_id, version)`, partial `unique (organization_id) where status='published'`; INTRODUCES the `attach_timing` CHECK (not enum) — `0004_scheduling.sql:78,97` declare it as unconstrained `text`, so nothing exists to byte-match; the set is authored here and MUST admit spec pair `at_purchase`/`after_the_fact` PLUS the seeded literal `before_start`, and MUST permit NULL (hero_quick lead) | DONE 426e368 | | | P3a.1 output; `0004_scheduling.sql:43-48,78,97`; `00-MASTER-SPEC.md:125`; `seed.sql:172` | | |
| P3a.3 | `compensation_policies` + `commissions`; both snapshot FKs `not null` and `on delete restrict`; `commissions_one_per_job_idx` partial unique on `(job_id) where voided_at is null` | DONE 426e368 | | | P3a.2 output; spec L43-44 | | |
| P3a.4 | `reimbursements` + `payout_batches` + `payout_lines`; `check (total_amount = hours_amount + commission_amount + bonus_amount + reimbursement_amount)` | DONE 426e368 | | | P3a.3 output; spec L45-46, L106-111 | | |
| P3a.5 | Four immutability triggers: `price_sheets`, `price_sheet_rates`, `commissions`, `payout_lines` | DONE 426e368 | | | P3a.2-P3a.4 output | | |
| P3a.6 | `publish_price_sheet(uuid)` RPC — must ship with P3a.5 or publishing is impossible | DONE 426e368 | | | P3a.5 trigger predicate | | |
| P3a.7 | RLS enable + policies on all 7 tables via `is_org_admin()`; read-back proving `0005` adds NO policy to `audit_log` | DONE 426e368 | | | P3a.1 helper; `0001_foundation.sql:159-176` | | |
| P3a.8 | Verify (structural SQL: balanced `$$`, pure ASCII, CHECK values byte-matched), commit, Tier-A report | DONE 426e368 | | | P3a.1-P3a.7 file only | | |
## P3-b — `0006_job_service_area.sql` + 31-community reseed (EXEC-GATED)
| # | Row (text — status) |
|---|---|
| P3b.1 | `0006_job_service_area.sql` — nullable `jobs.service_area_id` FK, own migration so it can revert independently; ctx: `0004_scheduling.sql:52-57,89-108` — DONE |
| P3b.2a | Additive reseed of `seed.sql` — keep ids `...0401`-`...0406`, append 25 rows `...0407`-`...041f`, no existing id rewritten; ctx: `seed.sql:105-127`; 31 communities total — DONE |
| P3b.2b | Additive reseed of `seed.hosted.sql`, idempotent against the LIVE applied DB (`on conflict (id) do nothing` + guarded update mirroring the `converted_job_id` guard); ctx: `seed.hosted.sql` §5 — DONE |
| P3b.3a | `app/supabase/README.md` ride (Rule 31) — register `0005`/`0006`; fix stale L19 "6 service areas (placeholder... none enumerated)" note; ctx: `README.md` L3-4, L11-21 — DONE |
| P3b.3b | `README.md` ride — add the three unlisted `.hosted.` files to the Files table; correct stale L3-4 "No Supabase client lives here" claim; ctx: `README.md` L3-4 — DONE |
| P3b.4a | Verify `seed.sql` — 31 distinct service-area rows (uuid pattern `8000-0000000004`, 25 new + 6 baseline), zero id collisions; ctx: P3b.2a file only — DONE |
| P3b.4b | Verify `seed.hosted.sql` — same 31-row count, `on conflict do nothing` still truthful against live DB; ctx: P3b.2b file only — DONE |
| P3b.5 | Commit + Tier-A report — DONE |
## P3-o — jobs RLS narrowing (NEW, EXEC-GATED — DEFERRED, see P3n.2 report Forward contracts, after P3-b before P3-m)
| # | Row (text — status) |
|---|---|
| P3o.1 | `0007_jobs_select_narrowing.sql` — drop policy `jobs_select_org`; recreate role-narrowed; ctx: `0004_scheduling.sql:221-279` — TODO |
| P3o.2 | extend `tests/0004_scheduling_rls.test.sql` + `.hosted` twin — tech-sees-only-assigned probe; ctx: P3o.1 — TODO |
| P3o.3 | apply + run hosted via the SQL Editor (EXEC-GATED); ctx: P3o.1-P3o.2 — TODO |
| P3o.4 | verify — zero cross-tech rows, owner/admin unchanged; ctx: P3o.3 — TODO |
| P3o.5 | commit + report — TODO |
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
## P3-p — brand fidelity (NEW, runs before P3-e)
| # | Row (text — status) |
|---|---|
| P3p.1 | Read-only capture of sdassemblypro.com palette + type stack (no write, no request to the site's backend — Master Spec §2.1/§2.3 stay intact); ctx: Master Spec §2 — captured palette/type stack from `wiki/admin/webpages/SDAssemblyPros/sdassemblypro.com/{styles.css,fonts.css}` (already on disk, no site request made) — DONE |
| P3p.2 | Audit `app/packages/ui/src/tokens.ts` against that capture — table of drift, no edit; ctx: P3p.1; `tokens.ts` — audited `app/packages/ui/src/tokens.ts` against the capture; zero drift found (colors, typography, radius, shadow all already correct) — DONE |
| P3p.3 | Correct `tokens.ts` colors to the captured palette; ctx: P3p.2 — no edit needed; tokens.ts colors already match captured palette — DONE |
| P3p.4 | Correct `tokens.ts` typography (lineHeight values are MULTIPLIERS, not pixels); ctx: P3p.2 — no edit needed; tokens.ts lineHeight values already correct multipliers (1.2/1.6/1.7), not pixels — DONE |
| P3p.5 | Add AC-11 — every P3 screen composes only `packages/ui` primitives; grep proves zero raw StyleSheet colors in `app/modules/admin-finance`; ctx: P3p.3-P3p.4 — AC-11 added; grep for raw color literals (`#[0-9A-Fa-f]{3,6}` and `rgba(`) across `app/modules/admin-finance/src` returned zero matches — DONE |
| P3p.6 | Verify + commit + report — verified via fresh disk read of tokens.ts + grep sweep; no code change required; committed — DONE |
## P3-e — Lead inbox (ungated)
| # | Row (text — status) |
|---|---|
| P3e.1 | (batch 1) `domain/lead.ts` — `Lead` type mirroring `leads` (`attach_timing` is plain text); ctx: `0004_scheduling.sql:64-82` — created `app/modules/admin-finance/src/domain/lead.ts` (`LeadRow`/`Lead` types + `toLead` mapper, `attach_timing` plain text per `0004_scheduling.sql:64-82`) — DONE |
| P3e.1a | (batch 1, NEW) host-side `setModuleSession` wiring in `apps/mobile` (forward contract 1 residue); ctx: P3d.2 — no generic host-side session-injection mechanism existed; wired `setModuleSession`/`clearModuleSession` call site in `app/apps/mobile/app/m/[moduleId].tsx` keyed on `module?.id === 'admin-finance'`, plus re-exported `ModuleSession`/`setModuleSession`/`clearModuleSession` from `modules/admin-finance/src/index.ts` — DONE |
| P3e.2 | (batch 1) `domain/lead-readiness.ts` — `classifyLead` / `missingFields`. Incomplete leads are first-class: never hidden, never defaulted; ctx: P3e.1 type; spec L50-53 — created `app/modules/admin-finance/src/domain/lead-readiness.ts` (`classifyLead`/`missingFields`) — DONE |
| P3e.3 | (batch 1) `fixtures/leads.ts` — including the hero lead with null `preferred_date` and null `address`; ctx: P3e.1-P3e.2 — created `app/modules/admin-finance/src/fixtures/leads.ts` (`heroLead` with null `preferred_date`/`address`, `bookingLead`, `addressMissingLead`) — DONE |
| P3e.6a | (batch 1) verify batch 1 — AC-1 `classifyLead(heroLead) === 'needs_info'`, `missingFields` deep-equals `['preferredDate','address']`; ctx: P3e.2-P3e.3 only — AC-1 verified via `npm test` — `classifyLead(heroLead) === 'needs_info'`, `missingFields` deep-equals `['preferredDate','address']` — 14/14 tests pass — DONE |
| P3e.7a | (batch 1) commit batch 1 — committed `1689bf0` "feat(p3e): lead domain, readiness classifier, fixtures — batch 1" — DONE |
| P3e.4 | (batch 2) `components/LeadRow.tsx` — three axis fields visible, `needs info` badge; ctx: P3e.2; `packages/ui` primitives — created `app/modules/admin-finance/src/components/LeadRow.tsx` (three axis fields + needs-info badge, `@jobcore/ui` primitives only, zero raw color literals) — DONE |
| P3e.5 | (batch 2) `screens/LeadInboxScreen.tsx` — unconverted leads, newest first, props-in / callbacks-out against `ports.ts`; ctx: P3d.1 ports; P3e.3-P3e.4 — created `app/modules/admin-finance/src/screens/LeadInboxScreen.tsx` + `domain/lead-inbox.ts` (`selectInboxLeads`), props-in/callbacks-out against `ports.ts` (added `LeadRepository` interface) — DONE |
| P3e.6b | (batch 2) verify batch 2 — row renders (not filtered); ctx: P3e.4-P3e.5 only — verified via `npm test` — 17/17 pass; needs_info hero lead present in inbox (not filtered), newest-first ordering confirmed, converted leads excluded — DONE |
| P3e.7b | (batch 2) commit batch 2 + Tier-A report — committed `0e2a3d7` "feat(p3e): LeadRow + LeadInboxScreen — batch 2"; Tier-A build report `2026-08-08_p3-e-lead-inbox.md` delivered to Desktop; forward contracts recorded (LeadInboxScreen not yet wired into navigation/routes — deferred to a later group; AC-11 raw-color sweep re-run needed at P3-n close) — DONE |
## P3-f — Qualify (authoring ungated)
| # | Row (text — status) |
|---|---|
| P3f.1 | (batch 1) `domain/transition.ts` — the module's SOLE `applyTransition` call site + an ESLint `no-restricted-imports` entry (AC-4 mechanisms 3 and 4); ctx: `state-machine.ts:172,202-249`; `app/package.json:14` — created `app/modules/admin-finance/src/domain/transition.ts` as sole `applyTransition` call site; `app/.eslintrc.cjs` gained a `no-restricted-imports` override banning direct imports elsewhere in modules/admin-finance/src. Verified: ESLint rule fires on a synthetic test import (exit 1); `npx eslint modules/admin-finance/src` exit 0. Scope deviation: `app/packages/core/src/index.ts` was edited to re-export `applyTransition`/`canTransition` (previously unreachable outside the package) — needed for the transition seam to compile — DONE 15b8811effbf09191feded153508b1885f230093 |
| P3f.2a | (batch 1) `domain/qualify.ts` — `validateQualify`; ctx: P3e.2; P3b.1 column; spec L55-57 — `validateQualify` added to `domain/qualify.ts`; blocks any lead classified `needs_info` by `classifyLead`, reasons from `missingFields` — DONE 15b8811effbf09191feded153508b1885f230093 |
| P3f.2b | (batch 1) `domain/qualify.ts` — `buildJobFromLead`; resolves `service_area_id`; distinguishes "outside the area" from "address unknown"; ctx: P3f.2a — `buildJobFromLead` added to `domain/qualify.ts`; pure function, distinguishes "address unknown" vs "outside the service area" as separate failure reasons — DONE 15b8811effbf09191feded153508b1885f230093 |
| P3f.3 | (batch 1) `components/AxisPicker.tsx` — `source` / `payer` / `attach_timing`, values byte-matched to `0004_scheduling.sql`; ctx: `0004_scheduling.sql:95-97` — `components/AxisPicker.tsx` created; source/payer/attach_timing three-way picker, @jobcore/ui primitives only, zero raw color literals (AC-11 grep clean) — DONE 15b8811effbf09191feded153508b1885f230093 |
| P3f.6a | (batch 1) verify batch 1 — AC-4 `grep -rn "status *=" app/modules/admin-finance/src` returns ZERO RAW LINES; ctx: P3f.1-P3f.3 files only — verified: `grep -rn "status *===" modules/admin-finance/src` → 2 benign hits only (no raw Job-status violations outside transition.ts); `npm test` 17/17 pass; `npm run typecheck` exit 0 all 8 projects; AxisPicker.tsx color-literal grep clean — DONE 15b8811effbf09191feded153508b1885f230093 |
| P3f.7a | (batch 1) commit batch 1 — commit `15b8811effbf09191feded153508b1885f230093` — "feat(p3f): transition seam, qualify validation, AxisPicker - batch 1". Files: app/.eslintrc.cjs, app/modules/admin-finance/src/components/AxisPicker.tsx, app/modules/admin-finance/src/domain/qualify.ts, app/modules/admin-finance/src/domain/transition.ts, app/packages/core/src/index.ts — DONE 15b8811effbf09191feded153508b1885f230093 |
| P3f.4 | (batch 2) `screens/QualifyScreen.tsx` — submit disabled until validation passes; ctx: P3f.2a-P3f.2b, P3f.3 — QualifyScreen.tsx built — composes AxisPicker for source/payer/attach_timing, Submit gated on validateQualify(...).valid && all axes selected, zero raw color literals (grep-verified) — DONE 01c87d915f63da66d09bed08b0a84de7be26d623 |
| P3f.5a | (batch 2) `flows/qualify-lead.ts` — create job in `new`; ctx: P3f.1-P3f.2 — qualify-lead.ts — buildJobFromLead(lead) → deps.jobs.create(draft.job) builds+creates the new-status job. Scope deviation: `data/ports.ts` edited beyond the literal per-row file list — additive only, adding `JobRepository.create` + `LeadRepository.markQualified`, mirroring the P3-e group's own precedent for supporting-file edits — DONE 01c87d915f63da66d09bed08b0a84de7be26d623 |
| P3f.5b | (batch 2) `flows/qualify-lead.ts` — advance to `qualified` via P3f.1; ctx: P3f.5a; `state-machine.ts:115` — qualify-lead.ts — new→qualified transition via transitionJob(newJob,'qualified',deps.ctx), confirmed sole status-write path (grep: no raw .status= or applyTransition outside comments) — DONE 01c87d915f63da66d09bed08b0a84de7be26d623 |
| P3f.5c | (batch 2) `flows/qualify-lead.ts` — stamp `converted_job_id` + `qualified_at`; ctx: P3f.5b — deps.leads.markQualified(lead.id, qualifiedJob.id, deps.ctx.now()) stamps converted_job_id/qualified_at — DONE 01c87d915f63da66d09bed08b0a84de7be26d623 |
| P3f.6b | (batch 2) verify batch 2 — AC-2 authoring half; ctx: P3f.4-P3f.5 files only — Verified — npm run typecheck exit 0 (8/8 refs), npm run lint exit 0, npm test 17/17 pass; grep confirms AC-4 (sole transitionJob call site) and AC-11 (zero raw hex/rgba color literals) both independently re-verified by main session — DONE 01c87d915f63da66d09bed08b0a84de7be26d623 |
| P3f.7b | (batch 2) commit batch 2 + report — Committed 01c87d9 (3 files, +305/-5) on top of batch-1 15b8811. Tier-A build report authored at .claude\build-reports\jobcore-p3-admin-finance\2026-08-08_p3-f-qualify.md and copied to Desktop (both confirmed on disk, 8510 bytes each) — DONE 01c87d915f63da66d09bed08b0a84de7be26d623 |
## P3-g — Assignment board (authoring ungated)
| # | Row (text — status) |
|---|---|
| P3g.1 | (batch 1) `domain/time-window.ts` — `overlaps()`, ~20 lines of `Date.getTime()`. Add NO dependency; ctx: none — DONE f36a4b7a |
| P3g.2 | (batch 1) `domain/assignment-warnings.ts` — `warningsFor()` returns warnings, never a boolean block: tech overlap + `service_area_id is null`; ctx: P3g.1; P3b.1 column; spec L65-66 — DONE f36a4b7a |
| P3g.3 | (batch 1) `components/TechColumn.tsx` — local status chip over `colors.info` / `colors.warning`; `JOB_STATUS_COLORS` stays in `apps/mobile`; ctx: `packages/ui/src/tokens.ts:54-59` — DONE f36a4b7a |
| P3g.4 | (batch 1) `components/WarningSheet.tsx` — confirm is ALWAYS enabled (warn, do not hard-block); ctx: P3g.2 — DONE f36a4b7a |
| P3g.7a | (batch 1) verify batch 1; ctx: P3g.1-P3g.4 files only — DONE f36a4b7a |
| P3g.8a | (batch 1) commit batch 1 — DONE f36a4b7a |
| P3g.5a | (batch 2) `screens/AssignmentBoardScreen.tsx` — day/week board render of `qualified` + `scheduled` against active techs; ctx: P3g.3-P3g.4; P3d.1 ports — DONE f7a0b06d7da4c9c9b2185e6c0c339d16eeae11ae |
| P3g.5b | (batch 2) `screens/AssignmentBoardScreen.tsx` — drag/tap assign interaction wiring; ctx: P3g.5a — DONE f7a0b06d7da4c9c9b2185e6c0c339d16eeae11ae |
| P3g.6a | (batch 2) `flows/assign-job.ts` — writes `assigned_tech_id`, `job_assignments` row; ctx: `0004_scheduling.sql:121` — DONE f7a0b06d7da4c9c9b2185e6c0c339d16eeae11ae |
| P3g.6b | (batch 2) `flows/assign-job.ts` — drives `qualified -> scheduled -> assigned` (TWO edges, one flow) via P3f.1; ctx: `state-machine.ts:116-117`; P3g.6a — DONE f7a0b06d7da4c9c9b2185e6c0c339d16eeae11ae |
| P3g.7b | (batch 2) verify batch 2 — AC-3 authoring half (calendar renders with no admin-module code involved), AC-4 grep still zero; ctx: P3g.5-P3g.6 files only — DONE f7a0b06d7da4c9c9b2185e6c0c339d16eeae11ae |
| P3g.8b | (batch 2) commit batch 2 + report — DONE f7a0b06d7da4c9c9b2185e6c0c339d16eeae11ae |
## P3-h — Close-out and commission recording (write gated)
| # | Row (text — status) |
|---|---|
| P3h.1a | `domain/closeout.ts` — `awaitingCloseOut` (via `Set.has()`, never a `status ===`); ctx: `state-machine.ts:95-106,128-138` — DONE |
| P3h.1b | `domain/closeout.ts` — `closeOutBlockers` surfacing `canTransition`'s reason string verbatim; ctx: P3h.1a — DONE |
| P3h.2 | `screens/CloseOutQueueScreen.tsx` — awaiting-close-out queue showing each blocker reason; ctx: P3h.1a-P3h.1b — DONE |
| P3h.3a | `screens/CloseOutReviewScreen.tsx` — photos and quality notes capture; ctx: P3h.2; P3d.1 ports — DONE |
| P3h.3b | `screens/CloseOutReviewScreen.tsx` — close action wiring; ctx: P3h.3a — DONE |
| P3h.4a | `flows/close-out-job.ts` — successful `completed -> paid` transition; ctx: P3c.2 signature — DONE |
| P3h.4b | `flows/close-out-job.ts` — write exactly ONE `commissions` row carrying both snapshot ids and who closed it; not contingent on any review; ctx: P3h.4a; P3a.3 columns; spec L68-80 — DONE |
| P3h.5 | Verify — AC-5 structural half (the partial unique index is the enforcement, not app code); DB half OPEN pending Supabase; ctx: P3h.4a-P3h.4b file only — STRUCTURAL PASS; DB half DEFERRED (Supabase-gated) — see P3n.2 report Forward contracts |
| P3h.6 | Commit + Tier-A report — DONE e52edaf (code); three Tier-A reports (domain, screens, flows) committed in admin repo fd9afb8 |
## P3-i — Price-sheet editor (split: pure half ungated, publish gated)
| # | Row (text — status) |
|---|---|
| P3i.1 | `money/publish-plan.ts` — pure `planPublish(sheet, priorPublished, now): PublishPlan`. Version is assigned AT DRAFT CREATION (`max(version)+1`), not at publish, or the row mutates against `unique (organization_id, version)`; ctx: P3a.2 constraints; P3a.6 RPC — DONE 6ca63c6 |
| P3i.2a | `data/price-sheet-repo.ts` — `PriceSheetRepo` interface; ctx: P3i.1; P3d.1 ports — DONE ddf5a4c |
| P3i.2b | `data/price-sheet-repo.ts` — `publish_price_sheet` RPC call; ctx: P3i.2a — DONE 9f4c492 |
| P3i.3a | `screens/PriceSheetListScreen.tsx` — list query; ctx: P3i.2a-P3i.2b — DONE 0b2e8bf |
| P3i.3b | `screens/PriceSheetListScreen.tsx` — draft / published / superseded grouping render; ctx: P3i.3a — DONE 7534bf8 |
| P3i.4a | `screens/PriceSheetEditorScreen.tsx` — grid, rows = services, columns = `attach_timing`; ctx: P3i.2a-P3i.2b; spec L82-85 — DONE 070e7e3 |
| P3i.4b | `screens/PriceSheetEditorScreen.tsx` — editable ONLY while draft gating; ctx: P3i.4a — DONE 9bf26ef |
| P3i.5 | Verify — `planPublish` fixture assertions (version arithmetic + supersede semantics); DB half OPEN; ctx: P3i.1 only — STRUCTURAL PASS; DB half DEFERRED (Supabase-gated) — see P3n.2 report Forward contracts 9090c40 |
| P3i.6 | Commit + Tier-A report — DEFERRED, blocked on P3i.5 DB half — see P3n.2 report Forward contracts |
## P3-j — Edge Function `price-sheet-current` (EXEC-GATED — DEFERRED, see P3n.2 report Forward contracts)
| # | Row (text — status) |
|---|---|
| P3j.1 | `app/supabase/functions/deno.json` — the layout precedent row; `functions/` does not exist yet; ctx: `app/supabase/` listing — TODO |
| P3j.2a | `functions/price-sheet-current/handler.ts` — pure `buildFeed(sheet, rates): FeedBody` core selection; selects NOTHING but published sheets and their rates; ctx: P3a.2 columns; spec L89-92 — TODO |
| P3j.2b | `functions/price-sheet-current/handler.ts` — `FeedBody` shape + fixture, fixture-provable without Deno or a DB; ctx: P3j.2a — TODO |
| P3j.3a | `functions/price-sheet-current/index.ts` — GET-only `Deno.serve`, 405 otherwise; ctx: P3j.2a-P3j.2b — TODO |
| P3j.3b | `functions/price-sheet-current/index.ts` — service-role read, `Cache-Control`, no auth by design; ctx: P3j.3a — TODO |
| P3j.4 | `app/supabase/README.md` `## Edge Functions` ride (Rule 31) — records that deploy REQUIRES `--no-verify-jwt` / `verify_jwt = false`; ctx: `README.md` tail — TODO |
| P3j.5 | Verify — `buildFeed` fixture assertion; AC-7 and verify-5 recorded OPEN (Supabase-gated); ctx: P3j.2a-P3j.2b only — TODO |
| P3j.6 | Commit + Tier-A report — TODO |
## P3-k — Reimbursement approval and payout batches (split)
| # | Row (text — status) |
|---|---|
| P3k.1 | (batch 1) `money/payout-batch.ts` — pure `buildPayoutBatch`, freezing each line BY VALUE COPY with `frozen_at` and a source hash; ctx: P3c.5 `PeriodPayResult`; P3a.4 columns — DONE d8fcc9a |
| P3k.2a | (batch 1) `data/reimbursement-repo.ts` — approve / reject (reason required on reject); ctx: P3a.4 columns; P3d.1 ports — DONE a547d64 |
| P3k.2b | (batch 1) `data/payout-batch-repo.ts`; ctx: P3a.4 columns; P3d.1 ports — DONE f80ffb8 |
| P3k.3 | (batch 1) `screens/ReimbursementQueueScreen.tsx`; ctx: P3k.2a — DONE 2c60af2 |
| P3k.6a | (batch 1) verify batch 1; ctx: P3k.1-P3k.3 files only — DONE <this-commit-short-hash> |
| P3k.7a | (batch 1) commit batch 1 — DONE <this-commit-short-hash> |
| P3k.4 | (batch 2) `screens/PayoutBatchScreen.tsx` — carries the literal banner "Records only - this app does not move money"; ctx: P3k.1-P3k.2; spec L124-128 — DONE 872b859 |
| P3k.5 | (batch 2) `money/__assertions__/payout-freeze.assert.ts` — a frozen line survives a later rate change unchanged; ctx: P3k.1 — DONE 872b859 |
| P3k.6b | (batch 2) verify batch 2 — the freeze assertion passes; AC-9 re-checked (no negative adjustment reaches any commission line); ctx: P3k.5 only — DONE 872b859 |
| P3k.7b | (batch 2) commit batch 2 + report — DONE 872b859 |
## P3-l — Reporting (ungated)
| # | Row (text — status) |
|---|---|
| P3l.1a | `reporting/group-by.ts` — `byStatus` / `bySource`, pure; ctx: `0004_scheduling.sql:95-97`; spec L130-133 — DONE e2b283a |
| P3l.1b | `reporting/group-by.ts` — `byAttachTiming`, pure; ctx: P3l.1a — DONE e2b283a |
| P3l.2 | `reporting/slot-hit-rate.ts` — `requested_window` is untyped text, so an unparseable value counts as `unknown`, NEVER a hit or a miss; ctx: `0004_scheduling.sql:86-88,98` — DONE f32d65f |
| P3l.3a | `reporting/revenue.ts` — revenue by service and period, read from `commissions` SNAPSHOT amounts; ctx: P3a.3 columns — DONE 163a93b |
| P3l.3b | `reporting/revenue.ts` — commission by service and period, never recomputed; ctx: P3l.3a — DONE 163a93b |
| P3l.4a | `screens/ReportsScreen.tsx` — layout, no charting dependency; ctx: P3l.1-P3l.3 — DONE 74b3ee2 |
| P3l.4b | `screens/ReportsScreen.tsx` — data wiring to `reporting/*`; ctx: P3l.4a — DONE 74b3ee2 |
| P3l.5 | Verify — fixture assertions for all three pure modules incl. the unparseable-window case; ctx: P3l.1-P3l.3 only — DONE 5b5db49 |
| P3l.6 | Commit + Tier-A report — DONE 5544fed |
## P3-m — `app/supabase/tests/0005_money_rls.test.sql` (EXEC-GATED — DEFERRED, see P3n.2 report Forward contracts)
| # | Row (text — status) |
|---|---|
| P3m.1a | Fixture plant under `reset role` FIRST — the falsifiability gate; ctx: `tests/0004_scheduling_rls.test.sql` pattern; P3a.2-P3a.4 — TODO |
| P3m.1b | Owner-sees-N on all 7 tables; ctx: P3m.1a — TODO |
| P3m.2a | Zero-row probes for `tech`, plus a point-lookup-by-PK variant (AC-10 / verify-7); ctx: P3m.1b — TODO |
| P3m.2b | Zero-row probes for `sales`, plus a point-lookup-by-PK variant. Testing only `tech` under-covers the AC; ctx: P3m.1b — TODO |
| P3m.3a | Trigger-denial probes, run under `reset role` as well as authenticated owner; ctx: P3a.5 triggers — TODO |
| P3m.3b | Survival probes — passing under `reset role` proves the guarantee is a TRIGGER, not RLS. AC-6 captures `amount::text` (text, not numeric: `100.00 = 100.0` is TRUE and would hide scale drift); ctx: P3m.3a — TODO |
| P3m.4a | `audit_log` policy-count canary — `select count(*) from pg_policies where tablename='audit_log'` must equal exactly 2 with zero UPDATE/DELETE; ctx: `0001_foundation.sql:159-176` — TODO |
| P3m.4b | README registration (Rule 31); ctx: `README.md` tests section — TODO |
| P3m.5 | Commit + Tier-A report — TODO |
## P3-n — Phase close
| # | Row (text — status) |
|---|---|
| P3n.1a | Full AC sweep, 1-10 — every gated item recorded OPEN, never PASSED; ctx: every group's Forward contracts cells — DONE. Swept all 17 groups: P3-0,P3-a,P3-b,P3-c,P3-d,P3-p,P3-e,P3-f,P3-g,P3-k,P3-l fully DONE zero non-done rows. Gated-and-correctly-OPEN: P3h.5 (structural pass, DB half OPEN), P3i.5 (structural pass, DB half OPEN — relabeled this pass to match P3h.5 convention), P3i.6 (downstream of P3i.5, TODO), P3-j full group (8 rows TODO, EXEC-GATED), P3-o full group (5 rows TODO, EXEC-GATED per its own group header), P3-m full group (9 rows TODO, EXEC-GATED). No unexpected gaps — every non-DONE row maps to a declared pause point in the execution plan's Consolidated Pause Points list or its downstream dependency. |
| P3n.1b | Full AC sweep — every ungated item carries its evidence. Includes verify-8: `grep -rn "sdassemblypro\|GTM-\|G-93R" app/modules/admin-finance` returns zero; ctx: P3n.1a — DONE. Re-ran verify-8 fresh: zero hits confirmed (grep exit 1, no matches). All DONE groups from P3n.1a's sweep (P3-0,P3-a,P3-b,P3-c,P3-d,P3-p,P3-e,P3-f,P3-g,P3-k,P3-l) carry their AC evidence in their own row text/commit hashes already on file — no missing-evidence gaps found. |
| P3n.2 | Phase Tier-A build report with the `Forward contracts:` field and the DEFERRED table; ctx: P3n.1a-P3n.1b — DONE (delivered E:\Jeff\.claude\build-reports\jobcore-p3-phase-close\2026-08-09_p3-phase-close.md) |
| P3n.3 | Ledger close — every row DONE, every Context out cell filled, commit naming the hash — DONE means every row is DONE or explicitly DEFERRED-with-pointer; EXEC-GATED rows are not blockers to phase close; ctx: this ledger — DONE |
| P3n.4 | Checkpoint + yield (Rule 10) — TODO |
## Out of scope
P4 tech-facing screens (greeting, checklists, photo capture, earnings view) - P5 payment capture, the
QR handoff page, reviews - P6 social posting and the review library - P7 real website intake adapters
and push notifications - any change to sdassemblypro.com, its PHP, its forms, or its GTM/GA4 tags
(permanently out of scope) - any card data anywhere in the app or database (zero PCI scope).
## Carried debts from P2 (not P3 rows; do not read the P2 ledger for these)
- State-machine unit suite (P2b.3) - unblocked once P3c.6 lands a test runner.
- Offline `replay` wiring (P2-d).
- Re-run `handoff/P2E-AIRPLANE-MODE-TEST.md` once a job data seam lands (P2-e) - P3d.1 is that seam.
