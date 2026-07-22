# P7 — Intake adapters, notifications, and hardening

> Paste this together with `00-MASTER-SPEC.md`. Build **only** what is in *Build this*.

## Context

Every feature module now exists. This final phase closes the loop back to the **first mover** —
a customer booking on SDAssemblyPro.com — and hardens the app for real use: push notifications,
audit review, end-to-end tests, and store builds.

The critical discipline here: **the website side is still out of scope.** This phase builds the
app's half of the intake contract and nothing else. When Jeff introduces the website backend, the
adapter should already be waiting for it.

## What exists already

- P1 shell + module registry; P2 schema, state machine, offline queue; P3 admin/finance;
  P4 field-tech; P5 payment + review; P6 sales/marketing
- `leads` already mirrors the website's nine columns exactly, plus the three axis fields (P2)
- The `LeadIntakeAdapter` contract from Master Spec §13, with `ManualEntryAdapter` and
  `MockFeedAdapter` already shipping
- `PriceSheetPublisher` serving `GET /api/price-sheet/current` (P3)

## Build this

### 1. Complete the intake adapters

Implement the two adapters Master Spec §13 specified but did not ship:

- **`PollingAdapter`** — polls a configured endpoint on an interval, pages by a cursor
  (`since` timestamp or last-seen id), and upserts leads **idempotently** on a stable external id.
  Polling is the safer default: it needs no inbound firewall hole and it recovers on its own after
  an outage.
- **`WebhookAdapter`** — a Supabase Edge Function receiving a signed POST, verifying an HMAC shared
  secret, rejecting replays via a nonce or timestamp window, and returning fast.

Both write into `leads` through **one** shared normalizer so the three axis fields (`source`,
`payer`, `attach_timing`) are derived in exactly one place. Unknown or absent values default to
`direct` / `customer` / `at_purchase` and are flagged for the Qualify step rather than silently
assumed.

Configuration selects the active adapter. With none configured, `ManualEntryAdapter` remains the
mode, and the app is fully usable.

**Do not write, deploy, modify, or scaffold any code on sdassemblypro.com** — not its PHP, not its
forms, not its database, and above all not its GTM/GA4 tags. Document the contract the website would
need to satisfy in `docs/intake-contract.md` and stop there.

### 2. Push notifications

Expo push, with server-side sends from Edge Functions on: a job assigned to a tech, a job declined
or needing reschedule, a payment confirmed, a reimbursement approved or rejected, and a new lead
needing qualification.

Notifications are a **convenience layer, never a correctness dependency** — every one of these
events must remain discoverable by opening the app. Per-user, per-event-type preferences, and no
notification ever contains payment details or a handoff token.

### 3. Audit log review

An owner/admin screen over `audit_log`: filter by job, actor, entity type, and date; show
`occurred_at` alongside `synced_at` with skew-flagged rows called out. Read-only, with export.

This is the screen that makes derived hours defensible if a tech ever disputes a paycheck. Treat it
as a payroll record, not a debug view.

### 4. End-to-end tests

At minimum, one full path per persona:

- Lead arrives (mock adapter) → qualified → assigned → accepted → en route → started → completed →
  closed → commission recorded → included in a payout batch.
- The same job run **entirely offline** on the tech side, then synced.
- A partner-paid job skipping the payment state at the handoff page.
- A `tech` and a `sales` user each attempting to read admin-only tables and being denied by RLS.

RLS assertions live in `supabase/tests/` and run in CI. **A UI-only access test proves nothing.**

### 5. Error handling, observability, and accessibility

Typed error surfaces with human-readable recovery text; crash and error reporting; structured logs
on sync failures. Screen-reader labels, minimum touch targets, and legible contrast — a tech reads
this screen outdoors in San Diego sun.

### 6. Store builds and submission

EAS Build profiles (development / preview / production), app icons and splash, versioning and build
numbering, and EAS Submit configuration for both stores. Document required store metadata: privacy
policy, data-collection disclosures (photos, location, contact data), and the justification strings
for camera and location permissions.

Note plainly that camera and location permission prompts must explain their real purpose — job
documentation and capture verification — because a vague prompt is both a rejection risk and a
trust cost with the techs.

### 7. Documentation

- `docs/intake-contract.md` — the endpoint shape the website would need to expose, written as a
  request the website owner can fulfill later
- `docs/deployment.md` — Supabase project setup, migration order, secrets, and EAS
- `docs/adding-a-module.md` — the module contract walkthrough
- `docs/compensation.md` — the four-term formula, derived hours, and the `BonusRule` seam awaiting
  the written productivity policy

## Do NOT build

- Any code, config, tag, form, or database change on sdassemblypro.com
- Any Meta Pixel, GTM container change, or GA4 property change — analytics stays Google and its
  machinery is not this app's to maintain
- Paid ads, review gating, or card handling
- A bonus formula — the seam stays `NullBonusRule` until the written policy arrives
- New feature surface of any kind; this phase completes and hardens what exists

## Acceptance criteria

1. Switching the configured adapter from mock to polling changes lead intake with **no** change to
   the Qualify screen or to `leads`.
2. Delivering the same external lead id twice creates exactly one `leads` row.
3. A webhook POST with a bad signature, or a replayed one, is rejected and logged.
4. A lead arriving without axis values lands as `direct`/`customer`/`at_purchase` **flagged for
   review**, not silently assumed correct.
5. Disabling push leaves every event discoverable in-app.
6. No notification payload contains a handoff token or payment amount.
7. The e2e suite passes, including the fully-offline tech run.
8. RLS denial tests pass at the database level for both `tech` and `sales`.
9. `eas build` produces installable iOS and Android artifacts, and `eas submit` is configured.
10. A repo-wide grep for anything that writes to sdassemblypro.com returns **no matches**.

## Verification steps

1. Run the mock adapter, then the polling adapter against a local stub; confirm identical `leads`
   rows and an unchanged Qualify screen.
2. Replay the same payload three times; `select count(*) from leads where external_id = …` returns 1.
3. POST to the webhook with a wrong HMAC and with a stale timestamp; confirm both are rejected.
4. Inspect a lead delivered without axis values and confirm the review flag is set.
5. Trigger each notification type; inspect the payloads for tokens or amounts — expect none.
6. Run the full e2e suite, including the airplane-mode path, twice.
7. Run `supabase/tests/` RLS assertions in CI and confirm they fail the build when a policy is
   loosened.
8. Build both platforms via EAS and install on a physical device of each.
9. `grep -rni "sdassemblypro" .` — every hit must be documentation or a read-only reference; **no**
   write path, no deploy step, no form, no tag.
10. `grep -rn "GTM-\|G-93R\|gtag(\|fbq(" .` — expect **no matches** anywhere in the repository.
