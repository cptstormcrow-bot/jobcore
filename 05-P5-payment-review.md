# P5 — Payment + review: one QR, two outcomes

> Paste this together with `00-MASTER-SPEC.md`. Build **only** what is in *Build this*.

## Context

This phase implements the idea at the heart of the on-site close: **one barcode the customer scans
at completion, which opens their chosen payment portal and then asks for a review.** One code, one
URL, one state machine — not two separate flows bolted together.

It is also the phase with the sharpest compliance edges. Read Master Spec §14 before writing code:
zero PCI scope, no review gating, and payout never depends on the rating.

## What exists already

- Jobs reach `completed` with checklists, photos, and quality notes (P4)
- `applyTransition` already declares the `paid` precondition: a payment record **or**
  `payer != customer` — this phase supplies the real implementation through `ctx`
- Close-out and `commissions` (P3); `customers` with contact details (P2)
- Supabase Edge Functions are already in use for `PriceSheetPublisher` (P3)

## Build this

### 1. Migration `0005_payment_review.sql`

`payment_providers` · `payments` · `handoff_tokens` · `reviews` · `review_requests`.

- `payments` records `job_id`, `provider_id`, `amount`, `status`
  (`pending|confirmed|failed|manual_confirmed`), `external_ref`, `confirmed_at`, `confirmed_by`.
  **No card number, no PAN, no CVV, no token that could be one, ever.**
- `reviews` records `job_id`, `rating`, `body`, `author_display_name`, `platform`
  (`internal|google|facebook|other`), `submitted_at`, and a `publish_ok` consent flag.
- A review row is linked to a job, so the sales module can later attribute it — but the review's
  existence must have **no effect** on any commission, bonus, or payout row.

### 2. The `PaymentProvider` interface

Implement Master Spec §14 exactly:

```ts
interface PaymentProvider {
  id: string;
  displayName: string;
  capabilities: { inApp: boolean; qrHandoff: boolean; webhookConfirm: boolean };
  buildHandoffAction(job: Job, amount: Money): Promise<HandoffAction | null>;
  confirm?(ref: string): Promise<PaymentStatus>;   // webhook-capable providers only
}
```

Ship these implementations:

- **`CashProvider`** and **`CheckProvider`** — no handoff action; tech confirms receipt.
- **`P2PLinkProvider`** (Venmo / CashApp / Zelle) — builds a deep link or payment URL from
  org-configured handles. `webhookConfirm: false`.
- **`StripeLinkProvider`** and **`PayPalProvider`** — hosted checkout link;
  `webhookConfirm: true`, with an Edge Function receiving the webhook and flipping the payment to
  `confirmed`.

The org configures which providers are enabled and their handles/keys in settings. Adding a
provider later must require **no change** to the QR page or the job state machine.

### 3. Tech-confirms-receipt, and why it exists

P2P links have **no webhook** — nothing tells the app the money arrived. So a provider with
`webhookConfirm: false` requires an explicit tech confirmation step, which writes
`status = 'manual_confirmed'` with `confirmed_by`.

Do not paper over this difference. A `confirmed` payment and a `manual_confirmed` payment must be
visually and structurally distinct everywhere they appear, because one is verified by the processor
and the other is a person's word.

### 4. The handoff token

On completion the app requests a **signed, expiring** `handoff_token` scoped to one job. The QR code
encodes only the URL carrying that token. The token must:

- expire (short — hours, not days),
- be single-job scoped and revocable,
- reveal nothing beyond the customer's own job: service, amount due, and the business name.

Render the QR on the tech's device for the customer to scan with their own phone. The customer's
device, not the tech's, is where any payment happens — this is a large part of why PCI scope stays
at zero.

### 5. The hosted handoff page — `web/handoff/`

A small mobile-first web page (the one web surface Jobcore owns — it is **not** part of
sdassemblypro.com and must not be deployed into it). Four states, per Master Spec §14:

1. **`awaiting_payment`** — shown only when `payer = customer`. Lists enabled providers; picking one
   follows its `HandoffAction`. A partner-paid job (`payer = partner`, e.g. Home Depot or Wayfair)
   **skips this state entirely** and opens at `review`.
2. **`confirming`** — waiting on webhook or tech confirmation, with a plain explanation and no
   spinner-forever dead end.
3. **`review`** — a rating, an optional comment, an explicit publish-consent checkbox, and links to
   the public review platforms.
4. **`done`** — thank-you, with the business contact details.

**Every customer reaching this page sees the same review links regardless of rating or of anything
they typed.** Do not branch the page on rating. Do not send low ratings to a private feedback form
and high ratings to Google. That is review gating; it violates Google's policies and the FTC's 2024
consumer-review rule.

### 6. `paid` precondition and close

Supply the real `ctx` implementation: `paid` is legal when a `payments` row for the job is
`confirmed` or `manual_confirmed`, **or** when `payer != customer`. Then `paid → closed` remains the
admin's close-out action from P3.

### 7. Reconciliation view

An admin list of jobs whose payment is `pending` or `failed`, and of `manual_confirmed` payments
grouped by the tech who confirmed them. This is the control that makes the manual path safe rather
than merely convenient.

## Do NOT build

- Any card entry, card storage, tokenization, or card-present terminal integration — zero PCI scope
- Any rating-conditional routing, filtering, incentive, or link suppression
- Any coupling from review rating to commission, bonus, or payout
- Social posting or the review library UI — P6
- Anything deployed into, or reading from, sdassemblypro.com

## Acceptance criteria

1. A `payer = partner` job's QR opens directly at `review`, never showing a payment state.
2. A `payer = customer` job cannot reach `paid` without a `confirmed` or `manual_confirmed` payment.
3. A P2P payment requires an explicit tech confirmation and lands as `manual_confirmed`, visibly
   distinct from a webhook-confirmed payment.
4. Adding a sixth provider requires changes only inside its provider file and org settings — no edit
   to the handoff page or the state machine.
5. A handoff token is single-job scoped, expires, and returns a clean error page afterward.
6. `grep -rni "pan\|cvv\|card_number\|cardnumber" .` returns **no matches** across app, web, and SQL.
7. The review screen is byte-identical for a 1-star and a 5-star submission — same links, same copy,
   same destinations.
8. Submitting any review changes **no** value in `commissions`, `payout_lines`, or any bonus result.
9. A review submitted without the publish-consent flag is stored but never surfaced to P6.

## Verification steps

1. Complete a partner-paid job, scan the QR, and confirm the first state rendered is `review`.
2. Complete a customer-paid job, pay via the Stripe link in test mode, and confirm the webhook flips
   the payment to `confirmed` and the job becomes eligible for `paid`.
3. Repeat with a Venmo link; confirm the job stays ineligible until the tech confirms receipt, and
   that the resulting row reads `manual_confirmed`.
4. Snapshot the review state's DOM for a 1-star and a 5-star path and diff them — expect no
   difference in links or copy.
5. Record `commissions` and `payout_lines` before and after submitting a 1-star review; diff — expect
   zero changes.
6. Let a handoff token expire, re-scan, and confirm a clean expiry page with no job data leaked.
7. Grep the full repo for card-data field names — expect **no matches**.
8. `grep -rn "sdassemblypro" web/handoff` — expect **no matches**.
