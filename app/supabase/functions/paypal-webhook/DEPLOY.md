---
classification: sdassemblypros/jobcore
comments: "Deploying `paypal-webhook`"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/paypal-webhook/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# Deploying `paypal-webhook`

This is the S6b PayPal follow-up to `stripe-webhook`, reusing the same
directory layout and responsibility split (verify signature → parse event →
update the matching `payments` row by `external_ref` → return 200/4xx).

## 1. Deploy the function

From the `Jobcore/app` directory (where `supabase/` lives):

```
supabase functions deploy paypal-webhook
```

This requires the Supabase CLI to be logged in and linked to the target
project (`supabase login`, `supabase link --project-ref <project-ref>`).

## 2. Set the PayPal credentials

Unlike Stripe's manual HMAC check, PayPal verification calls PayPal's own
"Verify webhook signature" API, so the function needs a client id/secret
(to fetch an OAuth token) and the webhook id (to verify against):

```
supabase secrets set PAYPAL_CLIENT_ID=<paypal-client-id>
supabase secrets set PAYPAL_CLIENT_SECRET=<paypal-client-secret>
supabase secrets set PAYPAL_WEBHOOK_ID=<paypal-webhook-id>
```

Get the client id/secret from the PayPal Developer Dashboard (Apps &
Credentials); get the webhook id after registering the webhook endpoint in
step 3.

Optionally set `PAYPAL_API_BASE` to switch environments (defaults to the
live API):

```
supabase secrets set PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

The function also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to
write to the `payments` table. These are provided automatically in the
Supabase Edge Function runtime for project-linked deployments; if deploying
to a self-hosted or non-default environment, set them explicitly:

```
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## 3. Register the webhook in the PayPal Dashboard

1. Go to **Apps & Credentials → (select app) → Webhooks → Add Webhook**.
2. Webhook URL:
   `https://<project-ref>.functions.supabase.co/paypal-webhook`
3. Select events to send:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `CHECKOUT.ORDER.APPROVED`
4. Save the webhook, then copy the **Webhook ID** shown on the webhook's
   detail page — this is the value used in step 2
   (`PAYPAL_WEBHOOK_ID`).

## 4. Verify

Use the PayPal Developer Dashboard's **Webhooks simulator** (same page as
step 3) to send a test `PAYMENT.CAPTURE.COMPLETED` event and confirm the
function returns 200 and updates the matching row.

Check the `payments` table for a row where `external_ref` matches the test
event's capture (or order) id, with `status = 'confirmed'` and
`confirmed_at` set.

## Notes

- Same directory layout as `stripe-webhook`:
  `supabase/functions/paypal-webhook/index.ts` plus this sibling
  `DEPLOY.md`.
- Same responsibility split: verify signature → parse event → update the
  matching `payments` row by `external_ref` → return 200/4xx.
- No card data (PAN, CVV, card number) is ever read or logged by this
  function, matching the `stripe-webhook` rule.
