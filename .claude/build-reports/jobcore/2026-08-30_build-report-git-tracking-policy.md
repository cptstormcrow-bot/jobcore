# Build Report — Build Reports Now Git-Tracked, Delivered by Path Not Desktop Copy

**Project:** JobCore — process/bookkeeping only, no application code touched
**Date:** 2026-08-30
**Status:** COMPLETE
**Plan:** No formal Plan-Mode plan file — a direct, pre-approved 3-commit process change (gitignore reversal, backfill, this documenting report) following a pros/cons discussion with Jeff this session.
**Tier:** A

## Summary

Jeff decided that JobCore build reports should be committed in-repo going forward, rather than only
delivered as ephemeral Desktop copies. This report documents that policy change itself. Three commits
implement it:

| # | Commit | What it does |
|---|--------|---------------|
| 1 | `chore(jobcore): track build reports in git (revert e5ce3cd)` | Deletes `.gitignore`, reversing the `.claude/build-reports/` exclusion added in `e5ce3cd`. |
| 2 | `chore(jobcore): backfill build reports into git history` | Adds the 5 pre-existing Tier-A build reports under `.claude/build-reports/jobcore/` that predate this decision. |
| 3 | `docs(jobcore): build reports now git-tracked, delivered by path not Desktop copy` | This report, documenting the policy change. |

## What changed

1. Reverted the `.claude/build-reports/` gitignore exclusion added in `e5ce3cd`, so build reports are
   now git-tracked in this repo.
2. Backfilled the 5 pre-existing build reports into git history (previous commit in this same sequence).
3. Going forward, build-report delivery to Jeff for JobCore is by reporting the full committed in-repo
   file path in chat — **not** by copying the file to `E:\Jeff\Desktop\Build-Reports\`. That Desktop-copy
   mechanism is discontinued for JobCore specifically. It remains the default for other projects per the
   general Rule 8 protocol at `E:\Jeff\.claude\reference\build-report-protocol.md`, which is unchanged.

## Why

Jeff decided committing build reports in-repo is more durable and discoverable than ephemeral Desktop
copies, following a pros/cons discussion this session.

## Scope

JobCore only. This does not change the universal Rule 8 protocol for other projects (VITTLIX, FOC,
etc.) — those continue to deliver build reports as Desktop copies per
`E:\Jeff\.claude\reference\build-report-protocol.md`.

## Cross-reference

This pairs with the existing WHERE-root exception documented in memory
[[jobcore-build-report-canonical-root]], which established the project-repo-local root
(`Jobcore\.claude\build-reports\jobcore\`) as canonical for JobCore build reports. That memory decided
*where* JobCore build reports live; this report decides that they are also *git-tracked* there and
*delivered by path* rather than by Desktop copy.

## Files changed

- `.gitignore` — deleted (commit 1)
- `.claude/build-reports/jobcore/*.md` (5 files) — backfilled into git history (commit 2)
- `.claude/build-reports/jobcore/2026-08-30_build-report-git-tracking-policy.md` — this report (commit 3)

No application source files were touched by any of the three commits.

## Verification

1. `git show --stat` on commit 1 confirmed exactly 1 file changed (`.gitignore`, deleted).
2. `git status --porcelain -- .claude/build-reports/jobcore/` confirmed only the 5 expected untracked
   files existed prior to staging, nothing else.
3. `git show --stat` on commit 2 confirmed exactly those 5 files added, nothing else.
4. This report is verified by same-turn re-read after write, per Rule 22 / Nestor's own return
   contract.

## Forward contracts

none — process/bookkeeping change only, no application code touched.

## Deviations / Defects

none.

## Delivery

Delivered by reporting the full committed in-repo file path in chat:
`E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-08-30_build-report-git-tracking-policy.md`.
Per the policy this report documents, no Desktop copy is made for JobCore going forward.
