---BUILD REPORT---

Project: JobCore (repo root E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app), branch jobcore-role-landing-0.1.3
Date: 2026-10-16
Summary: Job Detail screen #0041 (apps/mobile/app/job/[jobId].tsx) and its shared header chrome: slices S1-S7 from the plan E:\Jeff\.claude\plans\pasted-content-id-fb42-global-eager-heron.md (Jeff's rules G1-G7).
Test plan: not requested this session (the Rule 43 gate was not asked or answered this session).
Forward contracts: Retire #0039 into #0041 and #0031 into #0011 only on Jeff's explicit go. Neither retirement was done here.

## Slices
- S1-S4: see the plan file above for scope. All four are done and are covered by the verification below.
- S5: the title-bar frame is sand, the header lines are centered, and the divider bar is colored by state (paid -> colors.paidBar, approved -> colors.estimateApprovedBar, otherwise colors.text). Files: packages/ui/src/JobTitleBarHeader.tsx, apps/mobile/app/job/[jobId].tsx (the `rule` bar hunk only).
- S6 (G4): times and billed time in the title bar. apps/mobile/src/components/JobHeader.tsx builds timeLines ("En route", "Arrived", "Completed", "Billed" from inProgressAt to completedAt) and passes them to JobTitleBarHeader. AppChrome gets titleBarTone="gold" and titleBarInset={5}. totalHours is centered.
- S7 (G6 way out, G7 spacing): added apps/mobile/app/m/_layout.tsx (a Slot plus a bottom tab bar, Calendar and Jobs, with accessibilityRole tablist/tab). Module routes under /m/[moduleId] had no bottom bar, so removing Back on #0011 and #0023 would have left no visible way out. The title-bar menu and breadcrumb were already kept by the shared chrome.

## Verification (Rule 29-B provenance)
All commands were run from E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app.
- `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` -> exit 0
- `npx tsc -p apps/mobile/tsconfig.json --noEmit` -> exit 0
- `npm test` -> tests 364, pass 364, fail 0, cancelled 0, skipped 0, exit 0. The earlier S6 run counted 351, so the count rose by 13, presumably from other sessions' assertion files.

## Deviations / Defects
- S6 visual check SKIPPED: the 8081 dev app redirects to /sign-in and no credentials are entered by the assistant. S5/S6 title-bar rendering is verified by type-check and tests only, not by eye.
- G7 spacing scope is an assumption. G6 and G7 are both labeled "Derived rule, not a new request", and the G7 scope was not specified. No spacing values were changed beyond what S5-S7 already touched. An optional trim of AdminFinanceRoot styles.content from spacing.md to spacing.sm was judged low value and not done.
- G6 addition: the bottom tab bar on module routes comes from the new m/_layout.tsx, a new file rather than an edit to another session's file.
- UNVERIFIED: the /calendar and /jobs hrefs in m/_layout.tsx are assumed to resolve to the (tabs) routes. JobHeader already pushes /calendar?..., so /calendar is known to work, but there is no on-screen confirmation without sign-in.
- Other sessions' working-tree changes are present and were left unstaged: JobCloseOutRegion, admin-finance-repos, offline-ops/admin-finance, ports.ts, UniversalCalendar, JobPaymentRegion, payments*, record-job-payment*, job-timeline*, migrations 0087 and 0091, docs/snapshots/v0.4.0/*.
- Excluded from the commit (mixed ownership with other sessions' work, left unstaged/uncommitted): `app/apps/mobile/app/job/[jobId].tsx` (my status-rule bar-color hunk ~:1364 and the isActive wiring are in the working tree but not committed, because the file also carries other sessions' staged and unstaged hunks); `app/apps/mobile/src/components/JobTaskList.tsx` is not in this commit: my S2 edits (Add-button primary variant, empty qty View removed) were swept into another session's commit 93b5794 and are already in history; `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx` (only hunk present is another session's time-off wiring; no S7 showBack change was needed there).
- Retirements #0039->#0041 and #0031->#0011 not done; they await Jeff's explicit go.
- Otherwise none.
