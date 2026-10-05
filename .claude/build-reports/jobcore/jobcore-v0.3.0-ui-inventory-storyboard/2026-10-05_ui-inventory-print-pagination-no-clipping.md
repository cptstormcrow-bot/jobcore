---BUILD REPORT---

# v0.3.0 UI inventory: print pagination, no clipped screen text

- Date 2026-10-05; branch jobcore-role-landing-0.1.3; Tier-A. Plan: E:\Jeff\.claude\plans\ui-inventory-print-stop-clipping-let-each-screen-flow.md. All changes are under docs/snapshots/v0.3.0/.

## Goal

The v0.3.0 ui-inventory.html print output must not clip any screen text. Each screen flows over as many A4-landscape pages as it needs, and the header is repeated on continuation pages. Original defect: fixed 188mm card height, overflow:hidden, and a fixed .info zoom, so long screens lost text.

## What changed

- _tools/generate.mjs print CSS (about L261-282): the card keeps all text units on screen. In print, `.info .pbrk` is hidden (L279) and `.cont` sections carry the continuation (L281), each with a repeated `.cont-head` and the label "continued - page N of M". Outside @media print `.cont{display:none}` (L267), so the on-screen view is unchanged.
- New _tools/paginate.mjs: measures each card in headless Edge (`--dump-dom`) and greedily assigns break points. Constants PAD_PX 16 and SAFETY_PX 24. `--check` mode re-measures the baked output for overflow.
- New _tools/pagination.json: 74 screens, break sum 78, max 3 pages per screen.
- verify.mjs / verify.json updated: 24/24 checks pass.
- Regenerated ui-inventory.html (about 2.7 MB).
- Build is two-pass: generate -> paginate -> generate.

## Verification

- `paginate --check`: 0 overflowing of 74 screens.
- `verify`: 24/24.
- Karen independent PDF print check: 152 pages (74 + 78), matching expectation.
- Continuation headers, last table rows and navigation targets confirmed on 3 long screens (admin-finance, af-jobs, af-overview; af-calendar also carries 2 breaks) and 1 short screen (not-found, pp 76-77).
- On-screen view unchanged: `.cont{display:none}` outside @media print (generate.mjs L267) and the `.pbrk` hide is inside @media print (L279).

## Forward contracts:

Regenerate pagination.json whenever any screen content changes, by re-running generate -> paginate -> generate. Otherwise the baked breaks go stale.

## Deviations / Defects

1. The first `--check` / PDF run flagged 41 of 74 screens and gave 199 pages against the expected 152, because the budget ignored padding and zoom. Fixed with padSafety and zoom emulation in measureCheck.
2. `--check` does not emulate min-height:188mm.
3. Text is duplicated in the HTML: the card keeps all units and the `.cont` sections repeat them.
4. Karen could not separate Phone from Pad in the PDF (N/A); both mockups render inline on one page.
5. pypdf shows "accessibilityL\nabels", which is a text-extraction artefact, not clipping.

## Test plan:

none requested

## Out of scope (untouched)

On-screen layout; ui-storyboard.html; renderMiniNode; render-mockup.mjs; any app source; git push.
