---BUILD REPORT---
Project: jobcore / overpayment-smartfill
Date: 2026-10-25
Tier: A
Title: Overpayment prevention on Job > Payments (smart-fill, cap on all methods, Paid state)
Branch/repo: E:\Jeff\Codespace\SDAssemblyPros\Jobcore, jobcore-role-landing-0.1.3
Test plan: declined by Jeff
Forward contracts: none

## Goal
Request: Job #11 overpaid $199.00 by cash; Confirm Paid stayed gray. Jeff voted: no refund feature (loophole risk); smart-fill the amount with a visible Adjust price override.

## Changed files
| File | Change |
|---|---|
| `app/apps/mobile/src/components/JobPaymentRegion.tsx` | Smart-fill amount from balance on load; cap on every method incl. cash, with message pointing to Adjust price; green "✓ Paid" box when balance<=0 and settled>0; Adjust price PayrollButton adds an 'other' line item via estimates.addLineItem; job moves to paid when balance hits 0 on a completed job |
| `app/modules/admin-finance/src/flows/record-job-payment.ts` | Balance cap now applies to cash |
| `app/modules/admin-finance/src/flows/__assertions__/record-job-payment.assert.ts` | 5 cases |
| `docs/supabase-push-ledger.md` | 2 data-fix rows |

## Live data fixes (authorized by Jeff in chat, no migration)
1. Payment 49ff810c amount 199.00 -> 0.00, with trigger payments_tech_confirm_whitelist_trg disabled then re-enabled in the same batch (tgenabled='O' verified); settled total 199.00 = work total.
2. Job #11 status in_progress -> paid via guarded UPDATE so the progress-bar Paid step turns green (that step reads job.status==='paid'; app only moves completed->paid).

## Verification
- tsc build and mobile type-check clean.
- npm test: 583 pass / 0 fail.
- Browser on localhost:8081 showed green "✓ Paid" box, balance $0.00, and green progress-bar Paid step on Job #11.
- DB re-read confirmed rows 0.00/199.00/0.00 and status paid.

## Deviations / Defects
- Nestor did not re-read its own edits to the component/flow/assert files; the main session verified them by Grep and tests afterward.
- Hard-coded #fff label colour on the Paid box (JobPaymentRegion.tsx ~line 297-303), not theme-tokenized.
- One-time trigger disable on live payments table for the Job #11 fix (explicitly authorized by Jeff).
- Rule 43 test plan declined by Jeff.
- A job fully paid while still in_progress is not auto-moved to paid (code only does so from completed); Job #11 fixed by data write. Jeff chose not to change code.
- v0.4.0 generated UI-inventory/storyboard snapshots are stale (Total Paid / Confirm Paid wording); regen replaces them, nothing hand-edited.

## Deferred
none
