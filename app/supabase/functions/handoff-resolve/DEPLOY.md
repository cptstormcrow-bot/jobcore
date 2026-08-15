---
classification: sdassemblypros/jobcore
comments: "Deploying `handoff-resolve`"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/handoff-resolve/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# Deploying `handoff-resolve`

Backs the standalone handoff page (`web/handoff`, Jobcore P5.S7a/S7b) with the
two routes `web/handoff/src/api.ts` calls: `GET /:token` and
`POST /:token/providers/:providerId/handoff`. Same service-role-only,
no-user-session pattern as `stripe-webhook`/`paypal-webhook`, but public and
token-scoped rather than provider-signed — the customer holding the QR code
has no Supabase auth session at all (see the `handoff_tokens` RLS comment in
`supabase/0010_payment_review.sql`).

## 1. Deploy the function

From the `Jobcore/app` directory (where `supabase/` lives):

```
supabase functions deploy handoff-resolve --no-verify-jwt
```

`--no-verify-jwt` is **required**. This function is reached with a raw
`handoff_token` in the URL path, not a Supabase JWT — Supabase's default JWT
verification would reject every request before it ever reaches the handler.

This requires the Supabase CLI to be logged in and linked to the target
project (`supabase login`, `supabase link --project-ref <project-ref>`).

## 2. Set the environment

The function needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to read
`handoff_tokens`/`jobs`/`payments`/`payment_providers` and write
`payments`/`review_requests` under the service role (bypassing RLS, since
there is no authenticated caller). These are provided automatically in the
Supabase Edge Function runtime for project-linked deployments; if deploying
to a self-hosted or non-default environment, set them explicitly:

```
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

No provider secrets (Stripe/PayPal keys) are needed here — this function
only records which provider the customer picked and returns a `HandoffAction`
for the page to render; the provider webhooks (`stripe-webhook`,
`paypal-webhook`) own the actual payment confirmation.

## 3. CORS

The function serves `Access-Control-Allow-Origin: *` (the handoff page is a
standalone public site, not same-origin with Supabase) and handles the
`OPTIONS` preflight directly. `Access-Control-Allow-Methods` covers
`GET, POST, OPTIONS`; `Access-Control-Allow-Headers` covers `content-type`.

## 4. Verify

Replace `<project-ref>` and `<token>` below. All error responses are a flat
`{ "error": string }` envelope.

**GET success** (valid, unexpired, unconsumed token):

```
curl https://<project-ref>.functions.supabase.co/handoff-resolve/<token>
```

Expect `200` and a `HandoffJobData` body: `{ jobId, payer, amount, providers }`.

**POST success** (valid token, known provider id — one of `cash`, `check`,
`p2p-link`, `paypal`, `stripe-link`):

```
curl -X POST https://<project-ref>.functions.supabase.co/handoff-resolve/<token>/providers/cash/handoff
```

Expect `200` and a `HandoffAction` body: `{ kind, label, url? }`.

**GET/POST against an unknown token** (404):

```
curl -i https://<project-ref>.functions.supabase.co/handoff-resolve/not-a-real-token
curl -i -X POST https://<project-ref>.functions.supabase.co/handoff-resolve/not-a-real-token/providers/cash/handoff
```

Expect `404` and `{ "error": "Unknown handoff token" }`.

**GET/POST against an expired or consumed token** (410):

Use a token whose `handoff_tokens.expires_at` is in the past, or whose
`revoked_at` is set:

```
curl -i https://<project-ref>.functions.supabase.co/handoff-resolve/<expired-token>
curl -i -X POST https://<project-ref>.functions.supabase.co/handoff-resolve/<expired-token>/providers/cash/handoff
```

Expect `410` and `{ "error": "Handoff token expired or already consumed" }`.

## Notes

- Same directory layout as `stripe-webhook`/`paypal-webhook`:
  `supabase/functions/handoff-resolve/index.ts` plus this sibling
  `DEPLOY.md` — single file, no `handler.ts`/`index.ts` split (no pure-core
  requirement, unlike `price-sheet-current`).
- `409` is returned when a POST names a provider that conflicts with an
  in-flight payment already pending under a different provider for the same
  job.
- `500` covers unexpected Postgres/runtime errors, always via the same
  `{ "error": string }` envelope.
- No card data (PAN, CVV, card number) is ever read, touched, or logged by
  this function, matching the `stripe-webhook`/`paypal-webhook` rule.
