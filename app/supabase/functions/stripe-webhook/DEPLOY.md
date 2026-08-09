---
classification: sdassemblypros/jobcore
comments: "Deploying `stripe-webhook`"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/stripe-webhook/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# Deploying `stripe-webhook`

This is the repo's first Supabase Edge Function and establishes the pattern
that the S6b PayPal webhook will reuse.

## 1. Deploy the function

From the `Jobcore/app` directory (where `supabase/` lives):

```
supabase functions deploy stripe-webhook
```

This requires the Supabase CLI to be logged in and linked to the target
project (`supabase login`, `supabase link --project-ref <project-ref>`).

## 2. Set the webhook secret

Get the signing secret from the Stripe Dashboard (see step 3) and set it as
a function secret so the Edge Function can verify inbound signatures:

```
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

The function also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to
write to the `payments` table. These are provided automatically in the
Supabase Edge Function runtime for project-linked deployments; if deploying
to a self-hosted or non-default environment, set them explicitly:

```
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## 3. Register the webhook in the Stripe Dashboard

1. Go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL:
   `https://<project-ref>.functions.supabase.co/stripe-webhook`
3. Select events to send:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
4. Save the endpoint, then open it and copy the **Signing secret**
   (`whsec_...`) — this is the value used in step 2.

## 4. Verify

Use the Stripe CLI to send a test event and confirm the function returns
200 and updates the matching row:

```
stripe listen --forward-to https://<project-ref>.functions.supabase.co/stripe-webhook
stripe trigger checkout.session.completed
```

Check the `payments` table for a row where `external_ref` matches the test
event's session id, with `status = 'confirmed'` and `confirmed_at` set.

## Notes for the S6b (PayPal) follow-up

- Same directory layout: `supabase/functions/<provider>-webhook/index.ts`
  plus a sibling `DEPLOY.md`.
- Same responsibility split: verify signature → parse event → update the
  matching `payments` row by `external_ref` → return 200/4xx.
- No card data (PAN, CVV, card number) is ever read or logged by this
  function, and the PayPal function should hold to the same rule.
