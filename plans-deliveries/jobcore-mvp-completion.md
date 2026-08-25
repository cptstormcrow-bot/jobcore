---
status: DRAFT
classification: plans/jobcore-mvp-completion
comments: "Jobcore — Shippable MVP Completion Plan"
origin: .claude/plans/jobcore-mvp-completion.md
tags: [plans, jobcore-mvp-completion]
---

# Jobcore — Shippable MVP Completion Plan

## Context

Jeff's directive: **"complete the JobCore app."** Finish line (locked via AskUserQuestion): a
**Shippable MVP** — all three business modules (`admin-finance`, `sales-marketing`, `field-tech`)
functionally wired end-to-end, the Supabase backend live, and the mobile app installable on real
devices for internal use. Explicitly NOT "feature-complete per spec docs" and NOT "App
Store/production launch-ready."

— in Jeff's own words, "App store readiness is a long way off. I want an app I can kick the tires on before it goes to the app store." Workstream 3 (§ below) stops at a sideloaded internal build for exactly that reason; Apple/Play submission stays a placeholder.

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
- **Module wiring (STALE FINDING — corrected 2026-08-14, verified by direct main-session read)**:
  this section originally reported `sales-marketing`/`admin-finance` as unwired, but that gap no
  longer exists on disk. Verified this turn: (1) `Jobcore/app/modules/sales-marketing/src/index.ts`
  already exports `salesMarketingModule` wired to the real `SalesMarketingRoot` (imported from
  `./screens/SalesMarketingRoot`) — no `SalesMarketingPlaceholder` export and no stale "not built
  yet" comment; the file's own header states it "Supersedes the P1 placeholder... Wires in the real
  SalesMarketingRoot." (2) `Jobcore/app/modules/admin-finance/src/index.ts` already exports
  `adminFinanceModule` wired to the real `AdminFinanceRoot` — no placeholder present. (3)
  `Jobcore/app/apps/mobile/src/modules.ts` already imports and calls `registerModule()` for both
  `salesMarketingModule` (from `@jobcore/sales-marketing`) and `adminFinanceModule` (from
  `@jobcore/admin-finance`) — host injection for both is already done. Note the corrected path
  prefix: these paths live under `Jobcore/app/...`, one level below this repo root
  (`E:\Jeff\Codespace\SDAssemblyPros`), not bare `modules/...`/`apps/...` as originally written.

**Workstream 1 status: ALREADY COMPLETE on disk as of 2026-08-14** — all 3 slices (sales-marketing
placeholder swap, sales-marketing host injection, admin-finance host injection) are done; see the
corrected Workstream 1 section below. Only Workstreams 2 and 3 (Supabase verification, Android/EAS
build) remain the actual gap toward "Shippable MVP." Workstream A is mostly verification work, not
new build; Workstream B is a full, mostly human-gated build from zero.

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

## Workstream 1 — Module Host-Wiring — ALREADY COMPLETE (corrected 2026-08-14, verified by direct main-session read)

All 3 slices originally scoped here are done on disk; no further work needed for this workstream.

**Sales-marketing placeholder swap** — DONE. `Jobcore/app/modules/sales-marketing/src/index.ts`
already exports `salesMarketingModule` wired to the real `SalesMarketingRoot` (imported from
`./screens/SalesMarketingRoot`). No `SalesMarketingPlaceholder` export exists and no stale "not
built yet" doc comment exists — the file's own header comment instead states it "Supersedes the P1
placeholder... Wires in the real SalesMarketingRoot."

**Sales-marketing host injection** — DONE. `Jobcore/app/apps/mobile/src/modules.ts` already imports
`salesMarketingModule` from `@jobcore/sales-marketing` and calls `registerModule()` on it — host
injection is already in place.

**Admin-finance host injection** — DONE. `Jobcore/app/modules/admin-finance/src/index.ts` already
exports `adminFinanceModule` wired to the real `AdminFinanceRoot` component (no placeholder), and
`Jobcore/app/apps/mobile/src/modules.ts` already imports `adminFinanceModule` from
`@jobcore/admin-finance` and calls `registerModule()` on it.

(Original slice descriptions below are retained for historical reference only — they describe a
gap that no longer exists and used a stale path prefix, missing the `Jobcore/app/` root.)

---

## Workstream 2 — Supabase Verification & Close-Out (mostly confirmation, not new build)

1. Confirm all 13 migrations are actually **applied** to the hosted `jobcore-dev` project (not just
   present on disk) — `supabase migration list --linked` or equivalent, from `supabase/`. **CONFIRMED
   2026-08-14** via a live `pg_policies` read against the hosted database (ref `vogkxkcceahtwyovpxsg`):
   all three RLS policies (`jobs_select_org`, `jobs_update_org`, `reviews_insert_anon`) carry
   post-`0013_rls_fixes.sql` definitions, confirming the migration is applied.
2. Reconcile `0013_rls_fixes.sql` (on disk) against the earlier draft plan's proposed
   `0013_jobs_select_narrowing.sql` (never written) — read `0013_rls_fixes.sql`'s actual content to
   determine whether it already covers that narrowing or whether a follow-up migration is still
   needed.
3. Author the two missing Edge Functions the drafts specified and that still don't exist:
   `price-sheet-current` and `handoff-resolve`, under `supabase/functions/`, following the existing
   `meta-publish`/`paypal-webhook`/`stripe-webhook` structure (each has a `DEPLOY.md`). **DONE
   2026-08-14** — both functions authored per
   `.claude/plans/slice-3-author-price-sheet-current-and-handoff-resolve-edge.md`: `price-sheet-current`
   (`deno.json`, `handler.ts`, `index.ts`, fixture assertion, `DEPLOY.md`) and `handoff-resolve`
   (`index.ts`, `DEPLOY.md`), plus doc rides to `app/supabase/README.md` and `app/package.json`.
   Verified via `npm test` (99/99 passing) and `npm run typecheck` (clean). Deploying either function
   to Supabase remains EXEC-GATED, out of scope for this slice.
4. Fill RLS test coverage gaps — confirm which of the 13 migrations lack a paired
   `*.test.sql`/`*.hosted.test.sql` in `supabase/tests/` and add the missing ones, following the
   existing pattern.
5. Payment-review module wiring (from the second draft plan's Slice 7): register `payment-review` in
   `apps/mobile/src/modules.ts`, add its host-injection block, confirm `ReconciliationView.tsx` is a
   real implementation (not a stub), and resolve its 4 known TODO stubs.
   **DONE (2026-08-14):** registration + host-injection block + real-implementation confirmation
   are complete and verified on disk (`apps/mobile/src/modules.ts`, `apps/mobile/app/m/[moduleId].tsx`,
   `modules/payment-review/src/index.ts`). The 4 TODO stubs (`domain/handoff.ts`,
   `domain/providers/stripe-link.ts`, `domain/providers/paypal.ts`) were scoped OUT of this item by
   the approved plan `jobcore-mvp-slice-4-wording-correction-payment-review-host.md`, which limits
   item 2 to host-wiring only. A pre-existing TypeScript project-references gap was found (no
   module-local `tsconfig.json`, module not referenced from root/mobile tsconfig — `tsc --build`
   fails with TS2307 on `@jobcore/payment-review`); tracked as a forward contract in the build report
   at `.claude\build-reports\jobcore-mvp-completion\2026-08-14_payment-review-host-wiring.md`.
   **DONE (2026-08-14):** the TS2307 module-resolution gap and the TS2769/TS2589/TS2345 type-cluster
   defects in payment-review are now both fixed and independently verified via a full clean `tsc
   --build` rebuild (zero errors across all 8 workspace projects). See
   `.claude\build-reports\jobcore-mvp-completion\2026-08-14_payment-review-tsc-build-fix.md`.

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
- **`jobcore-basics-manual.md`** (separate COMPLETE doc project) will go stale once Workstreams 1-2 land — not touched here, per Jeff's instruction. Revisit off-session when the app is closer to completion.
