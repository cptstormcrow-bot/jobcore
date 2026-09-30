---BUILD REPORT---
# Build Report — Badge class rename sync — JobCore docs (remaining unstyled badge spellings)

## Summary
- Date: 2026-09-29
- Project: jobcore
- Tier: A
- Branch: claude/blissful-ishizaka-daaa0b
- Commit: ab0c367 "docs(jobcore): rename unstyled badge classes to styled jc-badge-* names" (12 files changed, 100 insertions(+), 100 deletions(-))
- Plan: E:\Jeff\.claude\plans\jobcore-badge-class-rename-sync.md (approved by Jeff "go" + ExitPlanMode)

## Goal / Scope
Rename every remaining unstyled badge class in JobCore docs to the classes jobcore-basics-shared.css actually styles, fragments first then assembled pages, CRLF preserved. Docs-only; no app code.

Why: double-hyphen and built-* spellings matched no selector; base `.jc-badge` (shared.css:256-266) sets white text and no background, and the body background is #F8F9FA (shared.css:87), so those pills rendered white-on-near-white. Styled tier selectors: .jc-badge-built-live :269, .jc-badge-not-wired :273, .jc-badge-unverified :277, .jc-badge-not-reachable :282, .jc-badge-open-gap :286, .jc-badge-info :290; table class `table.jc-table` :298.

OUT OF SCOPE: fragments/05-ch5.html, fragments/06-ch6.html, jobcore-basics-sales-payments.html (deferred until commit 5081aa7, which exists only on branch claude/awesome-cerf-336760, merges to main); no CSS aliases; no guard/lint script; no app code.

## Rename map (exact-string replace-all)
| Old | New |
|-----|-----|
| jc-badge--built-live, jc-badge--live | jc-badge-built-live |
| jc-badge-built-not-wired, jc-badge--built-not-wired | jc-badge-not-wired |
| jc-badge--unverified, jc-badge--built-unverified, jc-badge-built-unverified | jc-badge-unverified |
| jc-badge--not-reachable, jc-badge--unreachable | jc-badge-not-reachable |
| jc-badge--open-gap, jc-badge--gap | jc-badge-open-gap |
| jc-badge-table | jc-table |

Execution: 4 Spot (patch-hound) waves, fragments before pages, each passing a dry-run exact-count gate; zero ABORTs.

## Changes (12 files, all in ab0c367; paths under app/docs/)
| File | Renames +/- | CRLF | BareLF | Unstyled after | Styled after |
|------|-------------|------|--------|----------------|--------------|
| fragments/00-front-matter.html | 4/4 | 47 | 0 | 0 | 11 |
| fragments/01-ch1.html | 1/1 | 81 | 0 | 0 | 2 |
| fragments/02-ch2.html | 3/3 | 232 | 0 | 0 | 6 |
| fragments/03-ch3.html | 10/10 | 174 | 0 | 0 | 32 |
| fragments/04-ch4.html | 16/16 | 186 | 0 | 0 | 32 |
| fragments/07-ch7.html | 8/8 | 91 | 0 | 0 | 16 |
| fragments/08-appendices.html | 5/5 | 106 | 0 | 0 | 10 |
| fragments/_slice4-payment-storyboard.html | 6/6 | 144 | 0 | 0 | 18 |
| jobcore-basics-front-matter.html | 8/8 | 391 | 0 | 0 | 19 |
| jobcore-basics-admin-finance.html | 10/10 | 205 | 0 | 0 | 32 |
| jobcore-basics-field-tech.html | 16/16 | 218 | 0 | 0 | 32 |
| jobcore-basics-appendices.html | 13/13 | 229 | 0 | 0 | 26 |

App code touched: none.

## Evidence table
Not a multi-artifact existence claim; see Verification.

## Verification
- 12-file totals: UnstyledTotal=0 StyledTotal=236 (before: 138 styled).
- Whole-docs scan: Files=16 UnstyledTotal=30 StyledTotal=274 (before: Files=16 UnstyledTotal=130 StyledTotal=176).
- Remaining 30 unstyled are the deferred files only: ch5 9, ch6 6, sales-payments 15.
- Page/fragment parity: front-matter 8 = 4+1+3; admin-finance 10 = ch3 10; field-tech 16 = ch4 16; appendices 13 = 8+5.
- CRLF unchanged, BareLF 0 on all 12. `git diff --numstat`: 12 files, 100/100.
- In ch7 and the appendices page, Styled rose by one less than renames because jc-badge-table -> jc-table leaves the badge set.

Verification command (Rule 29-B):
```powershell
$d='E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\worktrees\blissful-ishizaka-daaa0b\app\docs'
$styled='jc-badge','jc-badge-legend','jc-badge-built-live','jc-badge-not-wired','jc-badge-unverified','jc-badge-not-reachable','jc-badge-open-gap','jc-badge-info'
$files='fragments\00-front-matter.html','fragments\01-ch1.html','fragments\02-ch2.html','fragments\03-ch3.html','fragments\04-ch4.html','fragments\07-ch7.html','fragments\08-appendices.html','fragments\_slice4-payment-storyboard.html','jobcore-basics-front-matter.html','jobcore-basics-admin-finance.html','jobcore-basics-field-tech.html','jobcore-basics-appendices.html'
$rows = foreach($f in $files){ $t=[IO.File]::ReadAllText("$d\$f"); $m=@([regex]::Matches($t,'jc-badge[-\w]*') | ForEach-Object Value); [pscustomobject]@{File=$f; CRLF=([regex]::Matches($t,"`r`n")).Count; BareLF=([regex]::Matches($t,"(?<!`r)`n")).Count; Unstyled=@($m | Where-Object { $styled -notcontains $_ }).Count; Styled=@($m | Where-Object { $styled -contains $_ }).Count} }
$rows | Format-Table -AutoSize | Out-String -Width 200
"UnstyledTotal=" + ($rows | Measure-Object Unstyled -Sum).Sum + " StyledTotal=" + ($rows | Measure-Object Styled -Sum).Sum
$all = Get-ChildItem $d -Recurse -Include *.html,*.js,*.css | ForEach-Object { $m=@([regex]::Matches([IO.File]::ReadAllText($_.FullName),'jc-badge[-\w]*') | ForEach-Object Value); [pscustomobject]@{File=$_.Name; Unstyled=@($m | Where-Object { $styled -notcontains $_ }).Count; Styled=@($m | Where-Object { $styled -contains $_ }).Count} } | Where-Object { $_.Unstyled + $_.Styled -gt 0 }
"Files=$(@($all).Count) UnstyledTotal=$(($all|Measure-Object Unstyled -Sum).Sum) StyledTotal=$(($all|Measure-Object Styled -Sum).Sum)"
$all | Where-Object Unstyled -gt 0 | Format-Table -AutoSize | Out-String -Width 200
git -C 'E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\worktrees\blissful-ishizaka-daaa0b' diff --numstat
```

## Rule 41 — prior open forward contracts (lineage: jobcore)
Open items evaluated:
- 2026-09-29_not-wired-badge-class-sync.md:71 — Forward contracts: none; its B1 note (:75, ch5 + sales-payments after 5081aa7) is carried forward as this report's FC1. Its plan follow-ups (jobcore-badge-not-wired-sync.md:101-103: other double-hyphen legend modifiers, jc-badge-table, --built-*/-built-* spellings) are HONORED by ab0c367 for all in-scope files; :104 (5081aa7 only on claude/awesome-cerf-336760) carried as FC1.
- 2026-09-28_jobcore-supabase-bump-offline-start-tooling-commit-sdk-plan.md:34 — carried; app/tooling items, outside this docs-only scope.
- 2026-09-27_jobcore-c2-fk-m1-address-orphan-cleanup.md:45 — FC6 and chips task_4afe6e43 / task_f9aac49a carried; app-code/admin items, outside this docs-only scope.
- Resolvable-without-input items in scope: none remaining.

## Forward contracts
Forward contracts:
- FC1: after commit 5081aa7 (branch claude/awesome-cerf-336760) merges to main, apply the same rename map to fragments/05-ch5.html (9 unstyled: --live 1, --not-wired 5, --gap 3), fragments/06-ch6.html (6: --not-reachable 5, --gap 1), jobcore-basics-sales-payments.html (15: --not-reachable 5, --live 1, --not-wired 5, --gap 4), plus the ~10 additional --live uses 5081aa7 introduces; target whole-docs UnstyledTotal=0.

## Deviations / Defects
- C1 — Premise mapping: short forms mapped by meaning (--live -> built-live, --gap -> open-gap, --unreachable -> not-reachable); flagged in plan, approved.
- C2 — jc-badge-table has no rule; mapped to the styled table class jc-table (shared.css:298); flagged in plan, approved.
- D1 — Rule 18 breach: Wave 3 Spot dispatches went out without the one-line chat narration; acknowledged in chat, Wave 4 narrated correctly.
- D2 — Hound return defect: field-tech and appendices Spot hand-back headers reported row counts (4 and 7) instead of occurrence counts (16 and 13); independent re-scan and git numstat confirm 16 and 13.
- D3 — Rule 18 breach: Nestor build-report dispatch went out without the one-line chat narration (persona in description only); disclosed in chat.

## Test plan
Test plan: declined by Jeff (Rule 43 AskUserQuestion answer "No test plan (Recommended)")

## Delivery
In-repo only, no Desktop copy (JobCore convention).
