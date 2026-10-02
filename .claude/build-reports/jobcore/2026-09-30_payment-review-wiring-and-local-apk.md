---BUILD REPORT---

# JobCore: Payment-review wiring + standalone Android APK (local Gradle build)

**Plan:** E:\Jeff\.claude\plans\payment-review-wiring-standalone-android-apk-local-build.md (slug payment-review-wiring-and-local-apk) | **Date:** 2026-09-30 to 2026-10-01 | **Status:** COMPLETE (phone smoke results pending)
**Project:** jobcore
**Branch:** claude/focused-wozniak-8a887a
**Tier:** A
**Task id:** br-20261001-payment-review-apk

## GOAL

Revive payment-review, wire it into the host app, and produce a standalone installable Android APK built locally.

Decisions (Jeff): revive payment-review; admin-finance owns Mark Paid; local Gradle build on this PC (no EAS); stay on Expo SDK 52 / RN 0.76.9; iPhone is a later, separate track.

## Delivered

| File / Target | Change |
|---|---|
| Payment-review wiring (W1-W8) | Complete; 171/171 tests pass. S1-S6 also complete. |
| Mobile version | 0.1.2 / versionCode 2; package com.sdassemblypros.jobcore.v2 (debug keystore) |
| build-apk.ps1 + build:apk npm script | New local build path, with docs |
| Migration 0070 / 0071 / 0073 | 0071 collided and was renumbered to 0073. 0073 pushed live to hosted (Jeff approved a temp-folder push). 0070/0071/0073 live locally and on hosted. |
| Merge to main | e6f7927 |
| APK | E:\Jeff\Desktop\jobcore-0.1.2-vc2.apk, 82.9 MB, SHA256 7F0479C5AC11BA4909BDC8939CA91C08A31B8692D68357BF197F3927D0D218D2 |
| Version history | v4 artifact https://claude.ai/artifact/H6qEYFUBa9EVw9Zw7DKf3o (Desktop copy E:\Jeff\Desktop\jobcore-version-history.html) |

## Verification

- build-apk.log, Stage 3 VERIFY: "PASS apksigner verify" and "PASS badging: com.sdassemblypros.jobcore.v2 0.1.2 (vc 2)"; SHA-256 and size match the table above. (The log has no literal "VERIFY PASSED" string; both Stage 3 checks read PASS.)
- Hosted profiles-guard suite (app/supabase/tests/0031_employee_profile_fields_rls.test.sql), run against hosted with Jeff's explicit approval: PASS for AC-31.1, AC-31.2, AC-31.3, AC-31.4 inside begin/rollback; post-check found 0 leftover rows; scratch SQL cleaned up (Rule 14).

## Commits

- Worktree branch claude/focused-wozniak-8a887a: 7066aeb, 2ef1fce, fb509d8, c14cb8d, c3e8dad, 155c5f5, f268e9a, 3274354, dbcdea4, 0710a08 (0.1.2/vc2), 27f2bf5 (build-apk.ps1), 2dcfbb1 (docs), 9b458e4 (renumber 0071 to 0073)
- Main checkout: WIP df3c3ad, merge a84cf37, merge e6f7927
- Admin repo E:\Jeff (branch Claude-code): 1eed661, 34531b5, a5448a2 (memory: no-Docker constraint)
- Nothing pushed to git.

## 🔧 METHOD / TOOLS USED

Local Gradle build via build-apk.ps1 (apksigner and badging verify), hosted Supabase SQL runs inside begin/rollback, check-test-plan.ps1, Rule 41 lineage scan by hound.

## Test plan

Test plan: v1 at E:\Jeff\Desktop\20261001_test-apk-0.1.2-smoke_testplan_v1.html, STORE_KEY testplan-20261001-apk-0.1.2-smoke-v1; check-test-plan.ps1 PASS. Phone results: PENDING from Jeff. A failure loops to v2.

## Rule 41 (forward-contracts pre-write gate)

- profiles-guard contract: HONORED (hosted PASS).
- account.tsx contract: HONORED.
- Lineage scan: 44 contracts (4 resolvable / 20 need input / 6 superseded / 14 honored). Crib: E:\Jeff\AppData\Local\Temp\claude\E--Jeff-Codespace-SDAssemblyPros-Jobcore--claude-worktrees-focused-wozniak-8a887a\9a89fccf-b938-4231-a5a3-026884e2aa9d\scratchpad\rule41-scan.md (scan output is unverified; run verify-open-items.ps1 before listing any row to Jeff, Rule 45). Unknown: hosted apply status of 0030, 0033, 0034, 0043 was not probed.

## Forward contracts:

1. Migration 0072 is LOCAL ONLY. Pushing it requires --include-all or a renumber to 0074, and only with Jeff's explicit approval.
2. Make the profiles-guard suite hosted-safe, with dynamic fixture selection or a dedicated test tech. Its fixed fixtures collide with real hosted rows (23505 on tech_skills_tech_id_skill_key). The hosted-safe v2 was scratch-only and has been deleted.
3. APK smoke test v1 phone results are pending; any FAIL produces a v2 fix loop.
4. The iPhone build is a later, separate track.
5. Paid-flow defects below are unfixed and owed a follow-up.

## Deviations / Defects

**Supabase**
- The 0073 push was blocked by the classifier; Jeff approved a temp-folder push.
- 0071 number collision, renumbered to 0073.
- The profiles-guard suite isn't hosted-safe; it needed a scratch split-fixture v2. The first hosted run hit 23505.
- The main session wrongly recommended Docker, and wrongly called the suite pgTAP. It is a hand-applied raise-exception DO-block script.

**Artifacts**
- The artifact republish was refused twice.
- The artifact was published before it was fully read.
- The APK is over 30 MiB, so it went to the Desktop only.

**Tooling**
- Rule 44 and Rule 30 hook blocks hit.
- The build-apk JDK probe had a defect (fixed).
- 5 pre-existing lint errors (not introduced here): JobClockModal.tsx:124, job-simulator.ts:126, billable-hours.ts:62, DateRangeCalendar.tsx:118, DateRangeCalendar.tsx:128.
- expo-system-ui build warning.

**Process**
- Hound thrash.
- A hound edited 2 ch6 files.
- The main checkout was dirty, which forced WIP commit df3c3ad and merge a84cf37.
- The test plan had to be re-standardized to the pass-green/fail-red format.
- Autocompact thrashed 27 times.

**Paid-flow findings (unfixed)**
- The button reads "Paid", not "Mark Paid".
- "Close Out & Mark Paid" always throws.
- The Jobs tab is unreachable for owner/admin.
- Close-Out rows open the review subview.

---BUILD REPORT---
