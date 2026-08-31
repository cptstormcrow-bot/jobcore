---
classification: sdassemblypros/jobcore
comments: "Deploying `estimate-resolve` (manual dashboard steps — no Docker, no Supabase CLI)"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/estimate-resolve/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# Deploying `estimate-resolve`

Public, unauthenticated, **GET-only** Edge Function serving a job estimate's
customer-facing share link (Job Estimate feature, Wave 2). Given `?token=`,
it looks up `estimate_tokens`, verifies it is not expired, and returns a
server-rendered, printable HTML page for the estimate — the function
response **is** the customer-facing page, there is no separate frontend
route. Same service-role-only, no-user-session pattern as `handoff-resolve`,
but reads `estimate_tokens`/`jobs`/`customers`/`organizations`/
`job_estimates`/`job_estimate_line_items` instead.

Project: `vogkxkcceahtwyovpxsg` (https://vogkxkcceahtwyovpxsg.supabase.co).

Jeff does not use Docker and does not run the Supabase CLI locally. Deploy
this function entirely through the **Supabase Dashboard web editor** — no
`supabase functions deploy`, no `supabase link`, no local Docker daemon
required.

## 1. Open the function editor in the Dashboard

1. Go to https://supabase.com/dashboard/project/vogkxkcceahtwyovpxsg/functions.
2. If `estimate-resolve` does not already exist in the list, click
   **Deploy a new function** → **Via Editor** and name it `estimate-resolve`.
   If it already exists (this function was previously deployed live but its
   local source went missing — this file is restoring the source only),
   open it and use **Edit function** instead.

## 2. Paste the source

Copy the full contents of this directory's `index.ts` into the Dashboard's
in-browser editor for `estimate-resolve`, replacing whatever is there. There
is only one file — no `handler.ts` split, no other source files to add.

## 3. Set "Enforce JWT Verification" OFF

In the function's settings panel (or the deploy dialog, depending on
Dashboard version), find **Enforce JWT Verification** / **Verify JWT** and
turn it **off**. This is the Dashboard-UI equivalent of the CLI's
`--no-verify-jwt` flag and is **required** — this function is reached with a
raw `token` query parameter, not a Supabase JWT; default JWT verification
would reject every request before it ever reaches the handler.

## 4. Deploy

Click **Deploy** (or **Save and deploy**, depending on Dashboard version).
No separate secrets step is needed: `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every Edge
Function in this project's runtime — the same as `handoff-resolve` and the
payment webhooks.

## 5. Verify

Replace `<token>` with a real, unexpired `estimate_tokens.token` value (mint
one via the `issue_estimate_token` RPC from an authenticated admin/tech
session, or read one directly from the `estimate_tokens` table in the
Dashboard's Table Editor / SQL Editor for a manual smoke test).

**Success** (valid, unexpired token):

```
curl -i "https://vogkxkcceahtwyovpxsg.supabase.co/functions/v1/estimate-resolve?token=<token>"
```

Expect `200`, `content-type: text/html; charset=utf-8`, and a full HTML
page containing the estimate's header/job-details/materials-table/
completion-schedule/payment-outlay sections plus the `.no-print`
Print/Save-as-PDF button.

**Missing token** (no `?token=` at all):

```
curl -i "https://vogkxkcceahtwyovpxsg.supabase.co/functions/v1/estimate-resolve"
```

Expect `404` with an HTML error page body ("No estimate token was
provided.") — still `text/html`, so it renders instead of downloading.

**Unknown token**:

```
curl -i "https://vogkxkcceahtwyovpxsg.supabase.co/functions/v1/estimate-resolve?token=not-a-real-token"
```

Expect `404` with an HTML error page ("This estimate link is invalid.").

**Expired token** (a token whose `estimate_tokens.expires_at` is in the
past):

```
curl -i "https://vogkxkcceahtwyovpxsg.supabase.co/functions/v1/estimate-resolve?token=<expired-token>"
```

Expect `401` with an HTML error page ("This estimate link has expired.").

## Notes

- Single-file layout, matching `handoff-resolve`:
  `supabase/functions/estimate-resolve/index.ts` plus this sibling
  `DEPLOY.md`.
- All responses — success and error alike — are `text/html`. There is no
  JSON envelope on this function (unlike `handoff-resolve`'s
  `{ "error": string }` shape), because the response itself is the
  customer-facing rendered page, not an API payload.
- Never selects or joins `job_estimates.internal_notes` or any
  commission/payroll table — this is a public page reached without any
  Supabase auth session, same trust boundary as `handoff-resolve`'s
  `handoff_tokens` flow.
- No server-side PDF library. "PDF on demand" is entirely the browser's
  native print-to-PDF via the page's `@media print { @page { margin: 0.75in }
  .no-print { display: none } }` stylesheet and the on-page
  `window.print()` button.
- `estimate_tokens` has no `revoked_at`/consumed concept (unlike
  `handoff_tokens`) — only `expires_at` gates validity, per
  `0037_estimate_tokens.sql`.
