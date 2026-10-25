---BUILD REPORT---

Tier: A
Project: jobcore
Slug: ui-inventory-0058-regen
Date: 2026-10-24
Branch: jobcore-role-landing-0.1.3 (commit c97f5fb)
Status: COMPLETE
Test plan: none (Jeff 2026-10-24: "No test plan for the Test Jobs closeout"; the Item 1 regen was also declined: "no test plan.")

## Forward contracts:

Prior contracts carried (Rule 41 evaluation, report 2026-10-23_paginate-mock-column-fix-and-0058-regen.md; the 2026-10-18 report declared `none`):
- FC-A (12 inventory cards still on the synthesized mock; capture.mjs lacks a row-click step): not in scope, still open.
- FC-B (23 recipe keys marked `skip` in captures.json): not in scope, still open.
- FC-C (unregistered `job-id` duplicates `ft-Completion` #0024): addressed by this change. The narrowed extractor fold resolved the pre-existing Karen FAIL on `job-id`.
- FC-D (Desktop PDF copy blocked): NOT honored. The Desktop PDF is blocked again (see Deviations); Jeff's re-copy is owed.
- FC-E (Jeff's Delete All of Job Simulator rows on `/config/test-jobs`): not in scope, still open.

New contracts made by this change:
1. The extractor fold depends on routes.json covering every screen source file. A new screen file not in routes.json becomes an `'unknown'` placeholder, not a numbered screen.
2. `'unknown'` placeholders stay unnumbered and are skipped by `assign-screen-numbers.mjs --check`; they must not be stamped.
3. `completed-review` remains an unnumbered placeholder until routes.json covers `CompletedReview.tsx`; whoever adds that route owes a regen.
4. `E:\Jeff\Desktop\ui-inventory.pdf` is stale until Jeff re-copies it.

## Goal

Jeff, 2026-10-24, verbatim: "Graphics did not come through on the HTML. Also #0024 is in fact used in the app so it should NOT say "not mounted". fix that, then look for any other erroneous designations on the UI inventory." Then: "we shall fix that." Scope of this report: the mount-status wording fix and the 0058 regen. Graphics capture was closed in the earlier report; the Test Jobs wiring has its own report (`.claude\build-reports\jobcore\test-jobs-wiring\2026-10-24_test-jobs-gear-switch-drawer.md`, commit 93c3a7b).

## What changed

Commit `c97f5fb`: `docs(ui-inventory): 0058 regen - mount-status wording, extractor fold, --check skips placeholders`. 11 files changed, 4298 insertions(+), 3032 deletions(-). Pathspec `docs/snapshots/v0.4.0` only. Not pushed (standing: no git push).

| Path | Change |
|------|--------|
| `docs/snapshots/v0.4.0/_tools/extract.mjs` (~L297-316) | Fold narrowed: a source file covered by routes.json folds onto its registry key. Result: 89 screens / 81 source files / 1 uncovered (CompletedReview.tsx -> placeholder key `completed-review`, `mounted: "unknown"`). |
| `docs/snapshots/v0.4.0/_tools/generate.mjs` | L114 `isUnm` now includes `'unknown'`. L117 `why` states what was measured per mount state: `'unknown'` -> "the extractor could not determine its mount status (source file not covered by routes.json)"; `'exported-unmounted'` -> "exported, but the extractor found no mount point for it"; `false` -> "the extractor found no route or sub-view mounting it". L118 `addR('unmounted', ...)`. No remark asserts a screen is "not mounted" or "never mounted" any more. |
| `docs/snapshots/v0.4.0/_tools/render-mockup.mjs` | L347 ribbon text `NO MOUNT FOUND`; L377 mini-node label `'✕ no mount found' : '● mounted'`. |
| `docs/snapshots/v0.4.0/_tools/descriptions.json` | Entries at lines 49 and 451 reworded to "No route or sub-view found by the extractor; ...". |
| `docs/snapshots/v0.4.0/_tools/assign-screen-numbers.mjs` L67 | `const probs = checkRegistry(reg, loadScreens().filter((s) => s.mounted !== 'unknown').map((s) => s.key));` so `--check` skips `'unknown'` placeholders. |
| `app/apps/mobile/src/screens/screen-registry.json` | UNTOUCHED (92 entries); no number minted; `--stamp` never run. |
| `docs/snapshots/v0.4.0/screens.json`, `ui-inventory.html`, `ui-inventory.pdf` and paginated siblings | Regenerated outputs (the remaining files of the 11). |

## Pipeline run

extract -> generate -> paginate -> generate -> `paginate --check` -> `assign-screen-numbers.mjs --check` (OK, 87 active, 5 retired, exit 0) -> `render-pdf.py` (Edge headless, own temp profile) -> copy HTML + PDF to `E:\Jeff\Desktop\` (HTML copied; PDF blocked, see Deviations).

## Verification (Rule 29-B)

| Measure | Value | Command |
|---------|-------|---------|
| HTML size/time | 9,691,042 bytes, 7:25:04 PM 2026-10-24 | `Get-Item docs\snapshots\v0.4.0\ui-inventory.html \| Select-Object Length, LastWriteTime` |
| "not mounted" / "never mounted" in HTML | 0 | `(Select-String -Path docs\snapshots\v0.4.0\ui-inventory.html -Pattern 'not mounted\|never mounted' -AllMatches \| Measure-Object).Count` |
| PDF size/time | 11,575,565 bytes, 7:26:18 PM | `Get-Item docs\snapshots\v0.4.0\ui-inventory.pdf \| Select-Object Length, LastWriteTime` |
| Registry count | 92 | `(Get-Content app\apps\mobile\src\screens\screen-registry.json \| ConvertFrom-Json).Count` |
| Screens / source files / uncovered | 89 / 81 / 1 | printed by `node docs\snapshots\v0.4.0\_tools\extract.mjs` |
| Registry check | OK 87 active, 5 retired, exit 0 | `node docs\snapshots\v0.4.0\_tools\assign-screen-numbers.mjs --check` |

## Docs ride the change (Rule 31)

Sweep: `Select-String -Path docs\snapshots\v0.4.0\_tools\*.md,app\docs\*.md -Pattern 'not mounted' | Select-Object -First 5`, counted with `Measure-Object`. Result: 0 hits. No doc outside `docs/snapshots/v0.4.0/_tools/` names the "not mounted" remark.

## File guards

A parallel session works on the same branch. The commit staged only `docs/snapshots/v0.4.0`. `git status --short` before the commit showed exactly the 11 modified files and none of the never-stage files.

## Deviations / Defects

1. The plan said one Runner hound per pipeline command; a single Runner hound ran all steps with redirected output (fewer dispatches, same evidence).
2. The first extractor fold over-folded three registry keys, so generate.mjs exited 1 with REGISTRY MISMATCH (3). The fold was narrowed and the re-run was clean.
3. The Runner stopped at `--check` with `screen key has no active entry: completed-review`. The L67 placeholder filter was added and the pipeline re-run from that step (exit 0).
4. The pre-existing Karen FAIL on `job-id` was resolved by the narrowed fold.
5. After the first generate.mjs rewording, 12 residual "not mounted" phrases remained in render-mockup.mjs, generate.mjs and descriptions.json. All were fixed before the final regen (HTML 0 matches).
6. DEFECT (open): the Desktop copy of the PDF failed. `E:\Jeff\Desktop\ui-inventory.pdf` was "being used by another process"; nothing was killed. The Desktop PDF is stale (1:10:11 PM, 11,498,510 bytes). The Desktop HTML copy is fresh. Jeff's re-copy, after closing the file: `Copy-Item -Force docs\snapshots\v0.4.0\ui-inventory.pdf E:\Jeff\Desktop\`.

## Not pushed

No git push performed.
---END BUILD REPORT---
