---BUILD REPORT---
GOAL: Make JobCore's menus look and feel like the Vittlix hamburger drawer without changing any colours, menu choices or settings choices; add a universal, creation-ordered screen-numbering system (switchable from the config menu and carried into the UI Inventory); then, as follow-ups, make the drawer's top block sand-coloured, give each of the nine job stages its own screen number, and add a Draft / Submitted / Approved status control on the estimate screen that re-colours the job timeline.

RoA: jobcore / BUILD
Plan: new-jobcore-slider-menu-scalable-finch | Date: 2026-10-11 | Status: COMPLETE
Why: Jeff wanted every JobCore menu to feel like the Vittlix slide-in drawer, and wanted every screen to carry a permanent number (#0001 = oldest) so he can call out "#0042" and be sure that exact screen is the one being edited. After the first build he asked for a sand-coloured drawer header, a way to tell the nine job stages apart (they all showed #0039), and a way to move an estimate between Draft, Submitted and Approved while the timeline above follows.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-10-11_drawer-sand-screen-numbers-estimate-status.md

Summary:
- Six commits on branch jobcore-role-landing-0.1.3: 8251a4c, 492d468, 4523bdf, 43be61f, c773a63, b2240ea. No migration, no push, no tag. The v0.4.0 release step is DEFERRED (Forward contracts FC-1).
- Drawer (8251a4c): new NavDrawer (slide-in over a scrim, swipe-left and Android-back close, width min(screen width - 56, 320), 176dp header block, 48dp rows) and MenuGlyph (hamburger-to-back-arrow morph). The Options and gear popups use drawer-style rows and stay popups. Menu items, labels, order, destinations and colours are unchanged.
- Screen numbering (8251a4c, 492d468): append-only registry app/apps/mobile/src/screens/screen-registry.json (numbers never reused), line-1 source stamp "// JobCore screen #NNNN - <key> - <title>" on each screen file, a pure resolver (route plus optional sub-view), a floating badge mounted once in the root layout, and a "Show screen numbers" switch on the config/settings screen (saved preference, default OFF). assign-screen-numbers.mjs has --stamp, --check and --lookup N modes.
- Sand header (4523bdf): the drawer header block uses the existing colors.gold token instead of colors.primary; tokens.ts untouched.
- Job-stage numbers (4523bdf, 43be61f, c773a63): the job screen reports which stage is showing. Base job screen #39; job:assign #40, job:plan #41, estimate (admin) #57, job:schedule #58, estimate (tech) #59, job:prelim #61, and four new entries contact #75, arrive #76, complete #77, paid #78. Auth screens were stamped as #79 and #80. A sticky "active stage" covers the four action stages that have no screen body.
- Estimate status control (4523bdf, 43be61f): shared EstimateStatusControl in the ui package and a pure allowedEstimateMoves in core. Admin may move Draft / Submitted / Approved in any direction (confirm dialog when leaving Approved); a field tech may move Draft <-> Submitted only; Rejected is a read-only pill. Both estimate screens report changes upward through onEstimateChange so the job timeline recomputes. No migration: the status column and its check constraint already existed.
- UI Inventory v0.4.0 (b2240ea): regenerated with a Screen # row, a numeric index section and "#NNNN key - title" PDF bookmarks. 80 screens, 175 pages, 80 bookmarks (v0.3.0 was 74 screens, 158 pages). paginate.mjs now measures cards at the width they print at (shared LAYOUT_CSS), which also fixed a 4.48px overflow on forgot-password.

Files:
Modified (app/):
  apps/mobile/app/_layout.tsx, apps/mobile/app/config/settings.tsx, apps/mobile/app/job/[jobId].tsx,
  modules/admin-finance/src/screens/AdminFinanceRoot.tsx, modules/admin-finance/src/screens/JobEstimateScreen.tsx,
  modules/field-tech/src/index.ts, modules/field-tech/src/screens/JobEstimateEditor.tsx, package.json,
  packages/core/src/index.ts, packages/ui/src/AppChrome.tsx, packages/ui/src/index.ts
Modified (later commits, files first added in 8251a4c):
  apps/mobile/src/screens/screen-registry.json, packages/ui/src/NavDrawer.tsx,
  packages/ui/src/screen-numbers/ScreenNumberContext.tsx, docs/snapshots/v0.4.0/_tools/routes.json,
  docs/snapshots/v0.4.0/_tools/paginate.mjs, docs/snapshots/v0.4.0/_tools/pagination.json,
  docs/snapshots/v0.4.0/_tools/screens.json
New (app/):
  apps/mobile/src/screens/screen-registry.json, packages/ui/src/MenuGlyph.tsx, packages/ui/src/NavDrawer.tsx,
  packages/ui/src/drawer-geometry.ts, packages/ui/src/__assertions__/drawer-geometry.assert.ts,
  packages/ui/src/__assertions__/screen-resolve.assert.ts, packages/ui/src/screen-numbers/ScreenNumberBadge.tsx,
  packages/ui/src/screen-numbers/ScreenNumberContext.tsx, packages/ui/src/screen-numbers/screen-resolve.ts,
  packages/core/src/estimateStatus.ts, packages/core/src/__assertions__/estimateStatus.assert.ts,
  packages/ui/src/EstimateStatusControl.tsx, packages/ui/src/__assertions__/job-subview.assert.ts,
  packages/ui/src/__assertions__/subview-stack.assert.ts, packages/ui/src/screen-numbers/job-subview.ts,
  packages/ui/src/screen-numbers/subview-stack.ts
New (docs/snapshots/v0.4.0/_tools/):
  assign-screen-numbers.mjs, descriptions.json, extract.mjs, generate.mjs, paginate.mjs, pagination.json,
  refuted.json, render-mockup.mjs, render-pdf.py, routes.json, sample-data.json, screen-registry-lib.assert.mjs,
  screen-registry-lib.mjs, screens.json, ui-kit-styles.json, verify.json, verify.mjs
New (docs/snapshots/v0.4.0/):
  ui-data.json, ui-inventory.html, ui-inventory.pdf, ui-storyboard.html
Deleted: app/apps/mobile/src/components/NotificationPreferencesScreen.tsx (8251a4c)
65 stamp-only files (line-1 screen-number header) in 8251a4c
3 stamp-only files (line-1 screen-number header) in 492d468
0 stamp-only files (line-1 screen-number header) in 4523bdf
0 stamp-only files (line-1 screen-number header) in 43be61f
2 stamp-only files (line-1 screen-number header) in c773a63
0 stamp-only files (line-1 screen-number header) in b2240ea

Evidence (measured; commands shown per Rule 29-B):
- `npm test` from app/ (working tree includes the other session's uncommitted files): tests 294, pass 294, fail 0, cancelled 0, skipped 0, exit 0.
- `node docs\snapshots\v0.4.0\_tools\assign-screen-numbers.mjs --check`: OK 80 active, 0 retired.
- `node docs/snapshots/v0.4.0/_tools/paginate.mjs --check`: 80 screens measured, 0 overflowing, max pages for one screen 3.
- `python docs/snapshots/v0.4.0/_tools/render-pdf.py` (plain python, never -I): screens found 80, pdf pages 175, bookmarks added 80.
- Karen (verify-hound) verdict: CONFIRMED bookmarks=80 screens=80 cards=80 pages=175 ascending=yes.
- Stamp-in-HEAD proof: all 80 registry entries have their line-1 stamp in HEAD (72 by script plus 8 by direct `git show HEAD:<path>` reads of the two bracketed-path files).
- `git show --stat --name-only --format='%h %s' HEAD` for b2240ea listed exactly 7 paths, all under docs/snapshots/v0.4.0/.
- `git log --format='%h %s' -12` listed the six commits above.
- tsc was NOT re-measured at closeout.
- NOT done: no device or dev-server click-through (Jeff declined a test plan; the standing rule is to trust the test plan, not self-browser-check).

Test plan: declined by Jeff (Rule 43, 2026-10-11).

Forward contracts:
- FC-1 (release): the v0.4.0 release and local tag v0.4.0 are NOT cut. `npm run release:dry` exits 1 with "Release files have uncommitted changes" because the other session has uncommitted edits to app/apps/mobile/app.json (version 0.4.0, versionCode 6, buildNumber 5) and app/apps/mobile/package.json. The guard is deliberate and was not bypassed; nothing was reverted, stashed or committed on their behalf. Running `npm run release` after they commit would compute 0.4.0 again but add +1 to versionCode and buildNumber (a double-bump) and write the root package.json and CHANGELOG.md. Jeff to choose: (a) wait for the other session to commit, then reconcile the double-bump (recommended), or (b) a manual scoped version commit plus a local tag. Tags stay local; no push.
- FC-2 (role gating is UI-only): the live policy job_estimates_org_all (app/supabase/migrations/0036_job_estimates.sql lines 98-99) is org-wide FOR ALL, so who may set which estimate status is enforced in the screens only; comments in approve-estimate.ts and JobEstimateEditor.tsx line 8 disagree with the migration. Pre-existing exposure, noted and not fixed; Jeff to decide before any migration is planned.
- FC-3 (carried): service_task_id is not threaded into calculateCommission (app/modules/admin-finance/src/money/commission.ts line 103); first recorded in 2026-09-20_jobcore-redlines-stabilize.md lines 19 and 89.
- FC-4 (device pass owed by Jeff): drawer feel (swipe, Android back button, hamburger-to-arrow morph, Options and gear rows); sand header legibility (wordmark chip and gear on gold; the accent colour on gold is only about 1.03:1 contrast, so any outline or glyph in accent may wash out - any fix is a style-only follow-up with no new colours); the badge number for each of the nine job stages; the status control as admin and as tech; timeline recolouring on each move; the confirm text when leaving Approved.
- Rule 41 (prior lineage), HONORED: pagination regeneration (b2240ea); id/key and claim-box behaviour kept; no new migration (the 0076 contract); the 0077 live push.
- Rule 41, RESOLVED by reads this session: the Cluster B Select inspection (EmployeeEditorScreen.tsx has no TechSelect use; PriceSheetEditorScreen.tsx mentions "tech" only in help text); restyle FC2 TimeOff (commit ec46136).
- Rule 41, PARTIALLY resolved: module-ports registration - setModulePorts is called at route level in app/apps/mobile/app/m/[moduleId].tsx (lines 8, 13, 17) and app/apps/mobile/app/job/[jobId].tsx (line 70); other call sites are unconfirmed.
- Rule 41, CARRIED (need Jeff or a device): Cluster A and B device passes; tappable-stages FC-1 (required-field sets are proposed) and FC-2 (runtime tap-flow) from 2026-10-06_tappable-stages-prem-estimate.md; prem-checklist FC-1 (runtime check on 8081) from 2026-10-06_prem-checklist-estimate-schedule.md; JD-08 (2026-09-20_jobcore-redlines-stabilize.md); restyle FC1 device checklist (2026-09-04_job-detail-screen-restyle.md line 136).
- Rule 41, NOT re-verifiable and dropped: the migration 0032/0049 ordering item and a stale "0022" header note - no source could be located this session.

## Deviations / Defects
- The inventory pipeline (extract, generate, paginate, render-pdf) and the PDF render ran from the main session via PowerShell rather than through a hound; the scripts wrote the outputs.
- Page count rose from 158 to 175 and screens from 74 to 80, partly from the extra screens and partly because pagination now measures more accurately.
- Bookmarks total 80, not the planned 78, because c773a63 also stamped the auth screens as #79 and #80.
- paginate.mjs needed a measuring fix: .info is now measured at its printed width through a shared LAYOUT_CSS used by both the measure and --check passes (raising SAFETY_PX only hides measurement gaps).
- render-pdf.py first failed with a pypdf import error because it was run as `python -I`; re-run as plain `python`.
- The Karen dispatch cited the wrong screens.json path; the real path is docs/snapshots/v0.4.0/_tools/screens.json. The verdict was unaffected.
- An early diff-size estimate ("about 10/9") was wrong; the actual diff was +12/-7.
- The first stamp-in-HEAD script mis-reported 8 of 80 stamps as missing; all 8 were in the two bracketed-path files (likely bracket handling in that script's lookup - an inference, not proven). Direct `git show HEAD:<path>` reads proved all 80 stamps are present.
- The commit b2240ea was made from the main session (a git command, permitted).
- `npm run release:dry` aborted on the other session's dirty release files; the release is DEFERRED (FC-1).
- The Rule 41 and stamp-proof reconnaissance ran as narrowed main-session reads and greps instead of through a hound.
- The commission.ts location was first cited at a wrong path (domain/commission.ts); the real path is app/modules/admin-finance/src/money/commission.ts, and the line 103 citation stands as the calculateCommission definition line.
- tsc was not re-measured at closeout; no result is claimed.
(Rule 8 Desktop copy skipped per JobCore decision; delivered by committed path.)
