---BUILD REPORT---
GOAL: The Sales & Marketing docs chapter (ch5) wrongly said "Built, Not Wired". `app/modules/sales-marketing/src/index.ts` has routed `SalesMarketingRoot` since commit 2dc4fc7 (2026-08-17), and sales-role users land on `/m/sales-marketing`. This build was a docs-only correction: the fragment was updated first, then the assembled page was hand-synced (there is no assembler; the assembled page uses CRLF). Under Rule 41 it also closed the prior JobCore lineage's open items: obvious ones were fixed in code at Jeff's direction, and the rest were consolidated into 26 decision rows handed to a new session.

RoA: jobcore / BUILD
Plan: `E:\Jeff\.claude\plans\jobcore-sales-marketing-docs-wired.md` (approved)  |  Date: 2026-09-29  |  Status: COMPLETE
Why: The docs told readers a live, routed module was not wired, which contradicted the app. The chapter now matches the code, and the lineage backlog is reduced to items that genuinely need Jeff's decision.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\worktrees\optimistic-roentgen-35c304\.claude\build-reports\jobcore\2026-09-29_jobcore-sales-marketing-ch5-wired-docs.md
Forward contracts:
- The 26 prior-lineage decision rows (table below) are handed to the new session "Resolve JobCore decision items". They stay open until that session's Tier-A report resolves them or Jeff defers them.
- Jeff merges `claude/awesome-cerf-336760` and then runs from `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app`: `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` and `npx tsc -p apps/mobile/tsconfig.json --noEmit`. This verifies 1ebc11e's type-safety.
Test plan: declined by Jeff (docs-only text change; browser-verified)


🔧 METHOD / TOOLS USED
- Fragment-first docs edit — `app/docs/fragments/05-ch5.html` updated, then the assembled page hand-synced — no assembler exists; assembled page is CRLF.
- Spot dry-run then live edit — exact-match edit hound — see Deviations b).
- `verify-open-items.ps1` — validated the lineage items on disk (72 of 72, then 26 of 26 consolidated rows).
- `git show --stat` — confirmed both commit stats at report time.
- PowerShell `Select-String` and `[IO.File]::ReadAllLines` — badge and line counts (Measurements below).

✅ COMPLETED
| File / Target | Change | Action |
|---|---|---|
| `app/docs/fragments/05-ch5.html` (commit 5081aa7 "docs(jobcore): mark Sales & Marketing (ch5) as wired") | Lede at lines 4-12 now cites 2dc4fc7 and `/m/sales-marketing`; walkthrough intro at 29-31; four screen badges (lines 35, 51, 61, 96) changed from `jc-badge--not-wired` to `jc-badge--live` | edited |
| `app/docs/jobcore-basics-sales-payments.html` (commit 5081aa7) | Synced assembled copy of the fragment changes | edited |
| `app/apps/mobile/src/lib/admin-finance-repos.ts` (commit 1ebc11e "fix(jobcore): lineage fixes 61/52/11/50/53") | Item 61: `createJobRepository` maps enRouteAt/inProgressAt/completedAt to snake_case (:279-281). Item 52: `listCatalogTasks` selects and maps `task_number` (:2700, :2712, :2719) | edited |
| `app/modules/admin-finance/src/data/price-sheet-repo.ts` (commit 1ebc11e) | Item 11: adds `adjustment_target`/`adjustmentTarget` (:102, :113, :132-136). Item 50: `saveAreaAdjustment` upsert sets `updated_at` (:270) | edited |
| `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx` (commit 1ebc11e) | Item 53: replaces the 36-line FX-13 cast with `serviceTasksRepo={ports.serviceTasks}` (:949), trims the import (:57), drops `CalculationResult` | edited |

The 1ebc11e items are Rule 41 obvious fixes, made at Jeff's direction.

## Measurements (Rule 29-B)

Run from the worktree root `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\worktrees\optimistic-roentgen-35c304`, PowerShell:

```
$f='app/docs/fragments/05-ch5.html'; $a='app/docs/jobcore-basics-sales-payments.html'; foreach($p in @($f,$a)){ "${p}: live=$((Select-String -Path $p -Pattern 'jc-badge--live' -AllMatches).Matches.Count) notwired=$((Select-String -Path $p -Pattern 'jc-badge--not-wired' -AllMatches).Matches.Count) lines=$([IO.File]::ReadAllLines((Resolve-Path $p)).Length)" }
```

Output:

```
app/docs/fragments/05-ch5.html: live=6 notwired=0 lines=125
app/docs/jobcore-basics-sales-payments.html: live=6 notwired=0 lines=248
```

Commit stats, `git show --stat --format='%h %s' <sha>` from the same root, re-run at report time:

```
5081aa7 docs(jobcore): mark Sales & Marketing (ch5) as wired

 app/docs/fragments/05-ch5.html              | 23 +++++++++++------------
 app/docs/jobcore-basics-sales-payments.html | 23 +++++++++++------------
 2 files changed, 22 insertions(+), 24 deletions(-)
```

```
1ebc11e fix(jobcore): lineage fixes 61/52/11/50/53

 app/apps/mobile/src/lib/admin-finance-repos.ts     | 11 +++---
 .../admin-finance/src/data/price-sheet-repo.ts     |  7 ++++
 .../admin-finance/src/screens/AdminFinanceRoot.tsx | 41 ++--------------------
 3 files changed, 15 insertions(+), 44 deletions(-)
```

## Rule 41 lineage gate

The prior lineage's open Forward contracts were evaluated before this report was authored, and they were honored: resolved, fixed, or explicitly handed off.

- 72 open lineage items were swept and validated 72 of 72 by `verify-open-items.ps1`.
- Closed on evaluation: items 1, 2, 3, 6, 9, 12, 13, 18, 20-25, 27-31, 35, 44, 45, 54, 56-60, 62 (navigation part) and 63. Item 1, the S&M visual check, was marked done by Jeff on 2026-09-29.
- Fixed in 1ebc11e: items 11, 50, 52, 53 and 61.
- The rest were consolidated into 26 decision rows, validated with the footer "Verified on disk: 26 of 26 items (verify-open-items.ps1)", and handed to a new session via a spawn_task titled "Resolve JobCore decision items", per Jeff: "Fix the obvious ones and give me the ones you cannot fix without my decision. Then create a prompt to cover those that need decisions in a different session."

Decision rows (source = `.claude\build-reports\jobcore\<file>:<line>`). Row numbers are the consolidated-list numbers, not the lineage item numbers above.

| # | Short description | Source |
|---|---|---|
| 1 | Request C: unify JobCore app design with the web page (deferred, not started) | 2026-08-27_jobdetail-action-buttons-role-color.md:49 |
| 2 | Punch List screen wired into job detail route and field-tech actions | 2026-08-30_job-detail-action-buttons.md:97 |
| 3 | Editable-until-scheduled gate on Estimate flow; orphaned PriceEstimatingScreen cleanup | 2026-08-30_job-detail-action-buttons.md:98 |
| 4 | Payment Received descoped: pay-service choice, confirmation flow, tech-vs-admin permissions | 2026-08-30_job-detail-action-buttons.md:100 |
| 5 | Jobs list screen: check for the service-area omission fixed in job detail | 2026-09-02_service-area-error-fix.md:79 |
| 6 | MonthView assertion file once a React Native-capable runner exists | 2026-09-04_field-tech-timeoff-modal-month-view.md:43 |
| 7 | Queued offline lead-create payloads with old camelCase keys: verify replay | 2026-09-04_leads-screen-create-edit-job.md:62 |
| 8 | Thread service task id into the commission calculation | 2026-09-20_jobcore-redlines-stabilize.md:19 |
| 9 | Migration 0032/0049 ordering bug and stale header | 2026-09-20_jobcore-redlines-stabilize.md:21 |
| 10 | Remove stray duplicate migrations (0005 money, duplicate 0047); deletion needs Jeff's go | 2026-09-20_jobcore-redlines-stabilize.md:23 |
| 11 | Await the save before tab switch or navigation (optional improvement) | 2026-09-25_job-detail-save-customer-edits-fix.md:29 |
| 12 | Root-cause the "fetch failed" crash (offline flag not proven a fix) | 2026-09-28_jobcore-supabase-bump-offline-start-tooling-commit-sdk-plan.md:36 |
| 13 | Run row-level security test suite and manual smoke checks from Employee Screen Edits merge | 2026-09-01_job-estimate-wave2-slice-d-migrations.md:39 |
| 14 | Jeff: live visual/simulator walkthrough of job detail action buttons role-color | 2026-09-01_ledger-stale-items-reconciliation.md:22 |
| 15 | Jeff: EAS dev build and on-device checklist for job detail restyle | 2026-09-04_job-detail-screen-restyle.md:82 |
| 16 | Jeff: on-device Expo walkthrough of Leads new lead, edit, create job | 2026-09-04_leads-screen-create-edit-job.md:61 |
| 17 | Round-6 time-off HTML retest plan delivered but unexecuted (deferred) | 2026-09-05_field-tech-timeoff-closeout.md:35 |
| 18 | Go/no-go on deleting stale duplicate next-APK-upgrade-plan HTML on the Desktop | 2026-09-07_android-package-id-v2.md:57 |
| 19 | Deferred live dev-server verification carried from close-outs closeout | 2026-09-09_close-outs-closeout.md:29 |
| 20 | JD-08 out of scope for redlines closeout; later session owes it | 2026-09-20_jobcore-redlines-stabilize.md:18 |
| 21 | Thread task id into the edge function (any deploy needs explicit approval) | 2026-09-20_jobcore-redlines-stabilize.md:20 |
| 22 | Path parameter for build report scanner (project-local report roots) | 2026-09-20_jobcore-redlines-stabilize.md:28 |
| 23 | Jeff: visual check of Address field on job detail; seed customer id watch item | 2026-09-27_jobcore-c2-fk-m1-address-orphan-cleanup.md:52 |
| 24 | Typecheck run and live visual/simulator check of job detail action buttons (skipped) | 2026-08-27_jobdetail-action-buttons-role-color.md:50 |
| 25 | Backfill older job-assignment investigator rows stored with wrong kind (dev data only) | 2026-09-04_job-detail-screen-restyle.md:145 |
| 26 | Live dev-server check of merged payment and paid buttons, incl. settled-payment cases and failure text | 2026-09-09_merge-payment-paid-buttons.md:62 |

Verified on disk: 26 of 26 items (verify-open-items.ps1)

🧪 VERIFY
- [ ] From `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app`, after merging `claude/awesome-cerf-336760`: `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` then `npx tsc -p apps/mobile/tsconfig.json --noEmit` — expect no errors (covers 1ebc11e; see Forward contract 2).
- [ ] Re-run the Measurements command — expect `live=6 notwired=0` for both files.

## Deviations / Defects
- a) An early recon count of the stale Chapter 6 content in the assembled page was wrong — a re-measure corrected it before any edit.
- b) A Spot dry-run returned a count mismatch — per Spot's exact-match rule no live run happened on the mismatch, and the edit was re-specified.
- c) Badge-class drift was noticed outside ch5 — out of scope; spun off as task_439a57e3.
- d) The assembled page's Chapter 6 "placeholder root" wording is also stale — out of scope; spun off as task_c41449c4.
- e) Scope grew beyond the original "Do not touch app code" (which governed the docs task) into lineage app fixes — done at Jeff's direction under Rule 41.
- f) One lineage evaluation started from a wrong `db push` premise; the first live push was migrations 0052-0054 on 2026-09-11 — corrected on disk before any verdict.
- g) Lineage items 51 and 19 were reclassified after on-disk checks.
- h) The 2026-09-25 report (`2026-09-25_job-detail-save-customer-edits-fix.md:110`) carries a stale "CARRIED" note — recorded here; the historical report was left unedited.
- i) tsc could not run in the worktree: `npx tsc` resolves to the unrelated npm "tsc" package, and `app\node_modules` is permission-denied — a grep-and-read substitute check came back clean, and the real run is Forward contract (2).
- j) Jeff answered the Rule 43 test-plan question ("No test plan") before the scope grew to the lineage fixes — it was applied to the whole closeout and not re-asked.

📊 SUMMARY
Files touched: 5  |  ~Lines +37 / -68  |  Deferred: 0  |  ASSESS: fill after VERIFY
---BUILD REPORT---
