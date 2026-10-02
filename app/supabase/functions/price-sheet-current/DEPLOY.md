---
classification: sdassemblypros/jobcore
comments: "Deploying `price-sheet-current`"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/price-sheet-current/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# Deploying `price-sheet-current`

This is a public, unauthenticated price-feed endpoint — a GET-only sibling
to `stripe-webhook`/`paypal-webhook` in directory layout and in relying on a
service-role Supabase client for all DB access (never anon/authenticated),
because the `price_sheets` and `price_sheet_rates` RLS policies are
admin-only in every direction (see `supabase/migrations/0005_money.sql`).

## 1. Deploy the function

From the `Jobcore/app` directory (where `supabase/` lives):

```
supabase functions deploy price-sheet-current --no-verify-jwt
```

`--no-verify-jwt` is REQUIRED (`verify_jwt` must be `false`) because this is
a public price feed with no Supabase auth session — callers never send a
JWT, and Supabase's default JWT-verification gate would reject every request
with 401 if left on.

This requires the Supabase CLI to be logged in and linked to the target
project (`supabase login`, `supabase link --project-ref <project-ref>`).

## 2. Env / secrets

The function needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to read
`price_sheets` and `price_sheet_rates` under the service role (bypassing the
admin-only RLS policies, since this endpoint has no authenticated caller to
carry an admin session). These are provided automatically in the Supabase
Edge Function runtime for project-linked deployments; if deploying to a
self-hosted or non-default environment, set them explicitly:

```
supabase secrets set SUPABASE_URL=https://<project-ref>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

No other secrets are required — this function makes no outbound calls to a
third-party API.

## 3. Response caching

The response sets `Cache-Control: public, max-age=60` — a 60-second public
cache. The feed only changes on a publish event (see
`publish_price_sheet` in `0005_money.sql`), which is infrequent, so a short
TTL bounds the staleness window after a publish without adding any
cache-invalidation machinery.

## 4. Verify

```
curl "https://<project-ref>.functions.supabase.co/price-sheet-current"
```

Expected response (200, `content-type: application/json`) when an
organization has a published price sheet:

```json
{
  "organization_id": "<uuid>",
  "version": 3,
  "effective_from": "2026-08-01",
  "published_at": "2026-08-01T12:00:00.000Z",
  "rates": [
    { "service_id": "<uuid>", "attach_timing": "at_purchase", "task_id": null, "amount_cents": 5000 }
  ]
}
```

Each rate's `task_id` is `null` for a service-level rate, or the id of a service task for a task-level rate.

A non-GET request (e.g. `curl -X POST ...`) should return `405 Method Not
Allowed`. If no organization has a published sheet, the function returns
`404` with `{ "error": "No published price sheet" }`.

## Notes

- Same directory layout as `stripe-webhook`/`paypal-webhook`:
  `supabase/functions/price-sheet-current/index.ts` plus this sibling
  `DEPLOY.md`.
- Unlike the webhook functions, this endpoint is GET-only and has no
  signature/auth verification step by design — access control is the
  service-role DB credential, not a caller-presented JWT or signature.
- The row-selection and mapping logic lives in the pure `buildFeed()`
  function in `./handler.ts`, tested independently via
  `__assertions__/build-feed.assert.ts` (Node, no Deno import, no DB).
