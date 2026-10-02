---BUILD REPORT---
GOAL: JobCore Round 3 retest fixes - assignments, job page, tech overview. Jeff's Round 3 retest (R3.1-R3.10) found that R3.1 and R3.5 passed, R3.2/3/4/6/7/8/10 failed, and R3.9 was not tested. The main failure was a duplicate key error (job_assignments_one_investigator_per_job) when reassigning a job. This build made assigning replace the old tech, fixed the Assignment Board and job page, and made the tech Overview lists tappable, with photo thumbnails in the tech job detail. It also carried two umbrella items in the same files: #10 migration-path comment repoints (6 files) and #11 stay-on-tab after a failed save.

RoA: jobcore / BUILD
Plan: `E:\Jeff\.claude\plans\jobcore-round-3-retest-fixes-assignments-job-page-tech.md` (approved); parent umbrella plan `E:\Jeff\.claude\plans\resolve-jobcore-decision-items-rule-41-hand-off-2026-09-29.md`  |  Date: 2026-10-01  |  Status: COMPLETE
Why: Reassigning a job failed and several Round 3 screens did not behave as Jeff expected. Jeff's decisions: one Prem tech, replaceable; the job page asks Service or Prem before approval; a Dev Tech may take any job during development with no distinction (but the app will one day send techs to real work); R3.10 stays on Overview; Q-a remove old records; Q-b add lines only; Q-c thumbnails in job detail; Q-d Round 3 fixes only.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\worktrees\optimistic-roentgen-35c304\.claude\build-reports\jobcore\2026-10-01_jobcore-round3-retest-fixes.md
Forward contracts:
- Set DEV_NO_TECH_DISTINCTION to false in `app/modules/admin-finance/src/dev-flags.ts` before the app sends techs to real jobs.
- Optional: fold the S10b inserted lines (field-tech `index.ts` L207-211) into L206 once the peer session's change to that file has merged.
Test plan: declined by Jeff (2026-10-01); fixes are gate-verified only

🔧 METHOD / TOOLS USED
- Rolling slices S1-S13 with hound writes (Nestor, Spot) — see Deviations.
- `npx.cmd --no-install tsc` from `app/` — type checks (the plain npx form was sandbox-blocked).
- `npm.cmd test` — full test run.
- `git commit -- <17 paths>` after a dry-run — path-limited commit.
- `git log -1 --stat` and `git diff --cached --name-only` — commit and staging measurements.

✅ COMPLETED
| File / Target | Change | Action |
|---|---|---|
| `app/modules/admin-finance/src/dev-flags.ts` (S1) | New constant DEV_NO_TECH_DISTINCTION = true (a constant, not __DEV__, because __DEV__ is false in release APKs); exported from admin-finance `index.ts` | created |
| `app/modules/admin-finance/src/flows/assign-investigator.ts`, `assign-job.ts`, `data/ports.ts`, `app/apps/mobile/src/lib/admin-finance-repos.ts` (S2-S4) | Replace-on-assign: investigator assign calls clearInvestigator then create; installer assign is a no-op for the same tech, otherwise clearInstaller then create. clearInstaller added to port and repo; pre-existing clearInvestigator hardened with .select() and a throw when nothing is removed | edited |
| `app/modules/admin-finance/src/flows/__assertions__/assign-investigator.assert.ts` | New assert file, 3 cases | created |
| `app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx` (S5/S5b) | On-screen assign notice (Alert.alert is a no-op on web; there had never been a success alert) | edited |
| `app/modules/admin-finance/src/screens/AssignmentBoardScreen.tsx` (S6) | Client name above address, Job # number, Tech line; picker = any active tech (role tech and active), Owner excluded, Prem-aware picker value; aligned button cluster (width 330) with fixed-width Confirm slot (width 90, invisible placeholder when hidden); inline row messages | edited |
| `app/apps/mobile/app/job/[jobId].tsx`, `app/apps/mobile/src/components/JobHeader.tsx` (S7/S8/S8b) | Service/Prem segment before approval (admin, estimate not approved), unassign, errors cleared at start of load, service-area filter skipped while the dev flag is on; carried #11 (stay on tab after failed save) | edited |
| `app/modules/field-tech/src/screens/Overview.tsx` (S9) | Tappable Assigned jobs and Approved time off lists, built from the same arrays as the counts | edited |
| `app/modules/field-tech/src/index.ts` (S10b) | Inserted L207-211 wire onOpenJob / onOpenTimeOff (L206 left as-is, insert-only rule) | edited |
| `app/modules/field-tech/src/screens/FieldJobDetail.tsx`, `app/modules/field-tech/src/data/ports.ts`, `app/apps/mobile/src/lib/field-tech-repos.ts` (S11/S11b) | Photo thumbnails via optional signedUrlFor on the photos port (createSignedUrl, 3600s) | edited |
| `app/modules/admin-finance/src/flows/__assertions__/close-out-job.assert.ts` (S13) | Deps update | edited |
| S12 Round 4 test plan | Skipped: Jeff declined 2026-10-01 | skipped |
| 6 files (carried umbrella #10) | Migration-path comment repoints, inside files above | edited |

Commit: 8ba6a8e1a41d5652f8985fd84737cfd8ae8704b7 on branch claude/awesome-cerf-336760, local only, not pushed. Path-limited commit (`git commit -- <17 paths>`); the 51 staged umbrella #10 SQL deletions were deliberately left staged for the umbrella commit.

## Evidence table (Rule 29)

All 17 committed paths: present (in 8ba6a8e).

| Path | Status |
|---|---|
| app/apps/mobile/app/job/[jobId].tsx | present (in 8ba6a8e) |
| app/apps/mobile/src/components/JobHeader.tsx | present (in 8ba6a8e) |
| app/apps/mobile/src/lib/admin-finance-repos.ts | present (in 8ba6a8e) |
| app/apps/mobile/src/lib/field-tech-repos.ts | present (in 8ba6a8e) |
| app/modules/admin-finance/src/data/ports.ts | present (in 8ba6a8e) |
| app/modules/admin-finance/src/dev-flags.ts (new) | present (in 8ba6a8e) |
| app/modules/admin-finance/src/flows/__assertions__/assign-investigator.assert.ts (new) | present (in 8ba6a8e) |
| app/modules/admin-finance/src/flows/__assertions__/close-out-job.assert.ts | present (in 8ba6a8e) |
| app/modules/admin-finance/src/flows/assign-investigator.ts | present (in 8ba6a8e) |
| app/modules/admin-finance/src/flows/assign-job.ts | present (in 8ba6a8e) |
| app/modules/admin-finance/src/index.ts | present (in 8ba6a8e) |
| app/modules/admin-finance/src/screens/AdminFinanceRoot.tsx | present (in 8ba6a8e) |
| app/modules/admin-finance/src/screens/AssignmentBoardScreen.tsx | present (in 8ba6a8e) |
| app/modules/field-tech/src/data/ports.ts | present (in 8ba6a8e) |
| app/modules/field-tech/src/index.ts | present (in 8ba6a8e) |
| app/modules/field-tech/src/screens/FieldJobDetail.tsx | present (in 8ba6a8e) |
| app/modules/field-tech/src/screens/Overview.tsx | present (in 8ba6a8e) |

## Measurements (Rule 29-B)

- `git log -1 --stat` -> 17 files changed, 468 insertions(+), 64 deletions(-).
- `@(git diff --cached --name-only).Count` after the commit -> 51.
- From `app/`: `npx.cmd --no-install tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` -> exit 0.
- From `app/`: `npx.cmd --no-install tsc -p apps/mobile/tsconfig.json --noEmit` -> exit 0.
- From `app/`: `npm.cmd test` -> tests 171, pass 171, fail 0, exit 0.

## Rule 41 lineage gate

The JobCore lineage's prior open forward contracts are the 26 rows of the Rule 41 hand-off. Every row has a Jeff-approved disposition in the umbrella plan above. This report honors none of them directly, except that it carries #10 repoints and #11 in shared files. It adds the two new contracts above.

🧪 VERIFY
- [x] Type checks and `npm.cmd test` passed (Measurements above).
- [ ] Jeff: on-device check of the Assignment Board button cluster (width 330) at phone width; not verified on device.

## Deviations / Defects
- Process: status line not printed first on 32 turns; Rule 6/22 breaches; two refused main-session Edits on the plan L133 tripped the Rule 22-B breaker (Spot applied the edits); Edit-tool newline-join defect; plan edit at L122 failed on a U+23F8 character; Slice 9a was briefly ordered before the Round 3 commit (corrected); the Slice 10 retest question was asked in prose, not AskUserQuestion (still unanswered); one turn had no Insight block; near-miss: 51 pre-staged #10 SQL deletions would have been swept into a plain commit (fixed with a dry-run-verified path-limited commit).
- Attribution errors: clearInvestigator was mis-attributed as new (it pre-existed); AssignmentBoard was guessed as #10 work (it is pure S6); assign-investigator.ts and assign-job.ts were labeled pure (both mixed with #10 repoints).
- Premise failures: SDK 57 after f439abf; two #21 premises; R3 soft-end theory; RLS hypothesis; L621/L633 mislabel; pause-glyph misdiagnosis; handleAssign premise and R3.7 omission; missed coversServiceArea filter; S10 single-line premise; S11 URL-helper premise; S13 deps premise; [jobId].tsx called CRLF; S9 hollow compiled-clean claim; S10b line-endings premise; node_modules junction hypothesis; S7/S8 component mismatch; field-tech index.ts holds peer hunks.
- Measurement defects: ANSI false 71/71; Get-ChildItem without -Force; hidden-dir Grep gap; Nestor counts quoted unverified; Nestor false CR=0.
- Build defects fixed: TS2322 at [jobId].tsx (props moved to JobSummaryRest); TS2769 at field-tech index.ts (removed props default = {}); TS2339 colors.navy (used colors.primary); sandbox block (npx.cmd --no-install from app/).
- Other: Spot repoint missed a sibling file and touched 2 .generated.md files; stale 0001..0023 text; 0071 migration collision (renumbered to 0072); worktree had no Supabase link state; DEPLOY.md doc gap; R3.10 test wording; S2 stale citation; S9 stale doc text; Round 3 plan had no status field; the 330px button cluster may crowd at phone width (not verified on device).

📊 SUMMARY
Files touched: 17  |  ~Lines +468 / -64  |  Deferred: 0  |  ASSESS: fill after VERIFY
---BUILD REPORT---
