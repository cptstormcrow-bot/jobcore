---
classification: sdassemblypros/jobcore
comments: "Jobcore — Slice 3: author price-sheet-current + handoff-resolve Edge Functions"
origin: .claude/plans/delegated-nibbling-squid.md
tags: [sdassemblypros, jobcore, plan]
---

# Slice 3 — Author `price-sheet-current` and `handoff-resolve` Edge Functions

## Context

Workstream 2 (Supabase verification & close-out) item 3 calls for authoring the two Edge Functions
the drafts specified but that still don't exist on disk: `price-sheet-current` (admin-finance price
feed, ledger group `P3-j`) and `handoff-resolve` (payment-review handoff API, workstream-A slice A6).
Both were deferred out of Phase 3 close-out as EXEC-GATED — blocked only on the Deno/Supabase deploy
step, not on authoring the code. This slice writes the code, the deploy docs, and the two forward-
reference doc rides (`app/supabase/README.md`, `app/package.json`) so both functions are complete,
tested where testable, and ready to deploy in a future gated session. **Deploying either function to
Supabase is out of scope for this slice** — that remains a future explicit go-ahead from Jeff.

Both functions follow the existing service-role-only Edge Function archetype already established by
`app/supabase/functions/stripe-webhook/` and `paypal-webhook/` (each ships an `index.ts` + `DEPLOY.md`
pair), rather than the dual-authenticated-client pattern used by `meta-publish/`, because both new
functions serve unauthenticated public/token-based callers by design.

## Recommended approach

### 1. `price-sheet-current` (ledger group P3-j, admin-finance)

Directory: `app/supabase/functions/price-sheet-current/`

Per `handoff/P3-SLICE-LEDGER.md` group P3-j, this function is **split** into a pure core and a thin
transport adapter — the only one of the two new functions that needs this split, because it's the only
one the ledger mandates a fixture-provable pure function for:

- **`deno.json`** — scaffold, following the layout precedent already used by `meta-publish`/
  `stripe-webhook`/`paypal-webhook`.
- **`handler.ts`** — pure `buildFeed(sheet, rates): FeedBody` (row P3j.2a/P3j.2b). Selects *only*
  published sheets and their rates — nothing else. No Deno/DB dependency, so it's fixture-testable in
  plain Node. `FeedBody` shape, derived from `app/supabase/0005_money.sql`'s `price_sheets` /
  `price_sheet_rates` tables:
  ```ts
  interface FeedBody {
    organization_id: string;
    version: number;
    effective_from: string;
    published_at: string;
    rates: Array<{
      service_id: string;
      attach_timing: "at_purchase" | "after_the_fact" | "before_start" | null;
      amount_cents: number;
    }>;
  }
  ```
- **`index.ts`** — GET-only `Deno.serve` transport (row P3j.3a/P3j.3b): 405 on any other method;
  reads via the **service-role client only** (never anon/authenticated) because
  `price_sheets_admin_all` / `price_sheet_rates_admin_all` RLS is admin-only in every direction — the
  public feed can't be read any other way; sets `Cache-Control`; no auth by design, matching the
  `stripe-webhook`/`paypal-webhook` public pattern.
- **`__assertions__/*.assert.ts`** — fixture assertion(s) for `buildFeed` (row P3j.2b/P3j.5),
  following the same `.assert.ts` convention as the existing 18 files under `modules/`/`packages/`.
- **`DEPLOY.md`** — same structure as `stripe-webhook/DEPLOY.md` / `paypal-webhook/DEPLOY.md`: deploy
  command `supabase functions deploy price-sheet-current --no-verify-jwt` (required — `verify_jwt`
  must be `false`, this is a public feed), env/secrets, verify steps.

### 2. `handoff-resolve` (workstream-A slice A6, payment-review)

Directory: `app/supabase/functions/handoff-resolve/`

Single-file — **no handler.ts/index.ts split**. The P3-j ledger's split requirement is scoped
specifically to `price-sheet-current`; `handoff-resolve` belongs to a different phase (payment-review)
with no ledger-mandated split, and forcing artificial symmetry would add an untested seam for no
benefit. Design validated field-for-field against `web/handoff/src/types.ts` (`ProviderSummary`,
`HandoffJobData`, `HandoffState`) and `web/handoff/src/api.ts` (route shapes), and against the DB
schema in `app/supabase/0010_payment_review.sql` (`payment_providers`, `payments`, `handoff_tokens`,
`reviews`, `review_requests`).

- **`index.ts`**:
  - `createClient` with `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (service-role only, same
    rationale as above — token-based public access, no user auth session).
  - `CURRENCY = "USD"` constant; `CORS_HEADERS`; `jsonResponse` / `errorResponse` helpers (flat
    `{error: string}` envelope).
  - Inline `Money` / `HandoffAction` / `ProviderCapabilities` interfaces — reimplemented rather than
    imported from `app/modules/payment-review/src/domain/providers/types.ts`, since Edge Functions run
    under Deno outside the npm/tsc workspace tree (`package.json` `workspaces` covers `apps/*`,
    `packages/*`, `modules/*` only).
  - `PROVIDER_CAPABILITIES` record covering `cash` / `check` / `p2p-link` / `paypal` / `stripe-link`.
  - `buildHandoffAction()`, `resolveToken()` (against `handoff_tokens`), `normalizePayer()`,
    `findOrCreateReviewRequest()`.
  - `handleGetJobData()` / `handlePostHandoffAction()`, dispatched from a path-routing `Deno.serve`:
    `GET /:token` and `POST /:token/providers/:providerId/handoff`.
  - Status codes: `404` (unknown token), `410` (expired/consumed token), `409` (conflicting
    action/provider state), `500` (unexpected).
  - CORS: `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`,
    `Access-Control-Allow-Headers: content-type`.
- **`DEPLOY.md`** — Rule-21 frontmatter matching the template; deploy command
  `supabase functions deploy handoff-resolve --no-verify-jwt` (required — token-based public access,
  no Supabase auth session); env/secrets section; CORS section; Verify section with curl examples for
  GET/POST success paths and the 404/410 error paths.

No fixture test for `handoff-resolve` — it has no pure core to isolate (unlike `price-sheet-current`),
consistent with not forcing the split.

### 3. Doc ride — `app/supabase/README.md` (Rule 31)

The file has no existing `## Edge Functions` heading (confirmed — full 190-line read). Append a new
top-level section at the very end of the file (after the current last line, the "Uninvited signup —
`signup_attempts`" subsection), as a sibling to `## Closed gap...` and `## Signup provisioning...`.
Do not touch the file's existing frontmatter block (lines 1-6) — append below existing content only.

```
## Edge Functions

### price-sheet-current
[public price feed; service-role read; --no-verify-jwt required; pure buildFeed + Deno transport]

### handoff-resolve
[token-based handoff resolution API; service-role; --no-verify-jwt required; GET/POST routes]
```

Both subsections record that deploy **requires** `--no-verify-jwt` / `verify_jwt = false` — this is
the ledger's explicit P3j.4 requirement and applies identically to `handoff-resolve`.

### 4. `app/package.json` — wire the new fixture test into `npm test`

Current `"test"` script globs six `__assertions__/*.assert.ts` paths under `modules/` and
`packages/`; none cover `supabase/functions/**`. Append one new glob entry, following the exact same
convention as the existing six, so `price-sheet-current`'s new fixture test actually runs:

```diff
- ...packages/core/src/__assertions__/*.assert.ts packages/core/src/offline/__assertions__/*.assert.ts",
+ ...packages/core/src/__assertions__/*.assert.ts packages/core/src/offline/__assertions__/*.assert.ts supabase/functions/price-sheet-current/__assertions__/*.assert.ts",
```

(Full current string is in `app/package.json` line 15 — patch in place, everything else in the file
unchanged.) `handoff-resolve` needs no entry — it has no fixture test.

## Critical files

- `app/supabase/functions/price-sheet-current/deno.json` (new)
- `app/supabase/functions/price-sheet-current/handler.ts` (new)
- `app/supabase/functions/price-sheet-current/index.ts` (new)
- `app/supabase/functions/price-sheet-current/__assertions__/build-feed.assert.ts` (new)
- `app/supabase/functions/price-sheet-current/DEPLOY.md` (new)
- `app/supabase/functions/handoff-resolve/index.ts` (new)
- `app/supabase/functions/handoff-resolve/DEPLOY.md` (new)
- `app/supabase/README.md` (append `## Edge Functions` section)
- `app/package.json` (append one glob entry to `scripts.test`)

Reused patterns: `app/supabase/functions/stripe-webhook/index.ts` + `DEPLOY.md` and
`paypal-webhook/index.ts` + `DEPLOY.md` (service-role-only archetype, both files); `app/modules/
payment-review/src/domain/providers/types.ts` (field reference only, not imported); `web/handoff/
src/types.ts` and `web/handoff/src/api.ts` (response/route shape source of truth); existing
`__assertions__/*.assert.ts` files under `modules/admin-finance/` (fixture-test convention).

## Verification

1. `npm test` (from `app/`) — confirm the new `price-sheet-current` fixture assertion runs and passes
   alongside the existing 18 `.assert.ts` files (19 total), exercising `buildFeed` purely in Node —
   no Deno or live DB needed.
2. `npm run typecheck` — confirm the new files don't break the monorepo build (Edge Functions run
   under Deno at deploy time, but should still be lint/type-clean where checked).
3. Manual read-through of both `DEPLOY.md` files against the `stripe-webhook`/`paypal-webhook`
   templates to confirm structural parity (deploy command, env/secrets, CORS, verify steps).
4. Confirm `app/supabase/README.md` renders correctly with the new section appended and existing
   frontmatter/content untouched.
5. Actual Supabase deploy and live curl verification is **out of scope** — deferred to a future
   explicit go-ahead (EXEC-GATED, per row 106 of the canonical plan and the P3-j ledger group).

## Out of scope

- Deploying either function to Supabase.
- Slice 4 (RLS test-coverage fill) and Slice 5 (payment-review wiring) — on hold.
- Any change related to the Supabase project naming (settled, not revisited).
