---
classification: plans/jobcore-p8-handoff-token-expiry-enforcement
comments: "Re-declared Forward contract — server-side handoff-token expiry enforcement, originally from P5, silently dropped through P6/P7"
origin: .claude/plans/jobcore-p8-handoff-token-expiry-enforcement.md
tags: [plans, jobcore]
---

# Jobcore P8 — Server-side handoff-token expiry enforcement

## Status
OPEN — re-declared 2026-08-10 via `/ledger-audit jobcore` (Themis, task_id
`themis-ledger-jobcore-20260810-v1backtest`), which flagged this item STALE-UNACKNOWLEDGED
(phases_since: 2) after zero mentions in the P6 or P7 closeout reports.

## Origin
First recorded as Forward contract #2 (and mirrored as Deviation #3) in
`.claude\build-reports\jobcore-p5-payment-review\2026-08-09_payment-review-module.md`
(Karen S9 caveat, AC 6): `expires_at` is enforced in the SQL schema only — no running
server-side validator exists yet to reject expired handoff tokens at request time.

## Scope for this slice (future session)
Build the server-side enforcement path: reject any handoff-token use where `expires_at`
has passed, at the point tokens are consumed/validated (not just relying on the SQL
column existing). Add a VERIFY case exercising an expired token against a temp-copy
fixture (Rule 11).

## Reconciliation note
Jeff's disposition (2026-08-10, in response to Themis's V1 backtest findings): re-declare
rather than re-defer-silently or close. This file is the re-declaration; a future
build report closing this item should reference this plan by path.
