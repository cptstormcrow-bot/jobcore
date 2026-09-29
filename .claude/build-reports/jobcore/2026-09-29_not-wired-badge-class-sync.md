---BUILD REPORT---
# Build Report — Not-wired badge class sync (JobCore docs)

## Summary
- Date: 2026-09-29
- Project: jobcore
- Tier: A
- Branch: claude/blissful-ishizaka-daaa0b
- Commit: 3ec22f0 "docs(jobcore): rename not-wired badge class to styled jc-badge-not-wired"
- Plan: E:\Jeff\.claude\plans\jobcore-badge-not-wired-sync.md

## Goal / Scope
Drift found during 5081aa7: the badge legend (app/docs/fragments/00-front-matter.html ~40-44) named the not-wired badge `jc-badge--unwired`; chapter fragments used `jc-badge--not-wired`. Task: count both per file, find which one the CSS styles, rename the other everywhere (fragments first, then assembled pages, by hand, keeping CRLF), verify. Verbatim constraint: "Docs-only task; do NOT edit app code."

## Finding — which name the CSS styles
Neither. app/docs/jobcore-basics-shared.css styles only single-hyphen modifiers; the not-wired rule is `.jc-badge-not-wired` at :273 (`background: var(--jc-color-warning)`). No `--` selector exists. An undefined class falls back to base `.jc-badge` (:256-266: white text, no background) — an invisible pill on a light page. So both requested spellings were renamed to the styled `jc-badge-not-wired` (see Deviation A1).

## Changes (4 edits, all in 3ec22f0; paths under app/docs/)
| # | File | Line | Change | CRLF / BareLF after |
|---|------|------|--------|---------------------|
| 1 | fragments/00-front-matter.html | 41 | jc-badge--unwired → jc-badge-not-wired | 47 / 0 |
| 2 | fragments/07-ch7.html | 62 | jc-badge--not-wired → jc-badge-not-wired | 91 / 0 |
| 3 | jobcore-basics-front-matter.html | 66 | jc-badge--unwired → jc-badge-not-wired | 391 / 0 |
| 4 | jobcore-basics-appendices.html | 89 | jc-badge--not-wired → jc-badge-not-wired | 229 / 0 |

Pre-commit `git diff --numstat`: 4 files, each `1 1`. App code touched: none.

## Evidence table
Not a multi-artifact existence claim; see Verification.

## Verification
### Before / after counts (`--unwired` / `--not-wired` / styled `-not-wired`)
| File | Before | After |
|------|--------|-------|
| fragments/00-front-matter.html | 1/0/0 | 0/0/1 |
| fragments/07-ch7.html | 0/1/0 | 0/0/1 |
| jobcore-basics-front-matter.html | 1/0/0 | 0/0/1 |
| jobcore-basics-appendices.html | 0/1/0 | 0/0/1 |
| fragments/05-ch5.html | 0/5/0 | 0/5/0 (skipped — B1) |
| jobcore-basics-sales-payments.html | 0/5/0 | 0/5/0 (skipped — B1) |
| jobcore-basics-shared.css | 0/0/1 | 0/0/1 |

Command (re-run at report time; matched):
```
$wt='E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\worktrees\blissful-ishizaka-daaa0b\app\docs'
Get-ChildItem -Path $wt -Recurse -Include *.html,*.css,*.js | ForEach-Object { $t=[IO.File]::ReadAllText($_.FullName); [pscustomobject]@{File=$_.FullName.Substring($wt.Length+1); Unwired=([regex]::Matches($t,'jc-badge--unwired')).Count; DashNotWired=([regex]::Matches($t,'jc-badge--not-wired')).Count; Styled=([regex]::Matches($t,'jc-badge-not-wired')).Count} } | Where-Object { $_.Unwired+$_.DashNotWired+$_.Styled -gt 0 }
```

### CRLF evidence
Command (re-run at report time; matched the Changes table):
```
'fragments\00-front-matter.html','fragments\07-ch7.html','jobcore-basics-front-matter.html','jobcore-basics-appendices.html' | ForEach-Object { $t=[IO.File]::ReadAllText("$wt\$_"); [pscustomobject]@{File=$_; CRLF=([regex]::Matches($t,"`r`n")).Count; BareLF=([regex]::Matches($t,"(?<!`r)`n")).Count} }
```

### Legend ↔ CSS agreement
Legend span at fragments/00-front-matter.html:41 and jobcore-basics-front-matter.html:66 now use `jc-badge-not-wired`, the exact selector at jobcore-basics-shared.css:273. Command: `'fragments\00-front-matter.html','jobcore-basics-front-matter.html','fragments\07-ch7.html','jobcore-basics-appendices.html','jobcore-basics-shared.css' | ForEach-Object { Select-String -Path "$wt\$_" -Pattern 'jc-badge-not-wired' | Select-Object -First 5 }`. Verdict: agree.

## Rule 41 — prior open forward contracts (lineage: jobcore)
Scan command:
```
$d='E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\worktrees\blissful-ishizaka-daaa0b\.claude\build-reports\jobcore'; Select-String -Path "$d\*.md" -Pattern 'Forward contracts' | Sort-Object Filename -Descending | Select-Object -First 20 | ForEach-Object { $l=$_.Line; if($l.Length -gt 220){$l=$l.Substring(0,220)}; "{0}:{1}  {2}" -f $_.Filename,$_.LineNumber,$l }
```
Open items evaluated:
- 2026-09-28_jobcore-supabase-bump-offline-start-tooling-commit-sdk-plan.md:34 — `--offline` not root-caused as the `TypeError: fetch failed` fix; supabase-js 2.117.2 exercised on web/Metro only (native/EAS untested); SDK 52->57 plan unexecuted (12 unverified facts); no SDK hop / expo-doctor / .env / CLI upgrade / npm audit fix done.
- 2026-09-27_jobcore-c2-fk-m1-address-orphan-cleanup.md:45 — FC6 carried (`patchLifecycle` `'key' in patch` idiom); chips task_4afe6e43 (deliver-plan.ps1 goal-slug bypass) and task_f9aac49a (brs-scanner hardcoded to admin root); F-new-1 Address field visual check (Jeff); F-new-2 Ben Castellano seed id 00000000-0000-4000-8000-000000000206 watch.
- 2026-09-26_jobcore-save-followups-rpc-trigger-awaitsave.md :40-44 (customer.saveForJob offline replay handler; FC1/FC3/FC6); 2026-09-25_job-detail-save-customer-edits-fix.md :54-55 (FC4/FC5 need RPC design; FC1-3, FC6-9); 2026-09-20_jobcore-redlines-stabilize.md :84-89 (redlines FCs; service_task_id not threaded into calculateCommission).

Result: resolvable within this docs-only scope: 0. Needing Jeff's input before this report: 0. All carried unchanged (app code / DB / admin tooling / Jeff visual checks).

## Forward contracts
Forward contracts: none

## Deviations / Defects
- A1 — Target name: the task said to keep "the name the CSS styles"; the CSS styles neither requested spelling. Both were renamed to the styled `jc-badge-not-wired` (css:273). Flagged in plan Premises; approved by Jeff.
- B1 — Skipped fragments/05-ch5.html (5 × `jc-badge--not-wired`, first :7) and jobcore-basics-sales-payments.html (5, first :34). Commit 5081aa7 (only on branch claude/awesome-cerf-336760, not on this branch) already clears these spans; editing here would conflict on merge. Approved in plan. After 5081aa7 merges, those two files should read 0/0/x.
- C1 — Report filed in the flat lineage root `.claude\build-reports\jobcore\` rather than the planned slug subfolder, to match the existing flat layout Themis scans.
- Defects in this change's own output: none.

## Test plan
Test plan: declined by Jeff ("No test plan")

## Follow-ups (found, NOT fixed — outside this task's scope)
The CSS defines only single-hyphen modifiers (built-live :269, not-wired :273, unverified :277, not-reachable :282, open-gap :286, info :290). These spellings in app/docs/ have no matching rule and render as bare white pills:
| Spelling | First source (app/docs/) | Also in |
|----------|--------------------------|---------|
| jc-badge--live | fragments/00-front-matter.html:40 | 01-ch1:9, 02-ch2:9 (n=3), 05-ch5:119, 07-ch7:61, jobcore-basics-front-matter.html:65 (n=5), jobcore-basics-appendices.html:88, jobcore-basics-sales-payments.html:146 |
| jc-badge--gap | fragments/00-front-matter.html:44 | 05-ch5:21 (n=3), 06-ch6:80, jobcore-basics-front-matter.html:69, jobcore-basics-sales-payments.html:48 (n=4) |
| jc-badge--not-reachable | fragments/04-ch4.html:153 | 06-ch6:5 (n=5), 07-ch7:64 (n=2), jobcore-basics-field-tech.html:180, jobcore-basics-appendices.html:91 (n=2), jobcore-basics-sales-payments.html:159 (n=5) |
| jc-badge--open-gap | fragments/04-ch4.html:116 | 08-appendices:7, jobcore-basics-field-tech.html:143 (list truncated) |
| jc-badge--built-live | fragments/04-ch4.html:14 (n=8) | 08-appendices:24 (n=3), jobcore-basics-field-tech.html:41 (n=8), jobcore-basics-appendices.html:143 (n=3) |
| jc-badge--built-unverified | fragments/04-ch4.html:107 (n=6) | jobcore-basics-field-tech.html:134 (n=6) |
| jc-badge--built-not-wired | fragments/08-appendices.html:97 | jobcore-basics-appendices.html:216 |
| jc-badge-built-not-wired | fragments/03-ch3.html:42 (n=8) | jobcore-basics-admin-finance.html:69 (n=8) |
| jc-badge-built-unverified | fragments/03-ch3.html:30 (n=2) | jobcore-basics-admin-finance.html:57 (n=2), fragments/_slice4-payment-storyboard.html:27 (n=6) |

Note: the scan was capped at 40 output lines, so this list is partial (more `--open-gap` files, `jc-badge-table` usages (no CSS rule), and any other extras were cut off). Reconstructed scan form: `Select-String -Path "$wt\*.html","$wt\fragments\*.html" -Pattern 'jc-badge--[a-z-]+|jc-badge-built-[a-z-]+|jc-badge-table'` (re-run without the cap to get the full set). Recommended next task: one taxonomy pass that maps every badge spelling to the 6 styled modifiers (or adds rules), fragments first then assembled pages.

## Out of scope
App code; CSS changes; the follow-up spellings above; merging 5081aa7.
