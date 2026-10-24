---BUILD REPORT---

Tier: A
Project: jobcore
Slug: ui-inventory-0058-regen
Date: 2026-10-24 (plan-approved filename dated 2026-10-23)
Branch: jobcore-role-landing-0.1.3 (HEAD at authoring bd0b245; commit hash recorded after the scoped commit — see Follow-up line at the end)
Status: COMPLETE (closeout steps after this report: scoped commit, memory update, Desktop PDF copy retry, Rule 14 sweep)
Test plan: declined by Jeff 2026-10-24 ("no test plan.")

## Forward contracts:

Prior contracts carried (Rule 41 evaluation):
- payroll-button-retrofit report (2026-10-20), contract 3 (the three paginate overflow screens ft-Payroll, sm-Payroll, layout remain open): RESOLVED by this report (paginate mock-column fix; `paginate.mjs --check` now 0 overflowing, exit 0; UI Inventory regenerated).
- payroll-button-retrofit contract 1: not in scope; that report already records it RESOLVED 2026-10-21 (Jeff: no longer applicable).
- payroll-button-retrofit contract 2: already SUPERSEDED by dabf215; not in scope.
- payroll-button-retrofit contract 4: not in scope; nothing owed (test plan declined).
- payroll-button-retrofit carried items (a)-(d): not in scope, still open.
- ui-inventory-0058-regen report (2026-10-18): Forward contracts `none`. Its open DEFECT (3 overflowing screens: ft-Payroll, sm-Payroll, layout) is honored/closed by this change (0058 regen, overflow fix, and the UI Inventory regen).

New contracts made by this change:
- NEW FC-A: 12 inventory cards still use the synthesized `renderMockup` fallback instead of a real render (keys: af-blackout-editor, af-closeOutQueue, af-closeOutReview, af-employee-detail, af-employee-job-detail, af-leadEdit, af-planning, af-priceSheetEditor, af-qualify [click target not found]; job-region-evisit, job-region-plan [scrollTo target not found]; af-compensationPolicy). A later pass needs a row-click step type in capture.mjs (`clickFirst` is referenced in the recipe crib but not implemented) and nav triggers for closeOutQueue/closeOutReview/planning, which have no SubView trigger in AdminFinanceRoot.
- NEW FC-B: 23 recipe keys are marked `skip` in captures.json (no derivable URL/trigger from screens.json: sign-in/forgot/reset anon screens, config/sweep/payment helpers, unregistered `job-id`). They render as synthesized mocks.
- NEW FC-C: unregistered key `job-id` (`app/job/complete/[jobId].tsx`) duplicates the registered `ft-Completion` route (#0024) and shows as a "#----" card with `mounted: 'unknown'`. Mapping `job-id` → `ft-Completion` in `_tools/routes.json` would remove the duplicate; not authorized in this change.
- NEW FC-D: Desktop copy of `ui-inventory.pdf` was blocked by another process holding `E:\Jeff\Desktop\ui-inventory.pdf` (still the 2026-10-21 8,015,085-byte file); retried at commit time, result recorded in the follow-up line.
- NEW FC-E: Jeff deletes the Job Simulator rows (`is_beta:true`, `source:'job-simulator'`) with Delete All on `/config/test-jobs`; not done by this change.

## Goal

Open Item 1: regenerate the UI Inventory v0.4.0 snapshot (Schedule #0058 and all screens) after fixing the three paginate overflow screens, under Jeff's scope change (verbatim): "I want those screen graphics to look exactly like the screens with its data filled in like it were lorem ipsum. I want to see job entries on the job screens, button titles on the buttons, and generally make it look like the app has actual jobs flowing through it and actual employees doing them. I want to identify any links going in or out of these screens. Goal is to make these screens in the UI inventory look closer to an actual screen. Take into consideration the recent button and tab redesigns and show them exactly." Route (b), settled with Jeff: real renders captured from the Expo web dev server on port 8081 with puppeteer-core driving headless Edge against three role profiles Jeff signed into himself.

## What changed

| Path | Change |
|------|--------|
| `docs/snapshots/v0.4.0/_tools/paginate.mjs` | mock-column budget fix: card border (`BORDER_PX = 2`) and trailing non-unit `.info` content now come out of the per-page budget; shared `LAYOUT_CSS` so measure and `--check` lay the card out at print width; `--check` also measures the `.mock .jc-device` column. |
| `docs/snapshots/v0.4.0/_tools/package.json`, `package-lock.json` (new) | puppeteer-core devDependency for the capture tool; `_tools/node_modules/` ignored via `.gitignore` line 6 (already present, verified with Select-String). |
| `docs/snapshots/v0.4.0/_tools/captures.json` (new) | per-screen capture recipes grouped by role (af/ft/sm; profile dir + home + per-key url/steps/waitFor/skip). |
| `docs/snapshots/v0.4.0/_tools/capture.mjs` (new) | puppeteer-core runner: headless Edge per role profile, 390x844 @2x, `--only`, `--role`, `--log`, `--job`; normalized matcher (testid / aria-label / textContent with trailing `? ▸ ▾` stripped), Menu-drawer-aware recipes, job-id discovery via Jobs → Detail, `ensureSignedIn` guard, retry on matcher miss; writes `captures/<key>.png` and `captures/_manifest.json`; prints one summary line. |
| `docs/snapshots/v0.4.0/captures/` (new) | 54 PNG real renders + `_manifest.json`. |
| `docs/snapshots/v0.4.0/_tools/generate.mjs` | `mockFor(s)` uses `<img class="capture" src="captures/<key>.png" width=312 height=675>` when the PNG exists, else `renderMockup`; new "Reached from" inbound list beside "Navigation targets" built by inverting the edges array, both tagged with edge kind; `captureStatus` per screen in `ui-data.json`; retired `calendar` key dropped (89→88 screens). |
| `docs/snapshots/v0.4.0/_tools/routes.json` | `af-compensationPolicy` entry added to clear the g2 REGISTRY MISMATCH. |
| `docs/snapshots/v0.4.0/_tools/screens.json`, `pagination.json`, `ui-data.json`, `ui-inventory.html`, `ui-storyboard.html`, `ui-inventory.pdf` | regenerated outputs. |
| `.gitignore` | `docs/snapshots/v0.4.0/_tools/node_modules/` (line 6). |

## Pipeline run (Step G, in order, each hound redirected output to scratchpad)

1. extract.mjs
2. generate.mjs → `88 screens, 280 edges, 50 redundant claims, 62 missing claims`
3. paginate.mjs → `88 screens measured, 88 with breaks, max pages for one screen 5`
4. generate.mjs (second pass, same summary)
5. `paginate.mjs --check` → `88 screens measured, 0 overflowing, max pages for one screen 5`, exit 0.
6. `render-pdf.py` (Edge headless print + pypdf bookmarks; benign warning `Object count 20233 exceeds defined trailer size 20183`).

## Verification (Rule 29-B — numbers with their commands)

| Measure | Value | Command |
|---------|-------|---------|
| Capture run e8 | `capture: 54 ok, 11 failed, 23 skipped` | `node docs/snapshots/v0.4.0/_tools/capture.mjs --log <scratchpad>\capture-log6.txt` (stdout redirected via `cmd /c`) |
| PNG count | 54 | `(Get-ChildItem docs\snapshots\v0.4.0\captures\*.png).Count` |
| Manifest ok | 54 | `(Get-Content docs\snapshots\v0.4.0\captures\_manifest.json | ConvertFrom-Json).PSObject.Properties | Where-Object { $_.Value.status -eq 'ok' } | Measure-Object | Select-Object -ExpandProperty Count` (run by a hound; Rule 44 blocked the main-session form) |
| `class="capture"` imgs in HTML | 53 (54 PNGs minus the orphan `calendar.png` whose key was dropped) | `Select-String -Path docs\snapshots\v0.4.0\ui-inventory.html -Pattern 'class="capture"' | Measure-Object | Select-Object -ExpandProperty Count` |
| "Reached from" lists | 83 | `Select-String -Path docs\snapshots\v0.4.0\ui-inventory.html -Pattern 'Reached from' | Measure-Object | Select-Object -ExpandProperty Count` |
| `#0058` anchors | 14 | `Select-String -Path docs\snapshots\v0.4.0\ui-inventory.html -Pattern 'screen-sm-Schedule|0058' | Measure-Object | Select-Object -ExpandProperty Count` |
| Overflow check | 0 overflowing, exit 0 | `node docs/snapshots/v0.4.0/_tools/paginate.mjs --check` |
| Final regen (2026-10-24 13:10:11) HTML bytes | 9,711,890 (replaces the earlier 2,328,914 figure) | `(Get-Item docs\snapshots\v0.4.0\ui-inventory.html).Length` |
| Final regen PDF bytes | 11,498,510 (replaces the earlier 12,392,530 figure) | `(Get-Item docs\snapshots\v0.4.0\ui-inventory.pdf).Length` |
| Final regen PDF pages / bookmarks | 221 pages / 88 bookmarks (replaces 228 / 88) | render-pdf.py summary line |
| Final regen cards / pipeline | 88 cards, 0 duplicate ids; G1 extract: 89 screens, 81 source files, 0 uncovered; G2 generate: 280 edges, 57 redundant claims, 62 missing claims; G3 paginate: 88 with breaks, max 4 pages; G5 `paginate.mjs --check`: 0 overflowing, exit 0 | pipeline summary lines |
| Final regen captures | 54 ok, 11 failed, 23 skipped; png count 54 (5,641,787 bytes) | `(Get-ChildItem docs\snapshots\v0.4.0\captures\*.png | Measure-Object -Sum Length)` |
| Embed check | `data:image/png;base64` = 53; `src="captures/` = 0 | `Select-String -Path docs\snapshots\v0.4.0\ui-inventory.html -Pattern 'data:image/png;base64' -AllMatches | ForEach-Object { $_.Matches.Count } | Measure-Object -Sum` (same for `src="captures/`) |
| routes.json check | entries 91 dupes 0 unknown 0 | `node -e "const a=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const keys=a.map(x=>x.key);const dupes=keys.filter((k,i)=>keys.indexOf(k)!==i);console.log('entries',a.length,'dupes',dupes.length,'unknown',a.filter(x=>String(x.mounted)==='unknown').length)" docs\snapshots\v0.4.0\_tools\routes.json` |
| Desktop copies | `E:\Jeff\Desktop\ui-inventory.html` and `ui-inventory.pdf` copied OK | copy step |
| #0024 card chip | `mounted: true` at ui-inventory.html L1086; `captures/ft-Completion.png` at L1081; screens.json ft-Completion `"mounted": true` | the Select-String recipe over lines 1080-1140 of the HTML plus a narrowed screens.json read |
| Baselines | 2026-10-21: 85 screens / 179 pages / PDF 7,978,379 bytes. Pre-Step-G 2026-10-23: 87 screens / HTML 3,414,436 / PDF 8,015,085 | from the 2026-10-18 and 2026-10-20 reports and the pre-regen `Get-Item` reads |
| SOP acceptance | Jeff's eyes (payroll-button, tab-bar, header SOPs) — no self browser-check per memory `feedback-trust-test-plan-no-self-browser-verify.md` | n/a |

## Deviations / Defects

1. Plan-order defect in the superseded overflow plan: paginate was run before generate; the real order is generate → paginate → generate → paginate --check (the double generate pass), because paginate measures the HTML generate wrote. Stale pagination indexes until the g3 pass produced 4 spurious overflows.
2. Incomplete first diagnosis: zoom alone was blamed; the true cause was the mock-column budget plus card border and trailing `.info` content (border + trailing fix).
3. Probe 2 hound died of a DOM dump reaching its context; replaced by the redirected-output discipline (`cmd /c "... 1> out 2> err"`, read with `Select-Object -First/-Last N`).
4. Scope change mid-item (Jeff, verbatim in Goal) turned a regen into a capture pipeline; recorded, not a defect.
5. `af-jobEstimate` overflowed after captures landed (long `.info`); 2-edit paginate fix; max pages per screen rose 4→5.
6. g2 reported REGISTRY MISMATCH; fixed by adding `af-compensationPolicy` to routes.json (one corrected regen, pre-authorized by the plan).
7. Pre-existing duplicate-class defect in generated HTML left as found (out of scope).
8. 89 vs 88 screens: retired `calendar` key dropped in generate.mjs; its PNG `captures/calendar.png` is an orphan (54 PNGs, 53 `class="capture"` imgs).
9. Unregistered key `job-id` (`app/job/complete/[jobId].tsx`) duplicates #0024 `ft-Completion` as a "#----" card with `mounted: 'unknown'` (see FC-C); Jeff asked "Why is #0024 not mounted?" — the inventory shows #0024 `mounted: true`; the sighting was the duplicate or neighboring exported-unmounted cards (StartChecklist, Greeting, Earnings).
10. Step F needed 5 edits (>3): Nestor escalated to Spot; Spot split into an 8-edit spec. Spot's `node --check` returned a false 1 from a cmd-mangled Git Bash path; re-run clean.
11. E2 recipe doubts: first captures.json recipes assumed nav labels in the DOM; they live in the AppChrome NavDrawer modal (hamburger "Menu" first), and rows carry trailing `?`/`▸`/`▾`; a recipe-fix pass rewrote 27 recipes and the matcher (normalized testid/aria-label/textContent).
12. Capture runs e4–e7 were null or partial: Edge profile lockfile (profile open in a headed window), "not signed in" until Edge fully closed, `FATAL launch af` once, PowerShell 5.1 `2>` on native commands (switched to `cmd /c`), `--role ft` alone cannot derive a job id (needs `--job`). `ensureSignedIn` and the matcher/retry patch retained. e8 final: 54 ok / 11 failed / 23 skipped.
13. Detour: sign-ins were attempted through the Claude browser pane; abandoned — Jeff re-ran the PIB headed-Edge profile commands and signed in himself. One one-time authorized Edge kill (spent). I never entered credentials.
14. `clickFirst` row-click step type referenced by the recipe crib was not implemented (FC-A).
15. Explore hand-backs lost across a compaction boundary; rule adopted: wait one turn, then SendMessage by name instead of re-dispatching.
16. Contradicted hypothesis: the inbound "Reached from" list was suspected of causing overflow; measurement cleared it.
17. "No PDF step under `_tools`" was a false negative from an extension-filtered listing; `render-pdf.py` exists and was run.
18. HTML byte count was first reported as 2,281,456 (09:17:18); that figure predated g4's second generate pass; the correct final figure is 2,328,914 (09:47:42).
19. Desktop PDF copy blocked by another process (FC-D); never killed the holder.
20. Rule 43 asked; Jeff declined a test plan.
21. Filename keeps the plan-approved 2026-10-23 date; completion is 2026-10-24.
22. Repeated compaction thrash (16+ boundaries) lost an ExitPlanMode once and caused an invalid `update_plan {"advance": false}` call and two wrap_up schema misses (label too long, recap 353>300 chars). Option 2 (raise autoCompactWindow) is queued after this closeout per Jeff's order.
23. Graphics embed defect: generate.mjs `mockFor(s)` originally emitted `src="captures/<key>.png"` (relative paths), so the Desktop copy of ui-inventory.html showed no graphics. Fixed: mockFor now embeds `src="data:image/png;base64,..."` (generate.mjs L160-L166). Verified on the regenerated HTML: `data:image/png;base64` occurrences = 53, `src="captures/` occurrences = 0.
24. Mount-status defect, #0024: Jeff saw "not mounted" on what he took for #0024 (ft-Completion). The chip Jeff saw belonged to the `job-id` card (app/apps/mobile/app/job/complete/[jobId].tsx, the completion page alias), not to ft-Completion. routes.json flipped `mounted` to true for `job-id` and for both `sweep-*` components; ft-Completion now reads `mounted: true, #0024`; job-id reads `mounted: true, #----` (job-id has no screen-registry.json number; registry is read-only). Both still carry a "dead-end" remark, which is an outgoing-navigation class, not a mount designation.
25. Duplicate routes.json keys: the first routes.json pass introduced duplicate entries; a dedupe pass fixed them. Verification: entries 91, dupes 0, unknown 0 (node one-liner in the Verification section below).
26. Seven `mounted: unknown` cards: forgot-password, reset-password, layout, universal-calendar, blackout-range-modal, blackout-time-off-list, time-off-tech-calendar. Cause: extract.mjs:291 uncovered-file fallback marks any source file with no routes.json entry as `mounted: 'unknown'`. Fixed additively by adding 7 routes.json entries; extract now reports 0 uncovered files. Candidate for Jeff's correction: Nestor authored the titles ("Forgot Password", "Reset Password", "Module Shell Layout", "Calendar", "Blackout Range", "Blackouts and Time Off", "Time Off Tech Calendar"), roles (route entries owner/admin/tech/sales; sub-views owner/admin), module admin-finance, parentKey universal-calendar on the three blackout/time-off sub-views, and modelled `layout` (app/m/_layout.tsx) as kind `route` with route `/m` because no "layout" kind exists in the schema.
27. routes.json rewrite side effects: Nestor's JSON.stringify rewrite reformatted the opening lines of the existing `root-layout` entry (no data dropped: 91 = 84 + 7, confirmed by `git diff -U0`) and wrote LF line endings (git warned "LF will be replaced by CRLF"). Declared, not fixed.
28. Residual text "Unmounted: no route or inbound nav found" (3 occurrences in ui-inventory.html): traced to descriptions.json:41, the hand-authored `missing` field of af-JobCreateScreen. af-JobCreateScreen is one of the 6 rows the mount audit confirmed correctly NOT MOUNTED, so the text is a true statement. Left as-is: one source string, three HTML occurrences (duplication mechanism not traced).
29. Six NOT MOUNTED rows confirmed correct as-is: af-ReportsJobDetailScreen, af-JobCreateScreen, ft-StartChecklist, ft-Greeting, ft-Earnings, ft-Reimbursements.
30. Dead-end / not-navigable remark class (~39 cards, e.g. af-Payroll, sm-Overview, ft-Payroll, all plainly reachable in the app): comes from generate.mjs edge resolution (L106-139), an edge-extraction coverage limitation (G2: 57 redundant claims, 62 missing claims). Declared, not fixed, pending Jeff's call.
31. extract.mjs reports 89 screens; generate.mjs renders 88 cards. Observation only (likely refuted.json or a kind filter); not blocking.

## Rule 14 teardown (planned, executed after commit)

Scratchpad files `capture-log*.txt`, `e4..e8-out/err.txt`, `stepf-check-out/err.txt`, `g1..g5-out/err.txt`, `pdf-out/err.txt`, `route-b-crib.md`, `recipe-fix-crib.md`, dirs `edge-profile-af/ft/sm`. Dev server 8081 declared in `.claude/launch.json`, never stopped. Simulator rows: Jeff's Delete All (FC-E).

Commit: <pending — recorded by the memory update after the scoped commit>
