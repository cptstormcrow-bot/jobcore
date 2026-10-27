---BUILD REPORT---
Project: jobcore
Date: 2026-10-26
Tier: A
Plan: Open Item 6 — sales vs core-matrix mismatch. Jeff decision 2026-10-26 (AskUserQuestion): "Widen core to sales" — add 'sales' to EstimateEditorRole with the same moves as admin; no SQL, no push.
Branch: jobcore-role-landing-0.1.3
Test plan: none (no visible surface; the test-plan SOP covers only what Jeff can see on screen)
Forward contracts: none

## Summary
Migration 0093 (`app/supabase/migrations/0093_job_estimates_status_role_gate.sql`, function re-created in 0102) lets admin and sales move an estimate between all three statuses and limits a tech to draft<->submitted; hosted test AC-93.6 asserts sales may approve. The core matrix in `app/packages/core/src/estimateStatus.ts` typed only `'admin' | 'tech'`. The core type and matrix now carry `'sales'`, routed to the same move table as admin, so the package mirrors the live DB gate. The DB is unchanged.

## Changed files
| File | Change |
|---|---|
| `app/packages/core/src/estimateStatus.ts` | line 3 header comment names admin and sales; line 7 `EstimateEditorRole = 'admin' \| 'sales' \| 'tech'`; line 24 `role === 'tech' ? TECH : ADMIN` |
| `app/packages/core/src/__assertions__/estimateStatus.assert.ts` | lines 15-19 add the `sales` EXPECT block (same moves as admin); line 24 loop over `['admin', 'sales', 'tech']` |
| `.claude/build-reports/jobcore/estimate-role-matrix-sales/2026-10-26_core-matrix-sales-role.md` | this report |

Not changed: `app/modules/admin-finance/src/screens/JobEstimateScreen.tsx:957` still calls `allowedEstimateMoves('admin', …)`; it is the only app caller and is additive-safe. No sales-module caller exists. `app/packages/core/src/index.ts:275` re-exports the widened type unchanged.

## Verification (Rule 29-B)
Run from `app/` on 2026-10-26, output in the session scratchpad (`item6-tsc.txt`, `item6-test.txt`):
- `npx tsc -b --force packages/core packages/ui packages/module-sdk modules/admin-finance modules/field-tech modules/sales-marketing` → exit 0
- `npm test` → exit 0; summary lines `# tests 583` / `# pass 583` / `# fail 0`
- Docs sweep (Rule 31): `Grep` of `*.md` in the Jobcore repo for `EstimateEditorRole|allowedEstimateMoves|estimateStatus\.ts` hit only two prior build reports (`2026-10-11_drawer-sand-screen-numbers-estimate-status.md:15,34` historical narrative; `2026-10-20_prem-closeout-time-off-retire-0093.md:94` the open item itself, closed by this report). No user-facing doc names the role union.

## Deviations / Defects
- Rule 43 test-plan ask was not put to Jeff as a question; the report states the no-visible-surface reason instead. Jeff declined a test plan for every prior closeout in this series.
- Otherwise none.

## Deferred
none

## Closes
Open Item 6 (checkpoint `2026-10-20_204136_checkpoint.md` line 43; prem-closeout report line 94 item (ii)).
---END BUILD REPORT---
