---
classification: sdassemblypros/jobcore
comments: "Lead intake contract (P7 Slice A)"
origin: Codespace/SDAssemblyPros/Jobcore/docs/intake-contract.md
tags: [sdassemblypros, jobcore]
---
# Lead intake contract (P7 Slice A)

This document describes the contract a lead source — the website's hero
quick-form, a booking form, a partner referral feed, or a future channel —
must satisfy to get leads into Jobcore. It covers the in-process adapter
layer added in `modules/admin-finance/src/data/`; it does **not** cover any
live Supabase wiring, webhook signature/replay verification, or external-id
dedup — those are explicitly deferred past this slice (see
`E:\Jeff\.claude\plans\jobcore-p7-hardening-no-supabase-scope.md`).

## Shapes

### `RawLead` (`modules/admin-finance/src/domain/intake-normalize.ts`)

The untrusted, source-supplied shape. Every field an intake source might
plausibly omit is nullable; `source`, `payer`, and `attachTiming` are the
three "axis" fields the business needs but a quick form typically doesn't
collect, so they are optional (`string | null | undefined` via `?:`) rather
than required.

```ts
interface RawLead {
  sourceForm: string;
  name: string;
  phone: string | null;
  email: string | null;
  service: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  address: string | null;
  projectDetails: string | null;
  source?: string | null;
  payer?: string | null;
  attachTiming?: string | null;
}
```

### `NormalizedLead` / `NewLeadDraft`

`normalizeRawLead(raw, organizationId)` fills any missing axis field with a
fixed default (`DEFAULT_AXIS_VALUES`: `source: 'website'`,
`payer: 'customer'`, `attachTiming: 'at_purchase'`) and reports which fields
it had to assume:

```ts
interface NormalizedLead {
  draft: NewLeadDraft;               // ready for LeadRepository.create
  assumedAxisFields: readonly AxisField[];
  flaggedForReview: boolean;         // true iff assumedAxisFields.length > 0
}
```

`flaggedForReview` is **computed, in-process only** in this slice — there is
no durable `leads.axis_flagged_for_review` column yet. A caller that needs
the flag to survive past one sync run must capture `IntakeSyncResult` itself
(see below); it is not persisted.

## Adapter contract (`modules/admin-finance/src/data/intake-adapter.ts`)

```ts
interface LeadIntakeAdapter {
  readonly id: string;
  fetchSince(sinceIso: string): Promise<readonly RawLead[]>;
}
```

Any intake source implements this one method: given an ISO timestamp cursor,
return every raw lead observed since then. This slice ships two concrete
adapters:

- **`ManualEntryAdapter`** (`manual-entry-adapter.ts`) — backs the default,
  zero-external-dependency path. A caller (e.g. a form handler) calls
  `.submit(lead, submittedAt)`; `fetchSince` replays everything submitted at
  or after the given cursor. Backed by `InMemoryManualLeadStore` in this
  slice — a durable store is a later concern.
- **`MockFeedAdapter`** (`mock-feed-adapter.ts`) — a fixed, constructor-supplied
  list of `{ externalId, occurredAt, lead }` entries, filtered the same way.
  Stands in for a real polling/webhook feed without requiring one; proves the
  adapter contract is source-agnostic.

### Resolving an adapter

```ts
function resolveIntakeAdapter(configuredId: string | undefined): LeadIntakeAdapter;
```

`resolveIntakeAdapter(undefined)` always returns the default
`ManualEntryAdapter` singleton (`defaultManualEntryAdapter`) — a caller with
no configured intake source still works. `resolveIntakeAdapter('manual-entry')`
resolves the same singleton by id; an unrecognized id throws rather than
silently falling back. `MockFeedAdapter` is intentionally **not** registered
in the resolvable set — it requires constructor-supplied entries and exists
for tests/local development, constructed directly rather than resolved by id.

## Sync orchestration (`modules/admin-finance/src/data/intake-sync.ts`)

```ts
function runIntakeSync(
  adapter: LeadIntakeAdapter,
  repository: Pick<LeadRepository, 'create'>,
  organizationId: string,
  sinceIso: string,
): Promise<IntakeSyncResult>;
```

`runIntakeSync` is the one place an adapter, `normalizeRawLead`, and
`LeadRepository.create` meet: it fetches raw leads since the cursor,
normalizes and persists each one **sequentially** (so a failing insert's
stack trace points at the specific lead, not an aggregate `Promise.all`
rejection), and reports which created leads were flagged for review.

```ts
interface IntakeSyncResult {
  adapterId: string;
  created: readonly { lead: Lead; flaggedForReview: boolean }[];
  flaggedForReview: readonly { lead: Lead; flaggedForReview: boolean }[]; // subset of created
}
```

Swapping the `adapter` argument (`ManualEntryAdapter` for `MockFeedAdapter`,
or any future adapter) changes nothing else about the call — this is the
adapter-swap transparency the contract exists to guarantee.

## What a website form integration needs to do

1. Collect the nine intake fields the `leads` table stores (see
   `modules/admin-finance/src/domain/lead.ts`), plus `source`/`payer`/
   `attachTiming` if the form happens to know them.
2. Call `ManualEntryAdapter.submit(rawLead, submittedAtIso)` (via
   `defaultManualEntryAdapter`, or `resolveIntakeAdapter(configuredId)` if a
   specific adapter is configured).
3. A scheduled or on-demand call to `runIntakeSync` picks up everything
   submitted since the last cursor, normalizes it, and creates the lead rows
   through `LeadRepository.create`.

No signature verification, no replay protection, and no polling/webhook
adapters exist yet — a form that needs those is out of scope for this slice
and depends on the deferred Supabase-backed work.
