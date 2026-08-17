---
status: DRAFT
comments: "Jobcore — Shippable MVP Completion Plan"
classification: plans/majestic-painting-pebble
origin: .claude/plans/majestic-painting-pebble.md
tags: [plans, majestic-painting-pebble]
---

# Jobcore — Shippable MVP Completion Plan

> **Plan-file note:** the canonical copy of this plan is `.claude/plans/jobcore-mvp-completion.md`
> (goal-slug named, per convention). This file is a harness-generated duplicate the Plan Mode
> tracker keeps pointing at under a whimsy name. Per Jeff's explicit instruction, it does not
> survive approval as a live artifact: the first action after `ExitPlanMode` approval is a
> `scribe-hound` (Nestor) edit marking this file's frontmatter `status: SUPERSEDED` with a
> one-line pointer to the canonical file — retired, not deleted, per plan-custody discipline. All
> subsequent work, build reports, and checkpoints reference `jobcore-mvp-completion.md` only.

## Context

Jeff's directive: **"complete the JobCore app."** Finish line (locked via AskUserQuestion): a
**Shippable MVP** — all three business modules (`admin-finance`, `sales-marketing`, `field-tech`)
functionally wired end-to-end, the Supabase backend live, and the mobile app installable on real
devices for internal use. Explicitly NOT "feature-complete per spec docs" and NOT "App
Store/production launch-ready" — in Jeff's own words, "App store readiness is a long way off. I
want an app I can kick the tires on before it goes to the app store." Workstream 3 (§ below) stops
at a sideloaded internal build for exactly that reason; Apple/Play submission stays a placeholder.

Two prior draft plans (`jobcore-supabase-current-then-mobile-build.md`,
`jobcore-workstream-a-closure-then-workstream-b-android.md`) are folded in here as workstreams
(scope choice: "Fold in"), reconciled against verified current state — both drafts assumed less
Supabase progress than actually exists on disk, and neither covered the module-wiring gaps two
Explore agents just confirmed.

Two Phase 1 Explore agents (mobile/Supabase state; module completeness) establish the real
baseline:

- **Supabase (Workstream A) is substantially further along than drafted**: all 13 migrations
  (`0001_foundation.sql` … `0013_rls_fixes.sql`) exist on disk; CLI linkage confirms a real hosted
  project (`vogkxkcceahtwyovpxsg`) with pulled Postgres/gotrue/storage metadata; most migrations have
  paired RLS tests. Two Edge Functions the drafts called for (`price-sheet-current`,
  `handoff-resolve`) are **not** present among the three that do exist
  (`meta-publish`, `paypal-webhook`, `stripe-webhook`).
- **Android/EAS build (Workstream B) has not started at all**: `apps/mobile/app.json`'s
  `extra.eas.projectId` is still the literal placeholder `"REPLACE_WITH_EAS_PROJECT_ID"`,
  `eas.json`'s submit credentials are placeholders, and `docs/deployment.md` states outright that no
  EAS project/build/submit has ever run.
- **Module wiring (new finding, not covered by either draft)**: of the three business modules, only
  `field-tech` is genuinely wired end-to-end (module → host session/ports injection →
  Supabase-backed repos in `apps/mobile/src/lib/field-tech-repos.ts`). `admin-finance` has the
  richest domain/data layer and the only test coverage, but `apps/mobile/app/m/[moduleId].tsx`
  never supplies it any repo props — so it's logically complete but disconnected in the running app.
  `sales-marketing`'s screens are internally well-built, but `modules/sales-marketing/src/index.ts`
  still exports a static placeholder component instead of the real `SalesMarketingRoot`, and there
  is no host session/ports injection for it at all (no `sales-marketing-repos.ts` equivalent).

These three findings define the actual remaining gap to "Shippable MVP": module host-wiring is the
biggest missing piece and was invisible to both prior drafts; Workstream A is mostly verification
work, not new build; Workstream B is a full, mostly human-gated build from zero.

---

## Execution Methodology — Agent Teams + Rolling Slices (Rules 38/39)

This plan's implementation work is multi-file across all three workstreams, so it is executed through
Agent Teams dispatch and rolling-slice chunking rather than direct main-session edits — this keeps the
main window from accumulating file-content context across dozens of touched files.

**Agent Teams (Rule 39):** the main session never edits module/repo/migration files directly. Read-only
recon (confirming a repo interface shape, checking whether a migration/test file already exists,
grep-sweeping for a stale import path) fans out freely to named, addressable teammates via
`SendMessage` — e.g. a teammate spawned to confirm `AdminFinanceRoot`'s exact prop shape before the
`admin-finance-repos.ts` write. Every actual **write** (new repo files, edits to `[moduleId].tsx`, new
migrations, new Edge Functions, `docs/deployment.md` updates) routes to a roster write hound —
`scribe-hound` (Nestor) for ordinary new-file/anchored edits, `patch-hound` (Spot) for large/multi-edit
files — never to a bare named teammate, per Rule 39's "not a sanctioned write vehicle" constraint.
Concurrent writers are capped at ≤3 (they serialize on `Global\WriteLeaseMutex`), so no more than 3
write hounds are ever in flight at once across a workstream. Every dispatch (read-only teammate or write
hound) carries a visible `name:` per the Naming mandate.

**Rolling-slice execution (Rule 38):** each workstream is broken into an ordered slice list, one hound
per slice, evicted from context before the next slice dispatches:

- **Workstream 1** — 3 slices, one per module: (1) sales-marketing placeholder swap, (2) sales-marketing
  host injection (`sales-marketing-repos.ts` + `[moduleId].tsx` wiring), (3) admin-finance host injection
  (`admin-finance-repos.ts` + `[moduleId].tsx` wiring). Per-file slicing is the standing default even
  though slice 1 is a single small file. Each slice's hound reads only the files that slice touches
  (its own repo file, the shared `[moduleId].tsx` for that route's block, the relevant `ports.ts`), does
  the write, and returns a one-line confirmation to a scratchpad crib — not a diff dump — before the next
  slice starts.
- **Workstream 2** — 5 slices matching its 5 numbered items (migration-applied check, `0013` reconciliation
  read, the 2 new Edge Functions treated as 1 slice each if both are needed, RLS test-coverage fill,
  payment-review wiring). The migration/RLS verification slices are read-mostly and can run as teammate
  fan-out; the Edge Function authoring and payment-review wiring slices are write hound dispatches.
- **Workstream 3** — not sliced the same way; it's already its own track (R-A) and most steps are Jeff
  hands-on, not hound work. The scripted steps (EAS project creation, `eas.json`/`app.json` edits) are
  single small write-hound dispatches when Jeff is ready to run them.

Either Gate 1 (changed+read span reaches ~250 lines) or Gate 2 (an Argus amber/red headroom pre-check)
confirms a slice boundary is needed if a workstream's natural per-file split above ever undershoots that
threshold in practice — the per-module/per-item split above already anticipates both gates for this
plan's known scope. Once a workstream's slice list is approved at that workstream's start, execution
proceeds unattended across its slices (Rule 10's yield suspends) until headroom, a slice verdict, or an
open question re-arms it — e.g. Workstream 2 hitting an unexpected schema mismatch mid-slice.

---

## Workstream 1 — Module Host-Wiring (highest priority: this is what makes the app functionally whole)

**Sales-marketing placeholder swap** (`modules/sales-marketing/src/index.ts`): replace the
`SalesMarketingPlaceholder` export with the real `SalesMarketingRoot` (already built, already
composes all 4 screens as tabs in `SalesMarketingRoot.tsx`). Delete the stale "not built yet" doc
comment while touching the file.

**Sales-marketing host injection**: add `apps/mobile/src/lib/sales-marketing-repos.ts`, mirroring
the shape of `field-tech-repos.ts` — Supabase-backed repository factories plus a
`buildSalesMarketingPorts(): ModulePorts` aggregator. Wire `apps/mobile/app/m/[moduleId].tsx` to call
`setModuleSession`/`setModulePorts` for the `sales-marketing` route the same way it already does for
`field-tech`. `getModulePorts()` fails closed per its own doc comment, so this is required before the
placeholder swap is usable at runtime, not optional polish.

**Admin-finance host injection**: `apps/mobile/app/m/[moduleId].tsx` currently renders
`<Screen />` bare for the `admin-finance` route. `AdminFinanceRoot` needs `jobs`/`priceSheets`/
`payPeriods` repo props (`AdminFinanceRoot.tsx:18-24`) or it renders its empty state
(`AdminFinanceRoot.tsx:85`). Build the equivalent `admin-finance-repos.ts` factories against the
existing `JobRepository`/`PriceSheetRepository`/`PayPeriodRepository` interfaces in
`modules/admin-finance/src/data/ports.ts`, and pass them as props from the host route.

Reuse pattern for all of the above: `apps/mobile/src/lib/field-tech-repos.ts` and
`apps/mobile/src/lib/supabase.ts` are the canonical examples — real `supabase.from(...)` calls, no
mocks.

---

## Workstream 2 — Supabase Verification & Close-Out (mostly confirmation, not new build)

1. Confirm all 13 migrations are actually **applied** to the hosted `jobcore-dev` project (not just
   present on disk) — `supabase migration list --linked` or equivalent, from `supabase/`.
2. Reconcile `0013_rls_fixes.sql` (on disk) against the earlier draft plan's proposed
   `0013_jobs_select_narrowing.sql` (never written) — read `0013_rls_fixes.sql`'s actual content to
   determine whether it already covers that narrowing or whether a follow-up migration is still
   needed.
3. Author the two missing Edge Functions the drafts specified and that still don't exist:
   `price-sheet-current` and `handoff-resolve`, under `supabase/functions/`, following the existing
   `meta-publish`/`paypal-webhook`/`stripe-webhook` structure (each has a `DEPLOY.md`).
4. Fill RLS test coverage gaps — confirm which of the 13 migrations lack a paired
   `*.test.sql`/`*.hosted.test.sql` in `supabase/tests/` and add the missing ones, following the
   existing pattern.
5. Payment-review module wiring (from the second draft plan's Slice 7): register `payment-review` in
   `apps/mobile/src/modules.ts`, add its host-injection block, confirm `ReconciliationView.tsx` is a
   real implementation (not a stub), and resolve its 4 known TODO stubs.

---

## Workstream 3 — Android/EAS Build (fully pending; largely human-gated, R-A: own track)

Per Rule 15 (R-A), this is externally gated (Expo/EAS account access, Apple/Play credentials,
physical device) and must not block Workstreams 1-2. Sequencing per the existing draft: Workstream A
(now Workstream 2 here) closes first since the mobile app depends on the live schema.

1. Create/link a real EAS project; replace `apps/mobile/app.json`'s `extra.eas.projectId` placeholder.
2. Fill real Android keystore/signing config in `eas.json`.
3. Run an internal `development`-profile EAS build.
4. Sideload/install on a real Android device — **Jeff hands-on**, cannot be automated.
5. Smoke-test the installed app against the live Supabase backend end-to-end (session login → job
   list → each of the three modules).
6. Leave Apple/Play production submit credentials as placeholders — out of scope per the locked MVP
   definition (no App Store requirement).

`docs/deployment.md` is the authoritative doc for this workstream; update it as each step lands
(Rule 31 — docs ride the change).

---

## Sequencing

1. **Workstream 1** first — it's pure code, no external gates, and is what actually makes "all
   modules functionally wired end-to-end" true. Do the three modules in this order: sales-marketing
   placeholder swap (smallest, unblocks nothing else but is a 1-line fix), sales-marketing host
   injection, admin-finance host injection.
2. **Workstream 2** in parallel or immediately after — mostly verification, low risk, closes the
   backend side of "Supabase backend live."
3. **Workstream 3** last, on its own track — gated on 1-2 being done (app needs real data to smoke
   test) and on Jeff's hands-on device step.

---

## Verification

- **Workstream 1**: `npm run typecheck` (0 errors, per the existing standard in
  `jobcore-typecheck-and-field-tech-drift.md`); manually launch each of the 3 modules from
  `apps/mobile/app/index.tsx`'s module launcher against the dev Supabase project and confirm each
  renders real data (not an empty/placeholder state).
- **Workstream 2**: `supabase migration list --linked` shows all 13 applied; `supabase test db` (or
  equivalent) passes for all RLS test files; new Edge Functions deploy and return expected responses
  per their `DEPLOY.md` smoke-test steps.
- **Workstream 3**: EAS build completes without error; app installs on a physical Android device;
  login + at least one action per module succeeds against the live backend.

## Deferred / Out of Scope

- Apple App Store / Google Play production submission — explicitly out of scope per the locked MVP
  definition.
- `admin-finance`'s `TechColumn.tsx` `chipVariant()` status-grouping semantics — already triaged as a
  separate product question in the closed typecheck/drift plan, not reopened here.
- **`jobcore-basics-manual.md`** (separate COMPLETE doc project) will go stale once Workstreams 1-2
  land — not touched here, per Jeff's instruction. Revisit off-session when the app is closer to
  completion.
