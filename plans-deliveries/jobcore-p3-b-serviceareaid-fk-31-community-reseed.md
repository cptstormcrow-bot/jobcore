---
classification: plans/groovy-brewing-goblet
comments: "Jobcore P3-b — `service_area_id` FK + 31-community reseed"
origin: .claude/plans/groovy-brewing-goblet.md
tags: [plans, groovy-brewing-goblet]
---
# Jobcore P3-b — `service_area_id` FK + 31-community reseed

## Context

Jobcore Phase 3 admin/finance module. Ledger `Jobcore\handoff\P3-SLICE-LEDGER.md` rows P3b.1-P3b.5
are TODO; Jeff authorized starting P3-b. The group adds a nullable `service_area_id` FK to `jobs`
and seeds the real San Diego County service-area list (both `seed.sql` and `seed.hosted.sql` — the
latter already applied to the live hosted DB).

The ledger's own text (`P3-SLICE-LEDGER.md:7,43,48,50`) and `seed.sql:105-111`'s comment both assert
"26 San Diego County communities," sourced from `00-MASTER-SPEC.md` §4 — but the Master Spec never
enumerates them, and the two files that would (`00-MASTER-SPEC.md`, `03-P3-admin-finance.md`) are
off-limits under `P3-CONTEXT-PROTOCOL.md`'s no-full-load rule. Jeff confirmed he has no local copy on
disk; the actual source turned out to be the live business site, `sdassemblypro.com`.

Fetching only the sitemap + `/service-areas/` page produced 26 names. Jeff then challenged that
result directly ("I think you may be missing some communities we serve"). Fetching `/about/`,
`/contact/`, and `/faq/` as well surfaced 5 more communities (Spring Valley, Hillcrest, North Park,
Mission Valley, Scripps Ranch) that never appear on the dedicated service-area pages but do appear in
the site's own FAQ/Contact coverage list — confirming Jeff's suspicion was correct. Diffing the two
source sets by hand gives a 31-name union (3 names — Alpine, Bonsall, Carmel Valley — appear only in
the sitemap/service-areas list; 5 appear only in FAQ/Contact; 23 are shared). Jeff reviewed the exact
diff and chose **"Merge to 31"** as the canonical list. This plan reseeds against that 31-name list,
not the ledger's stale 26/20-row figures.

The 6 already-seeded placeholders (`...0401`-`...0406`) keep their ids and names exactly as-is —
this is a pure additive reseed, nothing existing is renamed or renumbered.

## Community list — old ids preserved, 25 new ids assigned

Existing (verified via a scoped re-read of `seed.sql:113-127`, unchanged):

| id suffix | name |
|---|---|
| `...0401` | La Jolla |
| `...0402` | Chula Vista |
| `...0403` | Poway |
| `...0404` | Encinitas |
| `...0405` | Carlsbad |
| `...0406` | El Cajon |

New rows, `...0407`-`...041f` (25 ids), ordered to match the site's own "Main Service Areas List"
order first, then the 5 FAQ/Contact-only names appended at the end:

| id suffix | name | id suffix | name |
|---|---|---|---|
| `...0407` | San Diego | `...0415` | San Marcos |
| `...0408` | Pacific Beach | `...0416` | Vista |
| `...0409` | Rancho Bernardo | `...0417` | Ramona |
| `...040a` | Carmel Valley | `...0418` | Alpine |
| `...040b` | National City | `...0419` | Lakeside |
| `...040c` | Imperial Beach | `...041a` | Bonsall |
| `...040d` | Coronado | `...041b` | Spring Valley |
| `...040e` | La Mesa | `...041c` | Hillcrest |
| `...040f` | Santee | `...041d` | North Park |
| `...0410` | Lemon Grove | `...041e` | Mission Valley |
| `...0411` | Del Mar | `...041f` | Scripps Ranch |
| `...0412` | Solana Beach | | |
| `...0413` | Oceanside | | |
| `...0414` | Escondido | | |

## Files to change

1. **`Jobcore\app\supabase\0006_job_service_area.sql`** (new file) — mirrors `0005_money.sql` style:
   `alter table public.jobs add column service_area_id uuid references public.service_areas(id) on
   delete set null;` plus a supporting index. Own migration file so it reverts independently of the
   reseed, per the ledger row's own rationale. Confirmed as the correct next filename — already
   reserved in `Jobcore\app\modules\admin-finance\src\index.ts:23` and
   `Jobcore\plans-deliveries\2026-08-02_p3-slice-ledger-creation.md:83-84`.

2. **`Jobcore\app\supabase\seed.sql`** — append the 25 new rows (table above) after the existing
   6-row block at `:113-127`, same `insert ... on conflict (id) do nothing;` shape already used
   there. Rewrite the stale comment at `:105-111` to drop the "26... does not enumerate... placeholder"
   language and instead state the source (sdassemblypro.com, verified 2026-08-07, 31 names) plainly.

3. **`Jobcore\app\supabase\seed.hosted.sql`** — identical 25-row append. Because this file is already
   applied to the live hosted DB, use `on conflict (id) do nothing` for the insert (safe no-op on
   anything already present) — there is nothing to correct on the existing 6 rows, so no guarded
   `update` is needed here.

4. **`Jobcore\app\supabase\README.md`** — per ledger row P3b.3: register migrations `0005` and `0006`
   in the Files table; fix the stale `:19` "6 service areas (placeholder... none enumerated yet)"
   line to reflect 31; add the three unlisted `.hosted.` files (`seed.hosted.sql`,
   `tests/0001_foundation_rls.hosted.test.sql`, `tests/0004_scheduling_rls.hosted.test.sql`); correct
   the stale `:3-4` "No Supabase client lives here" claim.

5. **`Jobcore\handoff\P3-SLICE-LEDGER.md`** — Rule 31 ride: row P3b.2's text still says "20 rows
   `...0407`-`...041a`" and "the 26 names"; row P3b.4's text still says "26 distinct... baseline is
   6"; header line 7 still says "the 26 communities." All three get corrected to 31/25 to match this
   plan before the rows are marked DONE, so the ledger stays internally consistent (Rule 29).

6. **`Jobcore\handoff\P3-CONTEXT-PROTOCOL.md`** — line ~22-23 "Settled input: 26 community names..."
   gets corrected to 31, with a one-line note on the source (site fetch, Jeff-approved merge) so a
   future session doesn't reopen the question.

Out of scope for this slice: the wider ride-along list a prior exploration pass surfaced
(`02-P2-scheduling-core.md:23`, `sdassembly-scheduling-app.md:68`, `plans-deliveries` snapshot files,
historical execution-plan snapshots). Those are either historical/immutable records or outside this
group's Rule-31 blast radius (they don't assert a specific community count) — left untouched.

## Reused patterns

- Additive-insert idempotency: `on conflict (id) do nothing`, matching the existing service-area
  block and the `converted_job_id` guard pattern near the end of `seed.sql`.
- Migration shape/style: `0004_scheduling.sql` (nullable FK + index precedent at `:52-57,89-108`) and
  `0005_money.sql` (overall file structure, comments, no RLS/enum needed here since `jobs` and
  `service_areas` already have RLS from `0001`/`0004`).
- UUID scheme: `00000000-0000-4000-8000-00000000NNNN`, sequential hex continuing from the last-used
  suffix, per existing convention throughout `seed.sql`.

## Verification (P3b.4/P3b.5)

- Count distinct service-area rows via the `8000-0000000004` id pattern in both `seed.sql` and
  `seed.hosted.sql` — expect 31 in each (was 6).
- Confirm zero id collisions: the 25 new ids (`...0407`-`...041f`) don't already appear anywhere else
  in either file.
- Confirm `on conflict (id) do nothing` is still truthful (no existing id is targeted by the new
  insert block).
- Confirm `0006_job_service_area.sql` is structurally valid SQL (balanced statements, pure ASCII) and
  that `jobs.service_area_id` round-trips a real `service_areas.id` value.
- Re-grep the changed files for the literal string "26" to confirm no stale count survived the edit.
- Commit, then Tier-A build report per Rule 8/25/37 (`Forward contracts: none` — P3-b is self-
  contained; `Deviations`: note the 26→31 count correction and its Jeff-approval trail).
