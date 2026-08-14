---
classification: plans/swirling-exploring-wombat
comments: "JobCore — Workstream A closure, then Workstream B Android build..."
origin: .claude/plans/swirling-exploring-wombat.md
tags: [plans, swirling-exploring-wombat]
---
# JobCore — Workstream A closure, then Workstream B Android build (Phases 1-7)

<!-- status: DRAFT -->

## Context

Resuming JobCore from checkpoint `E:\Jeff\.claude\checkpoints\2026-08-11_073218_checkpoint.md`, the sole ACTIVE row in the checkpoint ledger. The governing plan (`E:\Jeff\.claude\plans\jobcore-app-every-spicy-horizon.md`, status DRAFT) already specifies WHAT each of Workstream A's 11 slices and Workstream B's 12 phases should contain — this plan does not re-derive that content. It specifies the HOW: an execution schedule that satisfies the user's explicit process directive for this run — **Agent Teams, Rolling Context (Rule 38), Hounds, and Context offload (Rule 6 §context-offload)** — so the main session's context window never absorbs large SQL/code/README content directly.

**Commit scope (corrected by Jeff):** the *previous* session's uncommitted work (the `app\supabase\README.md` diff already on disk from the old checkpointed session) stays uncommitted here — that session closes itself out. Everything *this* session writes gets committed normally, per the standing "commit freely" permission (scoped pathspecs, logical-unit commits, never a blind whole-repo commit) — there is no blanket no-commit rule for this run.

Jeff has confirmed via the Supabase dashboard that migrations 0005-0012 are live on `jobcore-dev`, but no agent has independently re-verified that — it is the single load-bearing unverified fact this whole run builds on, so it becomes the first dispatch.

**Scope for this run** (Jeff's explicit choice via AskUserQuestion): Workstream A to full closure (all remaining slices 2-11), then Workstream B strictly through Phase 7 (first Android EAS build + device smoke test). Workstream B Phases 8-12 (Apple Developer Program decision and everything iOS-dependent) are parked — not started this run, consistent with the governing plan's own Rule 15 (R-A) note that Apple enrollment shouldn't block the ungated core.

## Standing constraints (apply to every step below)

- **Commits proceed normally for this session's own writes.** After each slice/wave lands and its verify hound (Karen) confirms it, commit that slice's files with a scoped pathspec and a message naming the slice — never a blind whole-repo commit, and never touch the pre-existing uncommitted `app\supabase\README.md` diff from the *old* session (that stays for the old session's own closeout, until Slice A2 supersedes it with this session's own edit — at which point the file's new state is this session's to commit).
- **Rolling-slice execution (Rule 38):** one hound per slice, each writes findings to a scratchpad crib, each returns exactly one status line to the main session, and a completed slice's context is evicted before the next dispatches.
- **Agent Teams (Rule 39):** single implicit team; concurrent writers capped at 3 (serialized on one WriteLeaseMutex). Read-only dispatches (Karen, Explore/Magellan) don't count against the cap and can run opportunistically alongside writers.
- **Context offload:** the main session never pulls migration SQL, generated Edge Function code, RLS test SQL, or README diffs directly into its own context. Hounds read/write those; they report back a one-line status plus a crib-file pointer.
- **Checkpoint at natural boundaries** (Rule 32): end of Workstream A, before the EAS build trigger, and after the EAS build completes — each a fresh recovery anchor given this is a long unattended run.

### Context-bloat guardrails (every large-output risk point, named explicitly)

The Context-offload bullet above is a general rule; this table makes it concrete against every specific step in this plan that could otherwise dump raw output into the main session. There is no per-slice discretion — every row below is a hound dispatch, never a main-session Bash call:

| Risk point | Containment |
|---|---|
| Karen's `npm run typecheck` (full monorepo) — A→B gate and Phase 5 | Karen runs it, returns one status line (`PASS` or `FAIL: N errors, crib: <path>`); full compiler output goes to crib only on FAIL, never pasted inline |
| Karen's `npm test` (18 `.assert.ts` files) — A→B gate and Phase 5 | Same pattern: summarized pass/fail counts + crib pointer on FAIL only |
| 8-suite hosted RLS re-run (A3-verify, A→B gate) | Karen returns a compact per-suite pass/fail table (max 8 lines) + crib pointer to the full psql/CLI transcript — never the raw SQL output |
| Phase 6 EAS build | See Phase 6 row — hound returns build URL/ID/terminal status only, never streamed or pasted logs (detail below) |
| A3-recon / A7-recon / A8/A9-recon (Magellan) | Already scoped "Crib only" per-slice; reinforced here as a standing rule, not per-dispatch discretion |
| A-cli's `npm install -D supabase` | Nestor discards the npm install-tree log, returns only the resolved version string from `npx supabase --version` |
| Any hound-internal WebSearch/WebFetch (e.g., CLI syntax lookups) | Hound reads on its own turn and writes the extracted fact to crib — search results never stream back to the main session |
| Phase 1 `eas whoami`/`eas init`, Phase 4 `eas secret:create` | Nestor runs each non-interactively, returns one line (auth status / assigned project ID / confirmed secret name) — full CLI output discarded, never pasted |
| The main session itself | Never runs Bash test/build/typecheck/deploy commands directly — every item above is delegated, full stop |

If any hound's return would exceed roughly one status line plus a crib pointer, that's a dispatch-design defect to fix before running it, not something to accept and absorb into the main session.

## Recommended approach — ordered slice list

### Workstream A — Supabase-current

| Slice | Hound | Action | Depends on | Concurrency |
|---|---|---|---|---|
| A1-verify | Karen (verify) | Read-only SQL check against live `jobcore-dev` (ref `vogkxkcceahtwyovpxsg`) confirming migrations 0005-0012 are actually applied (query migrations-tracking table / object existence). Evidence to crib. | — | Solo, blocking gate for all of A |
| A2 | Nestor (scribe) | Finalize `app\supabase\README.md`'s uncommitted draft against the plan's required migration-table/frontmatter format. Working-tree edit only. | A1-verify PASS | Parallel w/ A3a-c |
| A3-recon | Magellan (Explore) | Pull P4 S5.4 negative-access spec text for use in A3c. Crib only. | — | Read-only, run opportunistically early |
| A3a/A3b/A3c | Nestor ×3 | New hosted RLS test suites (`*.hosted.test.sql`) for migrations 0005 (money), 0008 (field-tech-jobs), 0012 (marketing)+S5.4, following the existing `app\supabase\tests\*.hosted.test.sql` pattern. | A1-verify PASS (3c also needs A3-recon) | Parallel wave of 3 (at cap) |
| A3d/A3e/A3f | Nestor ×3 | Remaining RLS suites per the plan's 3a-3f split. Collapse any pair that collides on one file into a single hound. | A1-verify PASS | Parallel wave of 3 |
| A3-verify | Karen | Run all 8 hosted RLS suites (2 existing + 6 new) against live instance via psql/Supabase CLI, `begin;...rollback;` wrapped. | A3a-f COMPLETE | Solo |
| A4 | Nestor | New migration `0013_jobs_select_narrowing.sql` (renumbered — 0007 collided with a committed P4 file). Confirm 0007 is taken before naming 0013. | A1-verify PASS | Parallel w/ A5, A6 |
| A5 | Nestor (escalate to Spot if large) | Author `price-sheet-current` Edge Function from scratch — code only, not deployed. | A1-verify PASS | Parallel w/ A4, A6 |
| A6 | Nestor | Author `handoff-resolve` Edge Function against `HandoffJobData`/`HandoffAction` in `web/handoff/src/types.ts` — code only, not deployed. `web/handoff` static hosting untouched. | A1-verify PASS | Parallel w/ A4, A5 |
| A-cli | Nestor | Add `supabase` as a workspace devDependency (`npm install -D supabase`, mirrors the existing `eas-cli` pattern already at `apps\mobile\package.json:39`) — a scoped package.json write, not a system-level install. Confirm with `npx supabase --version` (return only the resolved version string, not npm's install-tree log). Check whether `SUPABASE_ACCESS_TOKEN` is already set or Jeff has run `supabase login` before; if neither, note it — A5-deploy/A6-deploy will need one. | A1-verify PASS | Parallel w/ A4-A6 |
| A5-deploy / A6-deploy | **Confirm with Jeff first**, then Nestor | Deploy is now scriptable: `npx supabase functions deploy price-sheet-current --project-ref vogkxkcceahtwyovpxsg` and the same for `handoff-resolve`, non-interactive, **if** a `SUPABASE_ACCESS_TOKEN` or a prior `supabase login` session is available. If neither, fall back to the old manual dashboard paste. Either path pushes a live change to the `jobcore-dev` backend — surface it and get Jeff's explicit go-ahead before running it, don't silently execute. Record `DEPLOYED-CLI` or `PENDING-MANUAL` in the ledger accordingly. | A5/A6 COMPLETE, A-cli | — |
| A7-recon | Magellan | Locate exact anchors: `modules.ts` registration block, `[moduleId].tsx` host-injection block, `ReconciliationView.tsx` placeholder root, `buildTransitionCtx()` 4 TODO stubs. Crib only. | — | Read-only |
| A7b → A7a | Nestor, sequential | A7b: workspace/package.json wiring for payment-review module. A7a (after A7b): register module in `modules.ts`. | A7-recon | Sequential, each solo |
| A7c/A7d/A7e | Spot ×3 (patch-hound — these are the >=3-edit/anchored-patch case) | A7c: host-injection block in `[moduleId].tsx`. A7d: swap placeholder root for `ReconciliationView.tsx`. A7e: resolve 4 TODO stubs in `buildTransitionCtx()` (hardcoded role + 3 gating booleans + PayPal/Stripe stubs). Collapse A7d+A7e if they land in the same file. QR-code UI stays out of scope. | A7a/A7b COMPLETE | Parallel wave of 3 (at cap) |
| A7-smoke | Karen | `npm run typecheck` scoped to payment-review + `packages/core` — fail fast before triage slices. | A7c-e COMPLETE | Solo |
| A8/A9-recon | Magellan | One pass covering P7's 9 forward-contract items and P6's 6 deferred items — current on-disk status, proposed disposition each, note which P7 items are now unblocked given A1+A3 are COMPLETE. | A3-verify, A1-verify | Read-only |
| A8/A9/A10-write | Nestor | One anchored edit to the plan-file ledger recording: P7 9-item triage table, P6 6-item triage table (2 close under A, 2 hand to B, 2 flagged-blocked on Jeff's Meta test-app credentials — not waited on), P4 S5.4/S5.3 bookkeeping (S5.4→folded into 3c, S5.3→deferred to B), and A11 recorded as `PARKED`. Crash/error-reporting SDK recorded as `SIBLING CONCERN`. | A8/A9-recon | Solo (single-file writer) |
| A11 | — none — | Bonus-policy formula (`NullBonusRule`) stays untouched. Recorded `PARKED` by A10-write, no dispatch. | — | — |

**Gate: Workstream A → Workstream B** — Karen, single check_list dispatch, must be fully GREEN:
1. `npm run typecheck` (root, full monorepo)
2. `npm test` (root, Node `--experimental-strip-types --test`, all 18 `.assert.ts` files)
3. Full hosted RLS re-run: existing 2 suites + new 6 suites, re-run in full because A4's migration 0013 touches `jobs`-table RLS policy that A3-verify already passed *before* 0013 landed.

On FAIL: hard stop, yield to Jeff with the specific failing item — do not auto-continue. On PASS: write a checkpoint (see below), then proceed.

### Workstream B — Mobile build, Phases 1-7 only

| Phase | Hound | Action | Depends on |
|---|---|---|---|
| 1 | Nestor | `npx eas-cli whoami` (workspace-pinned, not global). If authenticated: `eas init`, replace `app.json`'s `REPLACE_WITH_EAS_PROJECT_ID`. If NOT authenticated: this needs interactive browser login a hound can't complete — return `BLOCKED-NEEDS-AUTH` and yield to Jeff. | A→B gate PASS |
| 2 | Karen (read-only) | Verify icon/adaptive-icon/splash presence; confirm missing `android.versionCode` is non-blocking for a first preview build. | — (parallel w/ 1) |
| 3 | Karen (read-only) | Verify `preview` eas.json profile is buildable; confirm `development` profile's dev-client gap is a known, not-fixed-this-run, flagged-forward item that doesn't block `preview`. | — (parallel w/ 1) |
| 4 | Nestor (Bash) | Push `.env`'s Supabase URL/anon key into EAS secrets via `eas secret:create`. `EXPO_PUBLIC_PRICEFEED_URL` depends on A5's Edge Function being deployed — if A5-deploy isn't confirmed complete, flag `PENDING-A5-DEPLOY` rather than pushing a secret pointing at a function that isn't live. | Phase 1 COMPLETE |
| 5 | Karen | Fresh `npm run typecheck` + `npm test` immediately pre-build (not a reuse of the A→B gate — Phase 1/4 touched config since then). FAIL = hard stop. | Phases 1-4 COMPLETE |
| — | checkpoint | Write a fresh checkpoint before Phase 6 — highest-risk step (consumes a metered EAS build credit). | Phase 5 PASS |
| 6 | **Confirm with Jeff first**, then Nestor | `eas build --platform android --profile preview` consumes build credit/quota of unknown size on Jeff's account — surface this and get explicit go-ahead before dispatching, do not auto-continue even though Rule 38's autonomy gate would normally allow it. Once confirmed: kick off non-interactively (`npm run build:preview --non-interactive`, or the equivalent flag so the hound never attaches to a live log stream), then poll terminal status via `eas build:list --limit 1 --json` / `eas build:view <id>` — never `--logs` while the build is in flight. Return exactly one line to the main session: build URL/ID + terminal status (`FINISHED`/`ERRORED`). On `ERRORED`, pull the full log with `eas build:view <id> --logs`, write it to a crib file, and return a one-line failure summary + crib pointer — the raw log is never pasted inline. | Phase 5 PASS + Jeff's go-ahead |
| — | checkpoint | Record the build URL/artifact link immediately after Phase 6 completes, before Phase 7 begins. | Phase 6 COMPLETE |
| 7 | Nestor writes checklist; Jeff executes hands-on; Karen records result | Sideloading an APK and walking each module (including payment-review) on a physical device is outside any hound's tool surface. Nestor derives a smoke-test checklist from the module list; Jeff sideloads and reports pass/fail in chat; Karen records the result as the closing ledger entry. | Phase 6 COMPLETE |

## Out of scope this run

- Slice 0 (pre-flight commit of the *old* session's pre-existing uncommitted diff) — parked, no dispatch; that session's own closeout picks it up.
- Slice 11 (bonus-policy formula) — parked, untouched.
- Workstream B Phases 8-12 (Apple Developer Program decision, iOS registration/build/smoke test, store-submission deferred items) — not started.
- Crash/error-reporting SDK (surfaced in P7 triage) — flagged as a sibling concern only.
- `web/handoff` static hosting, QR-code UI (payment-review) — out of scope per their originating slices.
- 2 of P6's 6 deferred items blocked on Jeff-supplied Meta test-app credentials — flagged forward, not waited on.
- Committing the *old* session's pre-existing uncommitted diff — that stays for the old session's own closeout, not this run.

## Open risks to surface to Jeff, not silently decide

1. A1-verify is the load-bearing fact everything else depends on — a FAIL there invalidates the whole downstream sequence.
2. A5/A6 Edge Function deploys ARE scriptable now (Supabase CLI added as a scoped devDependency, A-cli slice) — but the scripted path is gated on a `SUPABASE_ACCESS_TOKEN` or a prior `supabase login` session being available; without either, it falls back to the old manual dashboard paste. Either path pushes a live change to `jobcore-dev` — surface it and get Jeff's go-ahead before running it regardless of which path applies.
3. Phase 6's EAS build consumes unknown build-credit quota — confirm before triggering.
4. Phase 1's EAS login may require interactive browser auth a hound can't complete — hard yield point, not a retry loop.
5. Phase 4's `PRICEFEED_URL` secret depends on A5's deploy (CLI or manual, per the A5-deploy row) actually having happened — confirm before pushing it.
6. Phase 7 requires Jeff's hands on a physical Android device — no hound/computer-use substitute; plan says so plainly.

## Critical files

- `E:\Jeff\.claude\plans\jobcore-app-every-spicy-horizon.md` — governing plan, slice/phase content source of truth
- `E:\Jeff\.claude\checkpoints\2026-08-11_073218_checkpoint.md` — resume anchor for this run
- `E:\Jeff\.claude\checkpoints\INDEX.md` — checkpoint ledger, updated at each checkpoint write
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\README.md` — Slice A2 target
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\jobcore-mobile-build-toolchain.md` — stale "RLS suites PASSED" line to correct as part of A2/A3-verify closeout
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\app\supabase\tests\*.hosted.test.sql` — existing pattern for A3a-f
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\apps\mobile\app.json`, `apps\mobile\eas.json` — Workstream B Phases 1-3 targets
- `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\modules.ts`, `[moduleId].tsx`, `ReconciliationView.tsx` — Slice A7 targets

## Verification

- **Workstream A → B gate** (above): `npm run typecheck`, `npm test`, full 8-suite hosted RLS re-run — all must be GREEN before Phase 1 dispatches.
- **Phase 5 pre-build sanity gate**: fresh `npm run typecheck` + `npm test` immediately before the EAS build, since Phase 1/4 touch config after the A→B gate ran.
- **Phase 7 device smoke test**: Jeff's hands-on pass/fail report, walking every module including payment-review, recorded as the closing ledger entry for this run.
- Each slice/phase's hound returns a one-line PASS/FAIL + crib pointer; the main session tallies these into the plan-file ledger rather than re-deriving pass/fail itself.
