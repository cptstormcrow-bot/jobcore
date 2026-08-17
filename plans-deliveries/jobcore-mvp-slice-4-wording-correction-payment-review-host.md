---
**Status:** APPROVED (2026-08-14)
classification: plans/cuddly-tumbling-stream
comments: "JobCore MVP — Slice-4 wording correction + payment-review host wiring"
origin: .claude/plans/cuddly-tumbling-stream.md
tags: [plans, cuddly-tumbling-stream]
---

# JobCore MVP — Slice-4 wording correction + payment-review host wiring

## Context

Two items from the 2026-08-14 checkpoint's "Correction on record", both approved by Jeff ("do 1
and 2. go"):

1. The checkpoint flagged that the Slice 4 plan's Out-of-scope section and its build report's
   Forward-contracts section used "on hold" phrasing for Workstream 3 (Android/EAS) that was my own
   unattributed drafting, not something Jeff decided. The canonical `jobcore-mvp-completion.md`
   phrasing for Workstream 3 is "fully pending... R-A: own track" (Rule 15 R-A — externally-gated
   work gets its own track, never blocks the ungated core). Both Slice 4 documents need their
   wording aligned to that canonical phrasing.
2. Workstream 2 item 5 — payment-review module host-wiring — is still undone. The module
   (`@jobcore/payment-review`) exists with a real domain layer and a `setSupabaseClient` injection
   seam, but the host app (`apps/mobile`) never registers the module or calls that seam, so the
   module is dark: unreachable from the nav and its `hasPaymentRecord` transition guard always
   fails closed.

Workstream 3 (Android/EAS) stays out of scope — not selected by Jeff.

## Item 1 — Wording alignment (two files)

Change "on hold" → the canonical phrasing in both places the checkpoint named:

- `Jobcore\app\...\slice-4-fill-rls-test-coverage-gaps.md` (or wherever the plan mirror lives at
  `.claude\plans\slice-4-fill-rls-test-coverage-gaps.md`) — Out-of-scope section.
- `.claude\build-reports\jobcore-mvp-completion\2026-08-14_slice-4-fill-rls-test-coverage-gaps.md`
  — Forward-contracts section.

In each, replace the Workstream 3 (Android/EAS) sentence with wording matching
`jobcore-mvp-completion.md`'s own language: **"fully pending... R-A: own track"** (cite Rule 15
R-A). Do not touch anything else in either file — this is a wording-only correction, not a content
change. Route both edits through Nestor (scribe-hound) per Rule 30.

## Item 2 — payment-review host wiring

Three edits, all in `Jobcore\app\apps\mobile`, following the exact pattern already established for
`field-tech` and `admin-finance`.

**a) Register the module** — `apps/mobile/src/modules.ts`:
Add the import and `registerModule()` call for `paymentReviewModule` from `@jobcore/payment-review`,
mirroring the existing three-module pattern (import + one `registerModule(...)` line).

**b) Inject the Supabase client** — `apps/mobile/app/m/[moduleId].tsx`:
Add a new `useEffect` block gated on `module?.id === 'payment-review'`, following the same shape as
the existing `admin-finance` / `field-tech` blocks:
- Import `{ setSupabaseClient }` from `@jobcore/payment-review` (aliased if needed to avoid
  collision with other modules' setters).
- Import `{ supabase }` from `../../src/lib/supabase` — the shared singleton client, confirmed as
  the correct instance per the same pattern `field-tech-repos.ts` already uses
  (`import { supabase } from './supabase'`, used directly against `supabase.from(...)`).
- Call `setSupabaseClient(supabase)` in the effect body; clean up with `setSupabaseClient(null)`.
- `supabase` (the real `SupabaseClient`) duck-types the module's narrower `SupabaseSelectClient`
  interface (`from().select().eq().in()` → `Promise<{data, error}>`) — no adapter needed.

**c) Wire the real screen** — `Jobcore\app\modules\payment-review\src\index.ts`:
`[moduleId].tsx` renders `route.component` with zero props (`const Screen = route.component; return
<Screen />;`), but `ReconciliationView` (in `screens/ReconciliationView.tsx`) requires a `client`
prop. Replace the `PaymentReviewRoot` placeholder with a new zero-arg wrapper component that:
- Calls `getSupabaseClient()` internally.
- Renders `<ReconciliationView client={...} />` when a client is set.
- Renders a lightweight loading/empty state when `getSupabaseClient()` is still `null` (covers the
  first-render window before the host's `useEffect` has fired).
- Update the `routes: [{ path: 'payment-review', component: ... }]` entry to point at the new
  wrapper instead of `PaymentReviewRoot`. Remove `PaymentReviewRoot` and its now-unused
  `StyleSheet`/`View`/`Text` imports if nothing else in the file needs them.

**Out of scope for item 2** (stated plainly, not silently assumed): the 4 pre-existing TODO stubs —
`domain/handoff.ts:12,42` (QR rendering) and `domain/providers/stripe-link.ts:37` /
`domain/providers/paypal.ts:37` (provider status retrieval) — are provider/domain-layer work, not
host-wiring. They stay untouched; host-wiring only makes the module reachable and gives it a real
Supabase client. Not claiming them done, not touching their code.

## Verification

- `grep -R "PaymentReviewRoot"` in `payment-review/src` returns no hits after the edit.
- `grep -R "paymentReviewModule"` in `apps/mobile/src/modules.ts` returns the new registration line.
- `grep -R "payment-review"` in `[moduleId].tsx` shows the new `useEffect` block, symmetric with the
  `admin-finance`/`field-tech` ones (effect + cleanup).
- TypeScript compiles clean for the touched files (`tsc --noEmit` scoped to `apps/mobile` and
  `modules/payment-review`, or the repo's existing typecheck script if one exists) — this is a type
  compile check only, no server/app is run.
- No RN/Expo dev server is started as part of this change; wiring is verified by read-back + type
  check, not a live app run.

## Delivery

- All writes route through hounds per Rule 30 (Nestor for the two wording edits and the `modules.ts`
  one-liner; Spot for the multi-edit `[moduleId].tsx` and `index.ts` files).
- Checkpoint + `.claude\checkpoints\INDEX.md` updated per Rule 32.
- Tier-A build report authored per Rule 8, with `Forward contracts:` (Rule 25 — e.g., "the 4 TODO
  provider/QR stubs remain open") and `## Deviations / Defects` (Rule 37) fields, delivered to
  `E:\Jeff\Desktop\Build-Reports\`.
