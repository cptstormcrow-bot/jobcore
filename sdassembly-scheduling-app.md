---
classification: sdassemblypros/jobcore
comments: "Plan — Modular Field-Service Scheduling App: Descriptive Prompt Series"
origin: Codespace/SDAssemblyPros/Jobcore/sdassembly-scheduling-app.md
tags: [sdassemblypros, jobcore]
---
# Plan — Modular Field-Service Scheduling App: Descriptive Prompt Series

> **Naming note:** this file carries a harness-assigned whimsy name. Jeff's `NAME:` directive
> sets the goal-slug name to **`sdassembly-scheduling-app.md`** (this supersedes the earlier
> proposed `sdassembly-modular-scheduling-app-prompt.md`). Plan mode restricts edits to the
> assigned path; rename on the first post-approval commit.

---

## Context

**Goal:** Design a comprehensive, descriptive prompt series Jeff can hand to an AI coding tool to
build a cross-platform (Android + iOS) modular scheduling app — a base scheduling core plus
pluggable modules (Admin/Finance, Handyman/Assembler, Sales/Marketing) — driven by job intake
originating at SDAssemblyPro.com.

**The deliverable is the prompt series, not the app.** No app code is written by this plan.

**Why now.** SD Assembly Pros currently runs on a website that captures a lead and stops. The
existing stack proves the gap precisely:

- `wiki\admin\webpages\SDAssemblyPros\sdassemblypro.com\schema.sql` — the `leads` table has 9
  columns (`name, phone, email, service, preferred_date, preferred_time, address,
  project_details, source_form`) and **no lifecycle at all**: no status, no assignee, no
  checklist, no photos, no payment, no commission.
- `...\admin\leads.php` — the admin view is a **read-only table with no auth and no assignment
  capability**. It is the direct ancestor of the Admin module and shows exactly what's missing.
- `...\api\reviews.php` — the one real JSON read API on the site: `{ok, reviews[]}` with
  `author, avatar, rating, body, source, created_at`, ordered `sort_order ASC, id ASC`. This is
  the integration seam for the Sales/Marketing module's "use reviews off of the page."
- `...\api\submit.php` — a **form-post endpoint, not an API**: no JSON response, no auth, no read
  side, honeypot `_honey`, `_next` redirect, HTTP 303. The app cannot call it.

**Intended outcome:** a durable master spec plus 7 sequenced build prompts, each small enough for
an AI coding tool to execute completely and verify before the next runs.

### Hard constraints (binding)

1. **Website backend is OUT OF SCOPE** — Jeff: *"Keep development of the backend part of the
   website separate for now until I introduce it."* The app therefore defines a **lead-intake
   contract** and ships a manual-entry path; the website plugs into it later.
2. **Analytics stay Google** — locked constraint on that site: *"forms, reviews, everything except
   google analytics. We need that to stay google."* GTM `GTM-TNZSSDC`, GA4 `G-93R89491PL`.
3. **Never modify the site's tracking setup** — `SalesMarketing.md` §14.
4. The site's PHP/MySQL layer is a **throwaway, XAMPP-blocked, unverified mock** — never a
   dependency.

### Locked decisions (from AskUserQuestion this session)

| Decision | Choice |
|---|---|
| Mobile stack | **React Native + Expo** (EAS Build), TypeScript, Expo Router |
| Backend | **Supabase** (Postgres + Auth + RLS + Storage + Realtime + Edge Functions) |
| Payment | **Open/pluggable interface**; completion QR opens the tech's chosen payment portal *and* the review flow |
| Deliverable | **Phased prompt series** — master spec + 7 build prompts |

---

## Domain facts to embed in the spec

Sourced from `wiki\admin\webpages\SDAssemblyPros\SalesMarketing.md` and the memory
`sdassemblypros-project`:

- **Business:** SD Assembly Pros · Stephan Lawrence · (619) 654-2856 · CSLB **#833940**
- **Hours:** Mon–Fri 8am–5pm; Sat–Sun 10am–2pm
- **9 services:** Furniture Assembly · Outdoor Equipment · Fitness & Game Room · Home Theater & TV
  · Wall Hanging & Mounting · Plumbing · Handyman · Carpentry & Construction · Tile & Flooring
- **26 San Diego County service-area communities**
- **Two intake forms with different payloads** — hero quick form = Name/Phone/Service only (**no
  date, no address**); booking form = all 8 customer fields
- **Meta Pixel is still MISSING** on the live site — a real dependency for the Sales module's
  FB/IG ad measurement (existing P0 blocker)

### Requirements the user implied but did not state

1. **Incomplete leads.** A hero-form lead has no date and no address, so it is **not
   schedulable**. Admin needs an explicit *Qualify* step (call customer, fill gaps) before a lead
   can become an assignable job.
2. **Channel is three facts, not one.** *"customer / Home Depot sales / Wayfair"* reads like a
   single enum, but it drives three unrelated subsystems — see **Channel decomposed into three
   independent fields** in the Compensation section below (`source` / `payer` / `attach_timing`).
   The tech's completion flow branches on **`payer`**; the applicable rate is selected by
   **`attach_timing`**; marketing attribution reports on **`source`**.
3. **Requested vs. committed time.** `preferred_date`/`preferred_time` are a customer *request*,
   not a booking. The job record needs separate `requested_window` and `scheduled_start`/`scheduled_end`.
4. **Curated, not chronological, reviews.** `reviews.php` sorts by `sort_order` — the Sales module
   should own reordering, a capability the website side does not have.

---

## Recommended approach

### Deliverable location and shape

```
E:\Jeff\Codespace\SDAssemblyPros\Jobcore\
  00-MASTER-SPEC.md          # durable product + technical spec (the source of truth)
  01-P1-foundation.md        # ─┐
  02-P2-scheduling-core.md   #  │
  03-P3-admin-finance.md     #  │ sequenced build prompts, each self-contained,
  04-P4-field-tech.md        #  │ each ending in a concrete verification checklist
  05-P5-payment-review.md    #  │
  06-P6-sales-marketing.md   #  │
  07-P7-intake-hardening.md  # ─┘
  README.md                  # how to run the series, in order, and what to verify
```

Working name **Jobcore** = the reusable scheduling core; SD Assembly Pros is its first tenant.
Rename freely — the spec treats the brand as a config value, not a hardcode.

### Target architecture the prompts describe

```
jobcore/
  apps/mobile/               Expo app shell — auth, routing, module registry mount
  packages/core/             job state machine, data types, offline queue, sync
  packages/module-sdk/       the plug-in contract (types + registration API)
  packages/ui/               shared design system
  modules/admin-finance/     ← chief module (built first, per Jeff's priority)
  modules/field-tech/
  modules/sales-marketing/
  supabase/                  migrations, RLS policies, edge functions
  web/handoff/               the QR landing page (payment + review state machine)
```

npm/pnpm workspaces. Each module is a workspace package — that is what makes "plug in a module"
mechanically real rather than aspirational.

### The module contract (heart of the spec)

```ts
export interface JobcoreModule {
  id: string;                        // 'admin-finance'
  displayName: string;
  requiredRoles: Role[];             // gates visibility AND is mirrored in RLS
  routes: ModuleRoute[];             // screens contributed to the navigator
  navEntries: NavEntry[];            // icon, label, sort order
  jobActions?: JobAction[];          // buttons injected into the shared Job Detail screen
  hooks?: {
    onJobStatusChange?(e: JobStatusEvent): Promise<void>;
    onJobCompleted?(e: JobCompletedEvent): Promise<void>;
  };
  migrations?: string[];             // module-owned Supabase tables
  settings?: SettingsSchema;
}
```

**Honest constraint to state plainly in the spec:** React Native cannot load native code at
runtime. "Pluggable" therefore means **compile-time registration + runtime toggle** — a module is
added to the registry array and built in, then enabled/disabled per organization via an
`organizations.enabled_modules` column. This is the standard, achievable meaning of modular on
mobile; promising runtime code loading would set the AI tool up to fail.

### Core data model (Supabase / Postgres)

`organizations` · `profiles` (role: `owner|admin|tech|sales`) · `customers` · `leads` (mirrors the
website's 9 columns + `source`, `payer`, `attach_timing`, `qualified_at`, `converted_job_id`) ·
`services` · `service_areas` · **`jobs`** (carries the same three channel fields) ·
`job_assignments` (offer/accept/decline + reason) ·
`checklist_templates` / `checklist_items` / `job_checklist_responses` · `job_photos` (kind:
`before|after|damage|receipt`) · `job_completion` (quality notes, signature) · `payments` ·
`commissions` · `payout_batches` · `time_off_requests` · `tech_availability` · `reviews` ·
`review_requests` · `campaigns` / `ad_posts` · `audit_log`.

**Compensation entities** (see the Compensation section for the rules they encode):
`price_sheets` (versioned, effective-dated, `published_at`) · `service_rates`
(service × `attach_timing` → customer price + tech commission rate) · `compensation_policies`
(versioned: hourly base, bonus rule id + params) · `reimbursements` (from `receipt` photos) ·
`work_sessions` (the derived `en_route → completed` spans that become billable hours) ·
`pay_periods` · `payroll_runs`. Every `commissions` row snapshots the `price_sheet_id` and
`compensation_policy_id` it was computed under, so historical pay never moves when a rate is edited.

**Job state machine** — the spine of the whole app:

```
new → qualified → scheduled → assigned → accepted → en_route → in_progress
    → completed → paid → closed
        ↘ declined  ↘ needs_reschedule  ↘ cancelled
```

Each transition names its permitted roles and required preconditions (e.g. `in_progress` requires
the start checklist submitted; `completed` requires ≥1 after-photo + quality notes; `paid` requires
a payment record **or** `payer != customer`).

**These timestamps are payroll-grade, not telemetry.** Because hourly base pay is *derived* from the
summed `en_route → completed` spans rather than a clock punch, `en_route_at` / `in_progress_at` /
`completed_at` are wage inputs. The spec must therefore state four things explicitly:

- **Offline-sync integrity** — timestamps are captured on-device and may sync hours later. Record
  both `occurred_at` (device clock, the payroll input) and `synced_at` (server clock), and flag any
  row where device time skews from server time beyond a threshold.
- **Audit / tamper trail** — every status transition writes an immutable `audit_log` row (actor,
  from, to, occurred_at, device, geo if available). Retroactive edits by an admin are permitted but
  are *new rows*, never mutations, and must carry a reason.
- **Travel and idle time is an open policy question** — the gap between one job's `completed` and
  the next job's `en_route` is currently unpaid by construction. If Jeff wants paid drive time, that
  is a `compensation_policies` field, not a schema change.
- **Known limitation** — derived hours are a *weaker* compliance basis than a real clock for
  California meal/rest-break and overtime rules. The spec names this openly and names a clock-in
  surface as the upgrade path, so nobody discovers it during a wage audit.

### The lead-intake seam (respects constraint #1)

`LeadIntakeAdapter` interface with three implementations — **only #1 and #2 ship now**:

1. **ManualEntryAdapter** — admin types the lead in. Zero dependencies, always works.
2. **MockFeedAdapter** — reads a local JSON fixture shaped exactly like the `leads` columns, so
   the whole app is demoable before any website work exists.
3. **PollingAdapter / WebhookAdapter** — *specified, not built.* Defines the contract to hand the
   website team when Jeff introduces the backend: `GET /api/leads?since=<iso>` →
   `{ok: true, leads: [...]}`, or `POST` to a Supabase Edge Function with HMAC signature.

The contract is the deliverable; the website implementation is out of scope by instruction.

### Payment + review: one QR, one URL, one state machine

Completion generates a signed, expiring, single-job token → `https://<host>/j/{token}` rendered as
a QR by the tech's app. The customer scans it once. The page transitions:

| State | Shown |
|---|---|
| `awaiting_payment` (`payer = customer` only) | Amount due + the tech's configured pay buttons (Venmo / CashApp / Zelle / PayPal.me / Stripe Payment Link / "Paid cash") |
| `awaiting_confirmation` | "Thanks — your tech is confirming receipt" |
| `review` | Rate 1–5 → **then** Google + Facebook review links, shown to **everyone** regardless of rating |
| `done` | Receipt + contact card |

Jobs with `payer = partner` skip payment entirely and open straight at `review`.

```ts
interface PaymentProvider {
  id: string;
  displayName: string;
  capabilities: { inApp: boolean; qrHandoff: boolean; webhookConfirm: boolean };
  buildHandoffAction(job: Job, amount: Money): Promise<HandoffAction | null>;
  confirm?(ref: string): Promise<PaymentStatus>;   // webhook-capable providers only
}
```

Ships: `ManualCashProvider`, `ExternalLinkProvider` (tech pastes their own portal URL in
settings). Later drop-ins: `StripeProvider`, `SquareProvider` — no job-flow changes required.

**Three properties worth naming in the spec:**
- **Zero PCI scope in v1** — no card data ever touches the app or Supabase.
- **P2P links cannot confirm payment**; only Stripe/PayPal can. Hence the tech-confirms step.
- **No review gating** — filtering by rating violates Google policy and the FTC review rule.

### Sales/Marketing module — realistic scope

- **Ships in v1:** review library (internal reviews + the `{ok, reviews[]}` contract from
  `reviews.php`), curation/reordering, a **pitch picker** that surfaces a review matching the
  prospect's service + community (digitizing the existing `SalesMarketing.md` sales workflow),
  caption composer, and a **"copy caption + save image to camera roll"** fallback that works on
  every platform with zero API review.
- **Ships behind approval:** Facebook Page + Instagram Business posting via Meta Graph API —
  requires a Meta app plus App Review for `pages_manage_posts` / `instagram_content_publish`.
  That is a multi-week approval, not a coding task.
- **Explicitly deferred:** paid ad buying (Marketing API + `ads_management` review) — and it is
  blocked anyway until **Meta Pixel** is installed on sdassemblypro.com.

---

## Phase sequence (the 7 prompts)

Module order follows Jeff's stated priority: Admin/Finance → Handyman/Assembler → Sales/Marketing.

| # | Prompt | Builds | Verifies |
|---|---|---|---|
| P1 | Foundation & module SDK | Expo monorepo, TS, Supabase project, auth, roles, `JobcoreModule` contract + registry, nav shell, 3 empty module stubs | Three logins render three different tab sets |
| P2 | Scheduling core | leads/customers/jobs/services schema, job state machine, calendar + day view, offline queue, RLS policies | Lead → qualify → schedule → job appears on the right day |
| P3 | **Admin/Finance** | Lead inbox (incl. incomplete hero leads), qualify flow, assignment board, dispatch, close-out, commission recording, payout batches, reporting, **price-sheet editor + publish action (`PriceSheetPublisher`), payroll roll-up (`rollUpPeriodPay`), reimbursement approval** | Assign a job; it appears on that tech's day. Publish a price sheet; the feed returns the new version |
| P4 | **Handyman/Assembler** | Morning greeting + accept/decline, day list, job detail, start checklist, photos, quality notes, completion checklist, days-off requests, **earnings view showing derived hours (`en_route → completed` spans) + commissions + reimbursements for the period** | Full on-site flow **in airplane mode**, then syncs; derived hours match the day's timestamps |
| P5 | Payment & review handoff | `PaymentProvider` abstraction, tech payment profiles, handoff token + hosted state-machine page, review capture, `review_requests` | Scan the QR on a real phone; walk pay → review |
| P6 | **Sales/Marketing** | Review library + curation, service/area pitch picker, caption composer, camera-roll fallback, FB/IG posting behind a feature flag | Compose a post from a real review; publish to a test Page |
| P7 | Intake adapters & hardening | `LeadIntakeAdapter` (manual + mock + specified polling/webhook), push notifications, audit log, e2e tests, EAS build + store submission | Mock feed produces a job end-to-end; EAS builds both platforms |

Each prompt file follows the same internal structure: **Context → What exists already → Build this
→ Do NOT build → Acceptance criteria → Verification steps.** The "Do NOT build" section is what
keeps an AI coding tool from stubbing ahead into the next phase.

---

## Files this plan creates

All net-new. **No existing file is modified.**

- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\00-MASTER-SPEC.md`
- `...\Jobcore\01-P1-foundation.md` … `...\Jobcore\07-P7-intake-hardening.md`
- `...\Jobcore\README.md`

Existing artifacts **read and reused, never edited**:

- `wiki\admin\webpages\SDAssemblyPros\sdassemblypro.com\schema.sql` — source of the `leads` field
  list the app's `leads` table mirrors
- `...\sdassemblypro.com\api\reviews.php` — source of the `{ok, reviews[]}` review contract
- `...\sdassemblypro.com\api\submit.php` — source of the 9-field intake wire contract
- `...\sdassemblypro.com\admin\leads.php` — the read-only admin precedent the Admin module extends
- `...\SalesMarketing.md` — services, service areas, hours, license, sales-pitch workflow
- memory `sdassemblypros-project` — Meta Pixel P0 blocker, vendor/client facts

---

## Verification

The prompt series is the artifact, so verification is a **review pass plus a dry run**, not a test suite.

1. **Constraint audit** — grep all 9 files for any instruction that would modify
   sdassemblypro.com, its PHP, its forms, or its GTM/GA4 tags. Expected result: **zero hits**.
   Constraints #1–#4 above are each restated verbatim in `00-MASTER-SPEC.md`.
2. **Coverage trace** — walk Jeff's original request sentence by sentence and confirm each clause
   maps to a named phase and acceptance criterion: web intake → admin assignment → tech receives
   full description/contact/location → arrival + start checklist → completion quality + photos →
   payment → completion checklist → review barcode → admin close-out + commission → tech greeting
   /accept → day list → days off → commission & payroll → sales uses reviews → social posting.
   **All 15 clauses must be covered.**
3. **Self-containment check** — each `PN` file must be executable by an AI tool that has read only
   that file and `00-MASTER-SPEC.md`. No cross-references to sibling prompt files.
4. **Dry run (optional, recommended)** — paste `01-P1-foundation.md` into an AI coding tool in a
   scratch directory and confirm it produces a booting Expo app with three role-gated tab sets and
   no attempt to build P2+ features. This is the real test of whether the phasing holds.
5. **Verification checklists are embedded** — every `PN` file ends with numbered manual steps
   (device, action, expected result) so each phase is provable before the next begins.

---

## Compensation model (specified by Jeff — supersedes the earlier open item)

Tech pay **stacks three components**, computed over a pay period:

```
period_pay = hourly_base × billable_hours
           + Σ per-job commission
           + productivity_bonus (per active policy)
           + Σ reimbursements          ← never a commission deduction
```

1. **Hourly base, derived from job timestamps.** No clock-in/out UI. Billable hours = the summed
   `en_route → completed` spans per day. The spec must state plainly that this number is only as
   good as the tech's status-button discipline, and that a clock-in surface is the upgrade path if
   payroll accuracy ever becomes contested.
2. **Per-job commission, tiered by service, rate varying by attach timing.** Read from the active
   price sheet — never hardcoded.
3. **Productivity bonus — pluggable rule with a documented placeholder.** Jeff supplies the written
   policy before the prompts go to a coding tool. Specified as
   `BonusRule.evaluate(period, tech, jobs[]): BonusResult`, so swapping the policy is a config
   change, not a refactor.
4. **Materials are reimbursed separately.** A `receipt` photo creates a `reimbursements` row against
   the job. The commission base is always the service line — never net of costs.

**Payout feeds review, not the reverse.** The review rating is **not** an input to any pay
component. The payment/close-out event is what advances the QR page into review capture. This keeps
commission finalizable at `completed`/`paid` with no state-machine deferral, and removes any
financial incentive to shape ratings (FTC 2024 consumer-review rule).

### Channel decomposed into three independent fields

The single `channel` enum is replaced — it conflated three facts that drive three different
subsystems:

| Field | Values | Drives |
|---|---|---|
| `source` | `website \| costco \| ikea \| owm` | attribution + marketing reporting |
| `payer` | `customer \| partner` | tech's completion branch; QR page's first state |
| `attach_timing` | `at_purchase \| after_the_fact` | **which price-sheet rate applies** |

Jeff's case — a Costco customer who books assembly on the site later — is
`source=costco, payer=customer, attach_timing=after_the_fact`, which no single enum can express
without a wrong "collect payment" screen or a wrong rate.

### Price sheet — Admin-owned, published as a versioned contract

New entities: **`price_sheets`** (versioned, effective-dated, `published_at`) · **`service_rates`**
(service × `attach_timing` → customer price + tech commission rate) · **`compensation_policies`**
(versioned: hourly base, bonus rule id + params) · **`reimbursements`**.

Versioning is load-bearing: historical payouts must not retroactively change when Jeff edits a
rate. Every `commission` row snapshots the `price_sheet_id` and `compensation_policy_id` it was
computed under.

**`PriceSheetPublisher`** — the outbound mirror of `LeadIntakeAdapter`. The app owns the price sheet
and exposes a documented, versioned read-only JSON feed
(`GET /api/price-sheet/current` → `{ok, version, effective_from, rates[]}`) plus an export file.
The **tech module** consumes it directly. **The website side is NOT built** — per constraint #1 the
contract is simply ready for whoever wires up sdassemblypro.com when Jeff introduces the backend.
Each prompt file's *Do NOT build* section must restate this so a coding tool doesn't reach into the
site.

The commission signature therefore becomes:

```ts
calculateCommission(job, priceSheet, policy): CommissionLine   // per job
rollUpPeriodPay(tech, period, jobs, policy): PeriodPayResult   // per pay period
```

**Phase impact:** P3 gains price-sheet authoring + the publisher; P4 gains the derived-hours
earnings view; P5 is unchanged (payout→review was already the design).

## Notes

- **MCP connectors unavailable this session** — Stripe, Square, PayPal, and QuickBooks connectors
  exist in this environment but are unauthenticated, and OAuth cannot be completed here.
  Authorize via claude.ai connector settings, or `claude mcp` / `/mcp` in an interactive session.
  The pluggable `PaymentProvider` design makes this a non-blocker for v1.
- Per CLAUDE.md Rule 8, the implementing turn ends with a `---BUILD REPORT---` saved to
  `.claude\build-reports\sdassemblypros\`.
- Per Rule 12, this plan file is delivered via `SendUserFile` on approval.
