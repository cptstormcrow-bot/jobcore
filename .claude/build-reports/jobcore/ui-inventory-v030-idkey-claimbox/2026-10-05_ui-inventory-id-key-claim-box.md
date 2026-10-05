# Build Report: UI Inventory v0.3.0 id/key + claim box

Tier: A
Date: 2026-10-05

## Summary of change

- `generate.mjs` edits: id/key + kind rows in the top table; head-row with the claim-box; comp-wrap chips; header comment recording the standing rule.
- Regenerated: `ui-inventory.html`, `pagination.json`, `ui-data.json`, `ui-storyboard.html`.
- PDF produced at 159 pages.
- 4 Desktop copies refreshed.

## Measurements

- 74 screens, 258 edges
- 33 redundant claims, 67 missing claims
- 68/74 cards with claim-box
- 74/74 kind and key rows
- Pagination max 4 pages/screen
- 0 overflowing via `paginate --check`

Forward contracts: future UI Inventory iterations must keep the id/key, kind, claim-box and wrapped-components behavior (the generator header comment is the source).

Test plan: none (Jeff to eyeball HTML/PDF).

## Deviations / Defects

1. Redundant/missing lookup maps are built just before `card()` (~line 209) rather than after the refuted filter at line 111, because `missing` is built after line 111.
2. Spec-stage missing claims have no screen, so they get no box. A distinct-screen cross-check of 68 vs redundant union missing was not done.
3. PDF page count 159 comes from a regex count of `/Type /Page` objects, not checked in a PDF reader.
4. A false 68-overflow reading appeared after the first paginate; resolved by regenerating.

No Desktop copy of this report.
