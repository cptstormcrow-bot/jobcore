---
title: JobCore Basics Manual
status: COMPLETE
classification: plans/jobcore-basics-manual
comments: "JobCore Basics Manual"
origin: .claude/plans/jobcore-basics-manual.md
tags: [plans, jobcore-basics-manual]
---

# JobCore Basics Manual

## Context

Jeff wants a stack-exact PIB manual ("JobCore Basics", HTML) covering the JobCore field-service
scheduling core as it's actually being built, not the idealized spec. It has to read as one
coherent app manual — task-oriented, feature-oriented, and informational per chapter — using the
real JobCore design tokens, real screen names, and real gaps (unregistered modules, stale spec
references, unresolved footnotes) rather than glossing over the current build state. Primary
sources: `00-MASTER-SPEC.md`, `sdassembly-scheduling-app.md`, plus direct reads of the app's own
code (module contract, state machine, design tokens, per-module screens) and two 2026-08-13
production hardening build reports.

Phase 1–3 research (Explore agents, Plan agents A/B, direct verification reads, one
AskUserQuestion) is complete. All previously open questions are resolved — one by direct disk
verification, one by explicit user choice, five by disclosed PIB-consistent defaults (listed
below). This plan also encodes **how** the manual gets built: Jeff asked for a rolling,
just-in-time build — small chunks, agent teams doing the drafting, scratchpad crib files carrying
state between chunks, main session kept light rather than holding the whole manual or the whole
spec in context at once.

## Content Architecture

**File mapping** — the manual ships as 5 HTML files, not one: `jobcore-basics-core.html` (Front
Matter, Part I chs. 1–2, Part III ch. 7, Appendices A–C) plus one file per Part II module chapter —
`jobcore-basics-admin-finance.html`, `jobcore-basics-field-tech.html`,
`jobcore-basics-sales-marketing.html`, `jobcore-basics-payment-review.html`. Every file shares one
external stylesheet (`jobcore-basics-shared.css` — design tokens, badge pills, Job Spine SVG
styles) and one external script (`jobcore-basics-shared.js` — persistent cross-file sidebar,
current-chapter highlight, and a baked-in search index covering every chapter's headings across
all 5 files) via ordinary `<link>`/`<script src>` tags, so the manual behaves as one coherent app
when all 5 files are present (live cross-file `<a href>` links in the sidebar and in search
results) while each module file also opens and reads correctly on its own.

**Front Matter** — title page, "How to Use This Manual" (explains the task/feature/informational
lens per chapter, the day-in-the-life walkthrough pattern used in Chapters 3–5, and a one-line
scope note that Training is a named roadmap item, not yet a chapter), and the badge-system legend
(below). Front Matter lives only in the core file; each module file carries a compact recap of the
badge legend plus a "Part of the JobCore Basics Manual — full index" link back to
`jobcore-basics-core.html`, since a reader (or a search result) may land on a module file
directly.

**Part I — Foundation**
1. **What Is JobCore?** — multi-tenant core + module system; the `JobcoreModule` contract
   (`packages/module-sdk/src/index.ts`: `id`, `displayName`, `requiredRoles`, `routes`,
   `navEntries`, optional `jobActions`/`hooks`/`migrations`/`settings`); why modules are
   compile-time-only (RN can't load native code at runtime; app-store review forbids it); the four
   modules that satisfy the contract today. Two independent axes gate whether a module is actually
   live for a given install: **compile-time registration** (`apps/mobile/src/modules.ts:11-18`
   calls `registerModule()` per module the mobile build includes — today that's admin-finance,
   field-tech, and sales-marketing; payment-review is never registered there) and **runtime
   per-org enablement** (`organizations.enabled_modules text[]`, `supabase/migrations/0001_foundation.sql:27`,
   filtered through `getEnabledModules()` in `packages/module-sdk/src/index.ts:101-114`). Chapter 6
   is the concrete example of the first axis: built and contract-satisfying, but absent from the
   mobile registry.
2. **The Job Lifecycle & Platform Foundations** — the state machine (`packages/core/src/state-machine.ts`):
   `new → qualified → scheduled → assigned → accepted → en_route → in_progress → completed → paid → closed`,
   branches `declined`/`needs_reschedule`/`cancelled`, the `TRANSITIONS` table, `OFFICE`/`FIELD`
   role gating, the three preconditions, the `en_route` cancellation-window close, device-clock
   payroll stamping, `audit_log` metadata workaround. This chapter also carries the verified
   **RLS/tenant-isolation hardening** content (facts below) — dated, cited, real.

**Part II — The Modules** (one chapter per registered module; task + feature + informational
each). Chapters 3–5 each open with a **"A Typical Day"** walkthrough — a persona narrative that
walks the module's real screens in the order a working day actually uses them, cross-referencing
the job-lifecycle states from Chapter 2 by name (`accepted`, `en_route`, `in_progress`,
`completed`, `paid`) rather than restating them.
3. **Admin & Finance** — two personas, since the module serves both: **Admin's typical day**
   opens with a **before-the-day-starts setup callout** — enabling the org's accepted payment
   providers in advance via the `payment_providers` table (org-scoped `enabled`/`config` columns,
   admin-only RLS, `0010_payment_review.sql:12-22,157-161`), honestly noting this is a
   database-level setting today with no admin UI screen to operate it (🟡 Built, Not Wired for the
   table/RLS mechanism itself; ⚪ Open Gap (Roadmap) for the missing settings screen); sourced from
   Slice 4's storyboard, cross-referenced from Chapter 4's payment-collection subsection — then
   continues into staffing/scheduling (reviewing incoming jobs, assigning techs, resolving
   `needs_reschedule` jobs, monitoring the day's job board). **Accountant's typical day** covers
   the finance side — reviewing `completed`/`paid` jobs, reconciling payments, running the reports
   the module exposes. Same chapter, two clearly-headed subsections, not two chapters — per Jeff's
   choice this turn.
4. **Field Tech** — **Service Technician's typical day**, the fullest walkthrough in the manual:
   opens the app to see assigned jobs → accepts one (`assigned → accepted`) → drives to the
   jobsite (`accepted → en_route`, cancellation window closes) → starts the job
   (`en_route → in_progress`) → does the work, takes the required photos, curates the job record
   → marks it done (`in_progress → completed`) → walks the homeowner through **Collecting Payment
   from the Homeowner** (own subsection, below) → the job reaches `paid` → accepts the next job
   and repeats. Includes a "filling an 8-hour day" efficiency note — how many jobs a well-run day
   holds, and what the tech needs in hand before leaving each jobsite (photos taken, job marked
   complete, next job already visible) to avoid idle gaps between jobs.

   **Collecting Payment from the Homeowner** (per Jeff's explicit ask this turn, replacing the
   prior placeholder "gets paid" bullet) — walks `completed → paid` as it actually happens today,
   content sourced from Slice 4's payment-collection storyboard (not re-derived in this chapter's
   own dispatch), honestly mixing built pieces with storyboarded ones rather than presenting either
   as a finished in-app flow:
   - Opens with the **satisfaction-confirmation gate** ("the homeowner confirms the job is done to
     their satisfaction before payment") — genuinely absent from the codebase today (not in the
     mobile app's `Completion.tsx`, not in any `web/handoff` screen). Presented plainly as a
     storyboarded/proposed step, badged ⚪ Open Gap (Roadmap).
   - The four payment methods offered, each on its own honest footing rather than a uniform "it
     works": **card** (Stripe hosted-checkout link — debit and credit are not distinguished
     anywhere in JobCore's code, because the charge flow itself has no need to know which; state
     this plainly rather than inventing a distinction), **cash**, and **Venmo via a scan-to-pay
     link** — cite the real domain objects (`payment-review/src/domain/providers/{cash,check,
     p2p-link}.ts`) and the real gap (QR/barcode *rendering* is explicitly deferred in
     `payment-review/src/domain/handoff.ts`, not implemented) rather than depicting a scan screen
     that doesn't exist.
   - Closes with the honest mechanics of the state transition itself: a Stripe/PayPal webhook
     (`app/supabase/functions/{stripe,paypal}-webhook/index.ts`) confirms the `payments` row, then
     an **OFFICE-role user clicks "Mark Paid"** (the `mark-paid` jobAction in
     `payment-review/src/index.ts`) to actually fire `completed → paid` — and that module is the
     one Chapter 6 already establishes as not registered in the mobile app today. Called out
     plainly with a cross-reference to Chapter 6, rather than showing the field tech capturing or
     confirming payment in-app themselves.
5. **Sales & Marketing** — **Sales/Marketing's typical day** — the lead-to-job path: a new lead
   comes in (`new`), gets qualified (`new → qualified`), gets scheduled (`qualified → scheduled`),
   and hands off to Field Tech once `assigned`; what the module surfaces for tracking a pipeline
   of jobs still in the pre-field states.
6. **Payment & Review** — built in code, **not registered/reachable** in the mobile app today.
   Per Jeff's explicit choice this turn: **architecture/status content only — no "Try it"
   walkthrough section, and no day-in-the-life subsection of any kind** (this chapter does not
   gain Accountant content, even though Accountant appears in Chapter 3). Covers what's built,
   each screen's purpose, and the registration/reachability gap plainly, with the 🔴 Not
   Reachable badge on the chapter and every screen in it, citing `apps/mobile/src/modules.ts:11-18`
   as the exact evidence that payment-review is never `registerModule()`'d in the mobile build.

**Part III — Systems & Hardening**
7. **Design System, Security Posture & Roadmap** — token translation reference, the reconciled
   badge legend, the RLS hardening evidence recap (cite Part I's citations, don't re-derive them),
   and the open-gap roadmap. The roadmap explicitly names **Training** as a future module with the
   ⚪ Open Gap (Roadmap) badge — one line, no elaboration, per Jeff's explicit instruction this
   turn: call it out as coming, write nothing else about it anywhere in the manual.

**Appendices**
- **A. Platform Notes** — Android workstream, concise, not a standalone chapter.
- **B. Handoff & Deep Links** — as-built path/token handling from `web/handoff/src/router.ts`
  (`/handoff/{token}` or `?token=`), with an explicit callout that `00-MASTER-SPEC.md`'s
  `/j/{token}` is stale — captures the app "as we have been developing it," per Jeff's original
  ask. Also cross-references `web/handoff/src/screens/awaitingPayment.ts` — the real on-site
  payment-provider-picker screen the homeowner sees — linked from Chapter 4's payment-collection
  subsection.
- **C. Component Reference** — mockup catalog; footnote that Checkbox/Toggle lack a barrel export.

## Visual & Technical Design

- **Token translation** from `packages/ui/src/tokens.ts` (colors, typography, spacing, radius,
  shadow scale) directly into the manual's CSS custom properties — the manual is themed in
  JobCore's own palette, not a generic doc theme.
- **Navigation**: a persistent sidebar (rendered by the shared script on every file) lists all 7
  chapters + appendices regardless of which file is open; within-file entries scroll-spy as
  normal, cross-file entries are plain `<a href="jobcore-basics-<module>.html#<anchor>">` links;
  the Job-Spine current-chapter indicator reads a `data-jobcore-doc` attribute on each file's
  `<body>` to highlight the active file/chapter. **Search**: a search box in the shared sidebar
  filters a search index baked into `jobcore-basics-shared.js` at assembly time (heading + anchor
  + file + module per entry) — baked in rather than `fetch()`-loaded so the manual still works
  when opened directly via `file://` (Chromium blocks `fetch()` of local files under `file://`,
  but `<script src>` loading is unaffected). No dead-link handling for a missing module file is
  needed: per Self-Resolved Defaults item 6, the manual always ships as one complete 5-file set
  regardless of any given org's or build's actual `enabled_modules` subset, so every cross-file
  link the sidebar/search can generate always resolves.
- **Component-mockup system**: reusable CSS/HTML snippets that render JobCore screens
  (cards, status pills, job-detail layouts) inline as figures, built from the token set above —
  not screenshots, not generic wireframes.
- **Code typography**: dedicated monospace scale for code/config excerpts (state machine table,
  RLS policy SQL, module registration snippets).
- **Baseline**: keyboard-focus visibility, reduced-motion respected, print stylesheet, semantic
  heading structure, alt text on every figure.
- **Signature element**: a "Job Spine" SVG — the state-machine chain rendered as the manual's one
  memorable visual motif, reused (in miniature) as the current-chapter indicator in the nav.

**Badge legend (reconciled)** — 5-tier vocabulary, styled as filled/outline pills:
| Badge | Meaning |
|---|---|
| 🟢 Built & Live | Working, reachable, verified in the app today |
| 🟡 Built, Not Wired | Code exists, not yet registered/routed |
| 🟠 Built, Unverified | Code exists, not yet verified end-to-end |
| 🔴 Not Reachable | Built but inaccessible from the running app (Chapter 6's status) |
| ⚪ Open Gap (Roadmap) | Not built yet; spec'd or implied only |

## Verified Content: RLS / Tenant-Isolation Hardening (2026-08-13)

Directly confirmed this session by full reads of both build reports (resolves the prior
provenance discrepancy — the claim is true):

- **`E:\Jeff\.claude\build-reports\jobcore-p2-supabase-hosted\2026-08-13_hosted-rls-8-suite-verification.md`**
  — 8-suite hosted RLS run against live production Supabase project `vogkxkcceahtwyovpxsg`. Found
  4 failing suites: AC-7 (root cause not yet known at that point), AC-8.2 (genuine RLS/trigger
  defect), AC-RV-2 (genuine RLS/grant defect), AC-12.1c (test-authoring gap, not a defect).
- **`E:\Jeff\.claude\build-reports\jobcore-p2-supabase-hosted\2026-08-13_rls-defect-fixes.md`**
  — same-day follow-up. 3 genuine production defects fixed via `supabase/migrations/0013_rls_fixes.sql`
  (idempotent, standalone-runnable, 55 lines):
  1. `jobs_select_org` SELECT policy — now requires both `organization_id = current_org_id()` AND
     `is_org_sales_or_above()`.
  2. `jobs_update_org` UPDATE policy — now requires both `organization_id = current_org_id()` AND
     `is_org_admin()` on both `using`/`with check`.
  3. New `job_exists_in_org()` security-definer function backing a fixed `reviews_insert_anon`
     policy.
  - AC-RV-2 was re-examined post-fix and diagnosed as a test-file ordering bug (`reset role;` at
    line 405 of `tests\0010_payment_review_rls.hosted.test.sql` runs one statement too late) — no
    production defect remains; carried as informational only, not manual-blocking.
  - All 4 reverified against production 2026-08-13: AC-7 PASS, AC-8.2 PASS, AC-RV-2 diagnosed,
    AC-12.1c PASS.

This is real, dated, citable hardening — Chapter 2 and Chapter 7 present it as such (with the
migration filename and date), not as a vague "security was improved" claim.

## Self-Resolved Defaults (disclosed, overridable)

1. Android workstream → Appendix A, concise, not a standalone chapter.
2. Handoff URL → document the as-built path, flag `00-MASTER-SPEC.md`'s `/j/{token}` as stale
   (Appendix B).
3. Checkbox/Toggle missing barrel export → footnote in Appendix C, not a blocking issue.
4. Badge system → Agent A's 5-tier taxonomy, rendered with Agent B's pill/badge CSS (synthesis,
   not either agent's design alone).
5. Deliverable path → **multi-file**, per Jeff's decision this turn: all 5 HTML files plus the
   shared CSS/JS live together in `app/docs/` (matches the existing `docs/adding-a-module.md`
   convention) — `jobcore-basics-core.html`, `jobcore-basics-admin-finance.html`,
   `jobcore-basics-field-tech.html`, `jobcore-basics-sales-marketing.html`,
   `jobcore-basics-payment-review.html`, `jobcore-basics-shared.css`,
   `jobcore-basics-shared.js`. All 7 files are created only — **not committed** into the
   Jobcore/SDAssemblyPros repo by this session (standing "commit freely" permission covers the
   `E:\Jeff` admin repo only, not client project repos).
6. Manual scope vs. per-org `enabled_modules` → confirmed by direct research this turn: module
   subsets are real at both a compile-time axis (`apps/mobile/src/modules.ts:11-18` registers only
   3 of 4 modules) and a runtime axis (`organizations.enabled_modules text[]`,
   `supabase/migrations/0001_foundation.sql:27`, filtered via `getEnabledModules()` in
   `packages/module-sdk/src/index.ts:101-114`; the dev-seed org enables only 3 —
   `supabase/seed.sql:18-24`). The manual is **not** filtered by either axis: it documents
   JobCore's full module surface (all 4 modules across the 5 files) as a static as-built
   reference, not a per-tenant generated doc. A module disabled for one org, or (per Chapter 6)
   never registered in the mobile build at all, still gets its full chapter, badged accordingly.
   No per-install manifest filtering in `jobcore-basics-shared.js`'s nav — all 5 files always ship
   together and link to each other. (Spec confirmation of the enablement mechanism:
   `00-MASTER-SPEC.md:59,137`, `sdassembly-scheduling-app.md:151`.) Separately confirmed: neither
   spec doc contains any end-user-manual, in-app-help, onboarding, or training requirement beyond
   this plan's own scope — nothing else to reconcile against.

## Execution Strategy — Rolling, Cold-and-Ready Slice List (Rule 38)

**Repo root**: `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\` — every relative path below
(`packages/...`, `apps/mobile/...`, `supabase/...`, `app/docs/...`) is anchored here, **except**
`web/handoff`, which is a sibling of `app\`, not a child of it — that one path resolves at
`E:\Jeff\Codespace\SDAssemblyPros\Jobcore\web\handoff\` (verified by direct disk check this
session). A slice dispatch resolves its own paths against this root; it is never handed pre-read
file content by the main session.

**Cold-and-ready principle**: this plan file holds citations and line-anchored facts, never pasted
spec/source content — that discipline continues into execution. The crib file (Slice 1) is what
stays "cold": it sits on disk between slices, holding only short status rows and pointers, never
full prose. No slice's spec/source context is pulled into the main session at any point, planning
or build — it is pulled into that slice's own dispatched agent, used there, and discarded on
confirmation. The main session's own context after this plan is approved holds only: the slice
list below, each slice's one-line completion status, and the crib file's path — nothing else
rolls forward between slices.

**Slice list** — nothing below is dispatched by this plan; it is the exact, ordered,
independently-dispatchable work list for the moment the plan is approved. Each slice = one hound
dispatch = one output file (or the shared pair), per Rule 38's per-file default.

| # | Slice | Reads (inside the dispatch only) | Writes | Blocks on |
|---|---|---|---|---|
| 1 | Build-state crib file | This plan's Content Architecture + Self-Resolved Defaults sections (passed verbatim in the dispatch prompt) | `...\scratchpad\jobcore-basics-build-state.md` — chapter list, file mapping, badge legend, token→CSS map, RLS facts, persona pattern, per-chapter status rows; a payment-collection storyboard status row (slice 4) | nothing (first slice) |
| 2 | Front Matter + Ch1 (What Is JobCore?) | Crib file; `packages/module-sdk/src/index.ts`; `apps/mobile/src/modules.ts:11-18`; `supabase/migrations/0001_foundation.sql:27`; `00-MASTER-SPEC.md` §module system | `app/docs/fragments/00-front-matter.html`, `app/docs/fragments/01-ch1.html` | Slice 1 |
| 3 | Ch2 (Job Lifecycle & Platform Foundations) | Crib file; `packages/core/src/state-machine.ts`; both 2026-08-13 RLS build reports (paths in Verified Content above) | `app/docs/fragments/02-ch2.html` | Slice 2 (cites Ch1's module vocabulary) |
| 4 | Payment-collection storyboard | Crib file; `packages/core/src/state-machine.ts` (`requirePaymentSettled`); `app/supabase/functions/stripe-webhook/index.ts`; `app/supabase/functions/paypal-webhook/index.ts`; `app/modules/payment-review/src/domain/providers/{cash,check,p2p-link}.ts`; `app/modules/payment-review/src/domain/handoff.ts`; `app/modules/payment-review/src/index.ts` (mark-paid jobAction); `0010_payment_review.sql` (lines 12-22 payment_providers table, 26-31 card capture, 109-143 manual-confirm, 157-161 admin-only RLS); `app/modules/field-tech/src/screens/Completion.tsx`; `../web/handoff/src/screens/awaitingPayment.ts` and `../web/handoff/src/screens/{confirming,review,done}.ts` | `...\scratchpad\jobcore-basics-payment-storyboard.md` — sequenced steps from `in_progress → completed` through `paid`, each of the 4 payment methods badged per the 5-tier system, the storyboarded homeowner-satisfaction-confirmation gate (flagged as new/proposed), the "Mark Paid is OFFICE-role, in a not-yet-registered module" honest note, plus the admin "flip the switch" `payment_providers` enablement fact for Ch3 to cite | Slice 3 |
| 5 | Ch3 (Admin & Finance, dual persona) | Crib file; `modules/admin-finance` source; Ch2's state-name vocabulary (from crib, not re-derived); Slice 4's payment-storyboard crib fragment (the admin "flip the switch" fact only) | `app/docs/fragments/03-ch3.html` | Slices 3, 4 |
| 6 | Ch4 (Field Tech, Service Technician day) | Crib file; `modules/field-tech` source; state-machine transition table (from crib); Slice 4's payment-storyboard crib fragment (full) | `app/docs/fragments/04-ch4.html` | Slices 3, 4 |
| 7 | Ch5 (Sales & Marketing) | Crib file; `modules/sales-marketing` source | `app/docs/fragments/05-ch5.html` | Slice 3 |
| 8 | Ch6 (Payment & Review, status-only) | Crib file; `modules/payment-review` source; `apps/mobile/src/modules.ts:11-18` | `app/docs/fragments/06-ch6.html` | Slice 3 |
| 9 | Ch7 (Design System, Security Posture & Roadmap) | Crib file; `packages/ui/src/tokens.ts`; RLS facts (from crib) | `app/docs/fragments/07-ch7.html` | Slice 1 only |
| 10 | Appendices A–C | Crib file; `../web/handoff/src/router.ts` (resolves at `Jobcore\web\handoff\src\router.ts`, one level above the `app\` root — see Repo root note above); `../web/handoff/src/screens/awaitingPayment.ts`; component/mockup source | `app/docs/fragments/08-appendices.html` | Slice 1 only |
| 11 | Final assembly (two-part) | Crib file; every fragment's returned heading list (structured metadata, not fragment bodies); `packages/ui/src/tokens.ts` | `app/docs/jobcore-basics-shared.css`, `app/docs/jobcore-basics-shared.js`, then all 5 `app/docs/jobcore-basics-*.html` (stitched from fragments), then re-reads all 7 outputs to confirm | Slices 2–10 all confirmed written |
| 12 | Build report (Rule 8) | Slice 11's confirmation | `E:\Jeff\Desktop\Build-Reports\...` | Slice 11 |

> **Execution note (Slice 11):** at execution time Slice 11 was re-sliced per Rule 38/Rule 33 —
> the original single-dispatch assembly was over-scoped — into 7 parallel sub-dispatches: 2
> shared-asset writes (`jobcore-basics-shared.css`, `jobcore-basics-shared.js`) and 5 HTML
> page-assembly writes (`jobcore-basics-front-matter.html`, `jobcore-basics-admin-finance.html`,
> `jobcore-basics-field-tech.html`, `jobcore-basics-sales-payments.html`,
> `jobcore-basics-appendices.html`). Each sub-dispatch was independently self-verified non-empty,
> with cross-page nav links confirmed resolving to real filenames.

**Concurrency**: Slice 1 gates everything. Slice 3 gates Slices 4–8 (they share Ch2's
state-vocabulary from the crib). Slice 4 (payment storyboard) additionally gates Slices 5 and 6,
since Ch3's admin "flip the switch" fact and Ch4's payment-collection subsection both cite its
output. Slices 5–8 are otherwise mutually independent once their blockers clear — dispatch
concurrently. Slices 9–10 need only Slice 1 and can run concurrently with 3–8. Slice 11 blocks on
every fragment slice (2–10, including the storyboard slice 4 as a transitive prerequisite); Slice
12 blocks on Slice 11.

**Mechanics** (apply to every slice above): dispatch via the `Workflow` tool's `pipeline()`/
`parallel()` — the standard JobCore dispatch mechanism — with `agentType: 'scribe-hound'` on every
write stage (Rule 30's hook blocks a bare write otherwise; Slice 11's assembly agent is Spot per
Rule 22-C's multi-edit threshold). Each fragment-writing slice returns a short structured heading
list (heading text + anchor id) as its result — cheap metadata, not the fragment body — which
Slice 11 uses to build the baked search index. On confirmation of each slice's write, the main
session updates that slice's crib-file status row and lets the slice's source content drop from
its own context — no slice's inputs persist past its own dispatch.

## Verification

- Open `app/docs/jobcore-basics-core.html` in the browser preview; confirm the sidebar lists all
  7 chapters + appendices, and that clicking a Part II chapter navigates to the correct module
  file (a live cross-file link, not a dead anchor).
- Open each of the 4 module files directly (not via the core file) and confirm each renders
  correctly standalone: shared CSS/JS load, sidebar appears, and the `data-jobcore-doc`
  current-chapter highlight matches that file's chapter.
- Use the search box on `jobcore-basics-core.html` to find a heading that lives in a different
  file (e.g. a Chapter 4 heading while viewing the core file); confirm the result links to
  `jobcore-basics-field-tech.html#<anchor>` and lands on the right section.
- Double-click-open one file directly from Explorer (`file://`, no local server) and confirm no
  console errors — this exercises the "baked index, not fetched" design decision.
- Spot-check Chapter 3: confirm both the Admin and Accountant "typical day" subsections are
  present and clearly headed as separate subsections within the one chapter.
- Spot-check Chapter 4: confirm the Service Technician walkthrough references job-lifecycle
  states by name in the order Chapter 2 defines them, and that the "filling an 8-hour day"
  efficiency note is present.
- Spot-check Chapter 4's "Collecting Payment from the Homeowner" subsection: confirm all 4
  payment methods appear, each carries an accurate badge (no method claims 🟢 Built & Live), the
  satisfaction-confirmation gate is clearly marked ⚪ Open Gap (Roadmap), and the "Mark Paid is
  OFFICE-role, in a module Chapter 6 marks unreachable" cross-reference is present.
- Spot-check Chapter 3's Admin subsection: confirm the payment-provider "flip the switch" setup
  callout cites `payment_providers` (org-scoped `enabled`/`config`, admin-only RLS) and honestly
  notes no admin UI screen exists yet to operate it.
- Spot-check Chapter 6 (`jobcore-basics-payment-review.html`): confirm no "Try it" walkthrough
  section is present, the 🔴 Not Reachable badge appears on the chapter heading and each screen
  entry, and the word "Accountant" does not appear anywhere in the file.
- Confirm "Training" appears exactly once across the whole manual — in Chapter 7's roadmap — with
  no content about it anywhere else.
- Spot-check Chapter 2/7 (core file): confirm the RLS hardening section cites both build report
  filenames, the 2026-08-13 date, and `supabase/migrations/0013_rls_fixes.sql` by name.
- Confirm rendered colors match `packages/ui/src/tokens.ts` (sample 3–4 hex values against the
  CSS custom properties in `jobcore-basics-shared.css`).
- Print-preview at least the core file (baseline check) and tab through it once for visible
  keyboard focus.
- Confirm none of the 7 new files were staged/committed in the Jobcore/SDAssemblyPros repo
  (`git status` in that repo shows all 7 untracked, not staged).
