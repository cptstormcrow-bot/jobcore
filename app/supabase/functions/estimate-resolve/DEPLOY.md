---
classification: sdassemblypros/jobcore
comments: "Deploying `estimate-resolve` with the Supabase CLI (--use-api, no Docker)"
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

## 1. Deploy with the CLI (no Docker)

The CLI is linked to this project from `app/`. Run from `app/`:

```
npx supabase functions deploy estimate-resolve --no-verify-jwt --use-api
```

- `--use-api` bundles on Supabase's side, so no local Docker daemon is needed.
- `--no-verify-jwt` is **required**: this function is reached with a raw
  `token` query parameter, not a Supabase JWT, so JWT verification would
  reject every request before it reaches the handler.
- The CLI uploads both source files, `index.ts` and `estimate-layout.ts`
  (the page layout, including the Fine Print). A Dashboard paste of
  `index.ts` alone would break the import, so don't deploy that way.

No separate secrets step is needed: `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every Edge
Function in this project's runtime — the same as `handoff-resolve` and the
payment webhooks.

Last deployed 2026-11-02 (reschedule fee Fine Print, commits e340579 and
0bf3a5c).

## 2. Verify

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

- Two source files: `index.ts` (token lookup, data reads) and
  `estimate-layout.ts` (the HTML page), plus this sibling `DEPLOY.md`.
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
