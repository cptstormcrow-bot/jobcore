---
classification: sdassemblypros/jobcore
comments: "Deploying `ups-track`"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/ups-track/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# Deploying `ups-track`

`ups-track` looks up a UPS tracking number for the app. The app POSTs
`{ "trackingNumber": "<number>" }` and the function returns
`{ ok, status, delivered, deliveredAt? }` (`deliveredAt` only when the
package is delivered and UPS supplies the date and time).

JWT verification stays ON (there is no `config.toml` entry for this
function), so callers must send a valid Supabase user JWT.

## 1. Set the UPS credentials

Run these yourself, from the `Jobcore/app` directory. Use placeholders
below; never commit real values.

```
supabase secrets set UPS_CLIENT_ID=<ups-client-id> UPS_CLIENT_SECRET=<ups-client-secret>
```

Get the client id/secret from the UPS Developer Portal (your app's
credentials). Until both are set, the function answers
`{ "ok": false, "error": "ups-not-configured" }`.

Optionally set `UPS_API_BASE` to switch environments (defaults to
`https://onlinetools.ups.com`, the live API):

```
supabase secrets set UPS_API_BASE=<ups-api-base-url>
```

## 2. Deploy the function

```
supabase functions deploy ups-track
```

This requires the Supabase CLI to be logged in and linked to the target
project (`supabase login`, `supabase link --project-ref <project-ref>`).

## 3. Verify (smoke test)

```
curl -X POST "https://<project-ref>.functions.supabase.co/ups-track" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber":"<tracking-number>"}'
```

Expect HTTP 200 with `{"ok":true,"status":"...","delivered":...}`. A bad
number format returns 400 `invalid-tracking-number`; unset secrets return
`ups-not-configured`.

## Unconfirmed UPS details to verify against UPS developer docs before relying on it

- The literal `Authorization: Bearer <token>` header text used on the
  tracking request.
- The optional `locale` query parameter (not currently sent).
- The delivered status type letter `D`: only a third-party Magento issue
  (29659) supports it, not UPS docs.
- Whether the other status type letters (for example `X` for exception)
  apply the way the function assumes.
- An unknown tracking number may return HTTP 200 with warning code `TW0001`
  rather than 404.
- A new shipment may not be trackable for roughly 10 minutes after the
  label is created.

## Notes

- The function must handle all of these UPS responses: 200 with warnings
  (no usable package, reported as "Not found"), 404, 400 with errors
  (both reported as "Not found"), and the unconfigured case
  (`ups-not-configured`).
- Other upstream failures return `ok:false` with `ups-upstream-<code>` or
  `ups-upstream-network`.
- Secrets come from env only and are never logged.
