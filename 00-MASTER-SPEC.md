# Jobcore — Master Specification

> **What this file is.** The durable source of truth for a modular, cross-platform field-service
> scheduling app. It is written to be pasted into an AI coding tool **alongside** exactly one phase
> prompt (`01-P1-…` … `07-P7-…`). Every phase prompt assumes this file has been read; no phase
> prompt references any other phase prompt.
>
> **Working name:** *Jobcore* — the reusable scheduling core. **First tenant:** SD Assembly Pros.
> The brand is a config value, never a hardcode.

---

## 1. Product in one paragraph

A customer books a handyman/assembly job on a website. An admin qualifies and assigns it to a tech.
The tech gets a morning greeting, accepts the day's jobs, arrives with a start checklist, documents
the work with photos and quality notes, completes a close-out checklist, and presents a QR code that
lets the customer pay through the tech's own payment portal and then leave a review. The admin
closes the job and records commission. A sales/marketing user pulls the best reviews and turns them
into social posts. Everything above the scheduling core is a **module** that can be enabled or
disabled per organization.

---

## 2. Binding constraints — restate these in every phase

1. **The website backend is OUT OF SCOPE.** Direction from the owner: *"Keep development of the
   backend part of the website separate for now until I introduce it."* The app defines a
   **lead-intake contract** and ships a manual-entry path. Do not write, modify, or call PHP on
   sdassemblypro.com. Do not build the website side of the price-sheet feed.
2. **Analytics stay Google.** GTM `GTM-TNZSSDC`, GA4 `G-93R89491PL` are already live on the site and
   are not the app's business.
3. **Never modify the site's tracking setup.** Reading the numbers is marketing's job; maintaining
   the machinery is not.
4. **The site's PHP/MySQL layer is a throwaway, unverified local mock.** Never make it a dependency.
5. **No review gating.** Never filter who is shown review links by their rating. This violates Google
   policy and the FTC 2024 consumer-review rule.
6. **Zero PCI scope in v1.** No card data touches the app or the database, ever.
7. **copy the site's color scheme and formatting.** the look and feel. colors, fonts, readability and continuity remain identical to the website sdassemblypro.com despite being an android or iOS app.

---

## 3. Locked technical decisions

| Decision | Choice | Why |
|---|---|---|
| Mobile stack | **React Native + Expo** (EAS Build), TypeScript, Expo Router | One codebase → Android + iOS; EAS builds iOS from Windows without a Mac |
| Backend | **Supabase** — Postgres, Auth, Row Level Security, Storage, Realtime, Edge Functions | RLS lets the role model live in the database, not just the UI |
| Repo shape | npm/pnpm **workspace monorepo** | A module is a workspace package — this is what makes "pluggable" mechanically real |
| Payment | **Open/pluggable `PaymentProvider` interface** | The completion QR opens whichever portal the tech configured; Stripe/Square drop in later |
| Offline | Local queue + optimistic UI, sync on reconnect | Techs work in garages, basements, and dead zones |

### The honest limit of "pluggable"

React Native **cannot load native code at runtime.** Say this plainly in the generated code's docs.
"Pluggable" here means **compile-time registration + runtime toggle**:

- a module is a workspace package added to a registry array and compiled in;
- it is then enabled or disabled per organization via `organizations.enabled_modules`.

That is the standard, achievable meaning of modular on mobile. Do not design for runtime code
loading; it would fail on both app stores and in the RN runtime.

---

## 4. Domain facts (SD Assembly Pros — the first tenant)

- **Business:** SD Assembly Pros · Stephan Lawrence · (619) 654-2856 · CSLB **#833940**
- **Hours:** Mon–Fri 8am–5pm; Sat–Sun 10am–2pm
- **Nine services:** Furniture Assembly · Outdoor Equipment · Fitness & Game Room ·
  Home Theater & TV · Wall Hanging & Mounting · Plumbing · Handyman ·
  Carpentry & Construction · Tile & Flooring
- **Service area:** 26 San Diego County communities (seed as a `service_areas` table, not a constant)
- **Two intake forms with different payloads:**
  - *hero quick form* — Name / Phone / Service only. **No date, no address.**
  - *booking form* — all eight customer fields.
- Seed all of the above as **data**, not as literals in components.

---

## 5. What already exists (and what it proves)

The website captures a lead and stops. That gap is the product.

| Artifact | What it is | What it proves |
|---|---|---|
| `leads` table (9 columns) | `name, phone, email, service, preferred_date, preferred_time, address, project_details, source_form` | **No lifecycle whatsoever** — no status, assignee, checklist, photo, payment, or commission |
| `admin/leads.php` | A read-only HTML table, no auth, no assignment | The direct ancestor of the Admin module; shows exactly what is missing |
| `api/reviews.php` | The one real JSON read API: `{ok: true, reviews: [{author, avatar, rating, body, source, created_at}]}`, ordered `sort_order ASC, id ASC` | The Sales module's integration seam — and note the ordering is **curated**, not chronological |
| `api/submit.php` | A **form-post endpoint, not an API** — no JSON response, no read side, honeypot `_honey`, `_next` redirect, HTTP 303 | The app **cannot** call it. Hence the intake adapter contract. |

**There is no price or rate table anywhere on the website side.** The price sheet is net-new, and
the app owns the source of truth.

---

## 6. Requirements implied but not stated — build these

1. **Incomplete leads are not schedulable.** A hero-form lead has no date and no address. Admin needs
   an explicit **Qualify** step (call customer, fill the gaps) before a lead can become a job.
2. **"Channel" is three independent facts** — see §8. A single enum produces a wrong screen or a
   wrong rate.
3. **Requested time ≠ committed time.** `preferred_date` / `preferred_time` are a customer *request*.
   The job carries a separate `requested_window` and `scheduled_start` / `scheduled_end`.
4. **Reviews are curated, not chronological.** The Sales module owns reordering — a capability the
   website side does not have.

---

## 7. Roles

`owner` · `admin` · `tech` · `sales`. Roles gate module visibility **and** are mirrored in RLS
policies. A UI-only role check is not an access control.

---

## 8. Channel decomposed into three independent fields

Replace the single `channel` enum. These three facts drive three unrelated subsystems:

| Field | Values | Drives |
|---|---|---|
| `source` | `direct \| home_depot \| wayfair \| other_partner` | attribution + marketing reporting |
| `payer` | `customer \| partner` | the tech's completion branch; the QR page's first state |
| `attach_timing` | `at_purchase \| after_the_fact` | **which price-sheet rate applies** |

Worked example: a Home Depot customer who books assembly on the site *later* is
`source=home_depot, payer=customer, attach_timing=after_the_fact`. No single enum expresses that
without producing a wrong "collect payment" screen or a wrong rate.

Both `leads` and `jobs` carry all three fields.

---

## 9. Data model (Supabase / Postgres)

**Core:** `organizations` (incl. `enabled_modules`) · `profiles` (`role`) · `customers` ·
`leads` (mirrors the website's 9 columns **plus** `source`, `payer`, `attach_timing`,
`qualified_at`, `converted_job_id`) · `services` · `service_areas` · **`jobs`** (carries the same
three channel fields, plus `requested_window`, `scheduled_start`, `scheduled_end`) ·
`job_assignments` (offer / accept / decline + reason).

**Field work:** `checklist_templates` · `checklist_items` · `job_checklist_responses` ·
`job_photos` (`kind: before|after|damage|receipt`) · `job_completion` (quality notes, signature).

**Money:** `payments` · `commissions` · `payout_batches` · `price_sheets` (versioned,
effective-dated, `published_at`) · `service_rates` (service × `attach_timing` → customer price +
tech commission rate) · `compensation_policies` (versioned: hourly base, bonus rule id + params) ·
`reimbursements` · `work_sessions` (derived `en_route → completed` spans) · `pay_periods` ·
`payroll_runs`.

**People & growth:** `time_off_requests` · `tech_availability` · `reviews` · `review_requests` ·
`campaigns` · `ad_posts`.

**Always:** `audit_log`.

> **Snapshot rule.** Every `commissions` row snapshots the `price_sheet_id` and
> `compensation_policy_id` it was computed under. Editing a rate must never move historical pay.

---

## 10. Job state machine — the spine of the app

```
new → qualified → scheduled → assigned → accepted → en_route → in_progress
    → completed → paid → closed
        ↘ declined   ↘ needs_reschedule   ↘ cancelled
```

Every transition declares its permitted roles and preconditions. Notable ones:

- `in_progress` requires the **start checklist** submitted.
- `completed` requires **≥1 after-photo** and quality notes.
- `paid` requires **a payment record OR `payer != customer`.**

Implement this as a single declarative transition table in `packages/core` — not as scattered `if`
statements in screens. Every UI affordance asks the table what is legal.

### These timestamps are payroll-grade, not telemetry

Because hourly base pay is *derived* from summed `en_route → completed` spans rather than a clock
punch, `en_route_at` / `in_progress_at` / `completed_at` are **wage inputs**. Therefore:

- **Offline-sync integrity** — record both `occurred_at` (device clock, the payroll input) and
  `synced_at` (server clock). Flag any row whose device time skews beyond a threshold.
- **Audit trail** — every transition writes an immutable `audit_log` row (actor, from, to,
  `occurred_at`, device, geo if available). Admin corrections are **new rows with a reason**, never
  mutations.
- **Travel and idle time is unpaid by construction** — the gap between one job's `completed` and the
  next job's `en_route`. Paid drive time is a `compensation_policies` field, not a schema change.
- **Known limitation, stated openly** — derived hours are a *weaker* compliance basis than a real
  clock for California meal/rest-break and overtime rules. A clock-in surface is the named upgrade
  path. Nobody should discover this during a wage audit.

---

## 11. The module contract

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

The shell knows only this interface. A module never imports another module — cross-module
communication goes through `hooks` and shared `packages/core` types.

---

## 12. Compensation model

Tech pay **stacks three components**, computed over a pay period:

```
period_pay = hourly_base × billable_hours
           + Σ per-job commission
           + productivity_bonus (per active policy)
           + Σ reimbursements          ← never a commission deduction
```

1. **Hourly base, derived from job timestamps.** *No clock-in/out UI.* Billable hours = summed
   `en_route → completed` spans per day. State plainly in the generated docs that this number is
   only as good as the tech's status-button discipline.
2. **Per-job commission, tiered by service, rate varying by attach timing.** Always read from the
   active price sheet — never hardcoded.
3. **Productivity bonus — a pluggable rule with a documented placeholder.** The written policy is
   supplied by the owner. Specify as `BonusRule.evaluate(period, tech, jobs[]): BonusResult` so
   swapping the policy is a config change, not a refactor. Ship a `NullBonusRule` returning zero
   plus a clearly-marked example rule.
4. **Materials are reimbursed separately.** A `receipt` photo creates a `reimbursements` row against
   the job. The commission base is always the service line — **never** net of costs.

```ts
calculateCommission(job, priceSheet, policy): CommissionLine   // per job
rollUpPeriodPay(tech, period, jobs, policy): PeriodPayResult   // per pay period
```

### Payout feeds review, not the reverse

The review rating is **not** an input to any pay component. The payment/close-out event is what
advances the QR page into review capture. This keeps commission finalizable at `completed`/`paid`
with no state-machine deferral, and removes any financial incentive to shape ratings.

### Price sheet — admin-owned, published as a versioned contract

`PriceSheetPublisher` is the outbound mirror of `LeadIntakeAdapter`. The app owns the price sheet and
exposes a documented, versioned, **read-only** JSON feed:

```
GET /api/price-sheet/current
→ { ok: true, version: 7, effective_from: "2026-08-01", rates: [ … ] }
```

plus a static export file. The **tech module** consumes it directly. **The website side is NOT
built** (constraint #1) — the contract is simply ready for whoever wires up sdassemblypro.com later.

---

## 13. Lead intake — the seam that respects constraint #1

```ts
interface LeadIntakeAdapter {
  id: string;
  fetchSince(iso: string): Promise<RawLead[]>;   // RawLead mirrors the 9 website columns
}
```

| # | Adapter | Status |
|---|---|---|
| 1 | **ManualEntryAdapter** — admin types the lead in | **Ships.** Zero dependencies, always works |
| 2 | **MockFeedAdapter** — reads a local JSON fixture shaped exactly like the `leads` columns | **Ships.** Makes the whole app demoable before any website work exists |
| 3 | **PollingAdapter / WebhookAdapter** | **Specified, not built.** `GET /api/leads?since=<iso>` → `{ok: true, leads: [...]}`, or an HMAC-signed `POST` to a Supabase Edge Function |

---

## 14. Payment + review: one QR, one URL, one state machine

Completion generates a **signed, expiring, single-job token** → `https://<host>/j/{token}`, rendered
as a QR by the tech's app. The customer scans it once. The hosted page transitions:

| State | Shown |
|---|---|
| `awaiting_payment` (**`payer = customer` only**) | Amount due + the tech's configured pay buttons (Venmo / CashApp / Zelle / PayPal.me / Stripe Payment Link / "Paid cash") |
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

Ships: `ManualCashProvider`, `ExternalLinkProvider` (the tech pastes their own portal URL in
settings). Later drop-ins: `StripeProvider`, `SquareProvider` — with **no job-flow changes**.

Three properties worth stating in the generated docs:

- **Zero PCI scope in v1.**
- **P2P links cannot confirm payment** — only Stripe/PayPal can. Hence the tech-confirms-receipt step.
- **No review gating** (constraint #5).

---

## 15. Sales/Marketing — realistic scope

- **Ships in v1:** review library (internal reviews + the `{ok, reviews[]}` contract), curation and
  reordering, a **pitch picker** that surfaces a review matching the prospect's service + community,
  a caption composer, and a **"copy caption + save image to camera roll"** fallback that works
  everywhere with zero API review.
- **Behind a feature flag:** Facebook Page + Instagram Business posting via the Meta Graph API —
  needs a Meta app plus App Review for `pages_manage_posts` / `instagram_content_publish`. That is a
  multi-week approval, not a coding task.
- **Explicitly deferred:** paid ad buying (Marketing API + `ads_management` review) — blocked anyway
  until **Meta Pixel** is installed on sdassemblypro.com, which it currently is not.

---

## 16. Target repo layout

```
jobcore/
  apps/mobile/               Expo app shell — auth, routing, module registry mount
  packages/core/             job state machine, data types, offline queue, sync
  packages/module-sdk/       the plug-in contract (types + registration API)
  packages/ui/               shared design system
  modules/admin-finance/     ← chief module (built first)
  modules/field-tech/
  modules/sales-marketing/
  supabase/                  migrations, RLS policies, edge functions
  web/handoff/               the QR landing page (payment + review state machine)
```

---

## 17. Phase map

| # | Prompt file | Builds |
|---|---|---|
| P1 | `01-P1-foundation.md` | Monorepo, auth, roles, module SDK + registry, nav shell, 3 stubs |
| P2 | `02-P2-scheduling-core.md` | Schema, job state machine, calendar/day view, offline queue, RLS |
| P3 | `03-P3-admin-finance.md` | Lead inbox, qualify, assign, close-out, price sheet + publisher, payroll |
| P4 | `04-P4-field-tech.md` | Greeting/accept, day list, checklists, photos, days off, earnings |
| P5 | `05-P5-payment-review.md` | `PaymentProvider`, handoff token, hosted QR state machine, reviews |
| P6 | `06-P6-sales-marketing.md` | Review library, pitch picker, composer, camera-roll fallback, FB/IG flag |
| P7 | `07-P7-intake-hardening.md` | Intake adapters, push, audit log, e2e tests, EAS build + submission |

Each phase prompt follows the same internal structure: **Context → What exists already → Build this
→ Do NOT build → Acceptance criteria → Verification steps.** The *Do NOT build* section is what stops
a coding tool from stubbing ahead into the next phase.
