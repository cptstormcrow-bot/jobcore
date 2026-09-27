---
classification: build-reports/jobcore
comments: "Follow-ups to the Job #9 save fix: null-safe tech trigger, atomic save_job_customer RPC, await save on leave"
origin: .claude/build-reports/jobcore/2026-09-26_jobcore-save-followups-rpc-trigger-awaitsave.md
tags: [build-report, jobcore, tier-a]
---
---BUILD REPORT---
GOAL: Close out follow-ups from the Job #9 save fix (2026-09-25_job-detail-save-customer-edits-fix.md):
make the tech-update trigger null-safe, replace the two-step client create+link with a single
atomic server-side RPC, and await the save when the user navigates away instead of firing-and-forgetting.

RoA: jobcore / BUILD
Plan: E:\Jeff\.claude\plans\job-detail-save-follow-ups-null-safe-tech-trigger-atomic.md | Date: 2026-09-26 | Status: COMPLETE
Why: FC2 (null-safe tech trigger), FC5 (transactional create+link RPC — the root fix for the FC4
orphan-customer risk), and FC7 (await save before navigation) were all open forward contracts from
the prior report; this build closes them.
Report: E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.claude\build-reports\jobcore\2026-09-26_jobcore-save-followups-rpc-trigger-awaitsave.md
Commits: 9ba4e40 (fix(jobcore): 0068 null-safe tech update whitelist), efe148c (feat(jobcore): atomic
save_job_customer RPC + await save on leave). Branch jobcore-job-detail-action-buttons (push pending,
last step of this closeout).

🔧 METHOD / TOOLS USED
- Migration authoring + `'y' | npx supabase db push` for live application.
- `npx tsc -b` for typecheck verification.
- Direct `pg_proc` read for live-function confirmation (prosecdef, arg counts).
- Read-only orphan-customer query against the live database (no writes).

✅ COMPLETED
| File / Target | Change | Action |
|---|---|---|
| supabase/migrations/0068_jobs_tech_whitelist_null_safe.sql | `jobs_tech_update_whitelist()` compares whitelisted columns via `is not distinct from` (x14) instead of `=`, so a column changing to/from NULL no longer breaks the comparison; admin early-return, `search_path ''`, and invoker semantics unchanged | added, applied LIVE |
| supabase/migrations/0069_save_job_customer_rpc.sql | New `public.save_job_customer(p_job_id uuid, p_customer jsonb) returns jsonb`, `plpgsql`, `security invoker`, `search_path ''`; null org raises `42501`; locks the job row `FOR UPDATE`, job not found raises `P0002`; inserts and links a new customer when the job has none, otherwise updates the existing customer via `case when p_customer ? 'key'` per-field gates; no grants added | added, applied LIVE |
| app/modules/admin-finance/src/data/ports.ts | Added `saveForJob(jobId, patch)` to the port interface | edited |
| app/apps/mobile/src/lib/admin-finance-repos.ts | Implemented `saveForJob` via `supabase.rpc('save_job_customer', ...)` | edited |
| app/apps/mobile/app/job/[jobId].tsx | `runSaveEdit` now returns `Promise<boolean>` and calls `saveForJob` then `updateDetails`; `saveInFlightRef` dedupes concurrent save triggers; `beforeRemove` awaits any in-flight save via `leavePendingRef` and only dispatches the pending navigation on success, setting `leaveAfterFailRef` on failure | edited |

⚠️ DEFERRED
| Item | Reason | Disposition | Saved to (path + anchor) |
|---|---|---|---|
| Orphan-customer cleanup (7 found: H query) | Destructive; needs Jeff's explicit go and a check of other FK tables first | Backlog | this report, Forward contracts |
| `customer.saveForJob` replay handler | Offline replay is not yet wired | Backlog | this report, Forward contracts |
| Chip task_4afe6e43 (deliver-plan.ps1 goal-slug bypass) | Pre-existing, unrelated to this change | Carried | prior reports |
| Chip task_f9aac49a (brs-scanner hardcoded to admin root) | Pre-existing, unrelated to this change | Carried | prior reports |
| FC1 (C2 org-consistency constraint), FC3 (M1 customerAddress input), FC6 (patchLifecycle idiom alignment) | Each needs Jeff's go or a design call | Carried | prior report Forward contracts |

🧪 VERIFY
- [x] `npx tsc -b` — EXIT=0.
- [x] Grep counts in `[jobId].tsx`: `leaveAfterFailRef`=4, `needsLink`=0, `saveForJob`=1, `leavePendingRef`=4, `navigation.dispatch`=1.
- [x] Live `pg_proc` check: `jobs_tech_update_whitelist` — 14 `is not distinct from` occurrences, `prosecdef=false`; `save_job_customer` exists, `prosecdef=false`.
- [x] `'y' | npx supabase db push` — EXIT=0.
- [x] Read-only orphan-customer query (H): ORPHANS=7 (count via Select-String of `"id":` matches). Visible candidates: Lion's Share `79797e33-2a78-4fd1-b51e-9b813e25f17a` (2026-09-15); Ragnar Lobrock `c03ec53b-b424-4e18-8267-980b97dc1d98` (2026-09-25); Ragnar Lobrock `dc156967-d569-4eeb-8f82-8292bc9b7de3` (2026-09-25); Ragnar Lohbrok `18a5ef97-92a5-42de-9407-f90183126f1e` (2026-09-25). 3 older orphans not detailed. No deletion performed.
- [x] Docs sweep (F): 0 docs required updates.
- [ ] Test plan — skipped by Jeff 2026-09-26.

Forward contracts:
- Honored: FC2 (null-safe tech trigger, migration 0068), FC4 (orphan-customer visibility via read-only H query — cleanup itself still open, see below), FC5 (atomic `save_job_customer` RPC, migration 0069), FC7 (await save before navigation, `beforeRemove`).
- Closed: FC8 (test plan) — skipped by Jeff 2026-09-26, closed as waived rather than pending.
- Carried: FC1 (C2 org-consistency constraint), FC3 (M1 `customerAddress` input), FC6 (`patchLifecycle` `'key' in patch` idiom alignment).
- Open: chip `task_4afe6e43` (deliver-plan.ps1 goal-slug bypass); chip `task_f9aac49a` (brs-scanner hardcoded to admin build-report root).
- New: `customer.saveForJob` mutation needs a replay handler once offline replay is wired; orphan-customer cleanup pending Jeff's explicit go (check other FK tables first before any delete).
- Rule 41 (prior lineage contracts evaluated before writing this report): carried #1 (authenticated Sales & Marketing visual check), #3 (five unfinished-bucket files uncommitted), #10 (price-sheet migration 0032 schema catch-up); re-deferred #4, #6, #7, #8, #9, #11 (each needs Jeff's design call or sign-in, unrelated to this change).
Test plan: skipped by Jeff 2026-09-26.

## Deviations / Defects
1. The Rule 18 Workflow-preflight narration for this session's recon posted late (after the first
   Workflow dispatch rather than before it).
2. Recon for this closeout used Workflow-tool dispatches (6 Explore + 5 Plan runs) instead of the
   preferred ≤3 Agent-tool dispatches (Rule 33 sizing guardrail).
3. Recon line-number citations drifted slightly between the first and later Workflow passes as the
   file was edited mid-session.
4. The first attempt to extract the RPC's JSON return shape used the wrong JSON path and had to be
   corrected.
5. Migration 0069 uses `security invoker` (not `security definer`) — this is an intentional design
   choice, not a defect, but is called out because it differs from some other JobCore RPCs.
6. Phase 2 of the plan's own recon contradicted four premises stated in Phase 1: `enqueueMutation`
   turned out to be file-local (not exported), `Job` was not exported from the module assumed,
   migration 0039 carries no grants, and an initially assumed RPC signature was invalid.
7. A dedicated `leavePendingRef` was added beyond the plan's original design to correctly gate
   navigation dispatch on save outcome.
8. An early Grep sweep using a brace-glob pattern produced a false negative for occurrences that a
   later plain-string Select-String sweep caught.
9. The console log tag for the new save path reads `saveForJobCustomer` rather than `saveForJob`
   (cosmetic naming mismatch versus the port method name; not functionally significant).
10. The first `npx supabase db push` attempt used an invalid `--yes` flag (EXIT=1); retried
    successfully by piping `y` into the interactive prompt.
11. The Bash tool's commit-composing step lost its result to an internal tool error; the commit
    was confirmed to have actually landed via a follow-up `git log` read rather than the tool's own
    return.

Test plan: skipped by Jeff 2026-09-26.
