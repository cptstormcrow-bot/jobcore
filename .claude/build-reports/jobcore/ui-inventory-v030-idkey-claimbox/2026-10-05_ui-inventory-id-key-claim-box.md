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
5. Addendum 2026-10-05 (layout adjustment): after commit 2fcbb91, Jeff asked (commit on hold, change uncommitted) that "How to identify when editing" sit above the Titles/tags/endpoints table with the claim box to its right.
   - `_tools/generate.mjs`: units reordered (How-to-identify heading + claimBox in a div.head-row, then the 5 id units, then the Titles heading and 15 tr units, then Navigation); CSS `.head-row{display:block}.head-row>h3{margin-top:var(--sp-2)}.info h3+table{width:auto;min-width:0}`.
   - Pipeline re-run generate->paginate->generate->paginate --check: 74 screens, 0 overflowing, max 3 pages (was 4).
   - Forward contract: this change stays uncommitted until Jeff releases the hold; the 4 Desktop copies are re-delivered.
6. Verification 2026-10-05 (Karen, verify-hound): PDF re-rendered via new `docs/snapshots/v0.3.0/_tools/render-pdf.py` -> 158 pages (A4 landscape), 74 bookmarks, strictly ascending, first -> p1, last -> p157. HEAD's committed PDF was 159 pages with 0 bookmarks. This supersedes the 159 figure in Summary and item 3.
7. Deviation: the expected page count of "under 157" was not met (158).
8. Defect/limit: per-page bottom-gap measurement could not be taken (pdfplumber absent; pypdf cannot give per-page extents on Edge PDFs). Recorded as UNMEASURED, not PASS.
9. `_tools/render-pdf.py` is a new file and part of this change; no commit and no push yet.

No Desktop copy of this report.
