---
classification: plans/cryptic-snacking-gosling
comments: "Plan — A3-verify: Install Supabase CLI, run 8 hosted RLS..."
origin: .claude/plans/cryptic-snacking-gosling.md
tags: [plans, cryptic-snacking-gosling]
---
# Plan — A3-verify: Install Supabase CLI, run 8 hosted RLS suites

## Context

This session is the dedicated A3-verify unblock thread for JobCore's Workstream A closure
(governing plan: `E:\Jeff\.claude\plans\jobcore-workstream-a-closure-then-workstream-b-android.md`).
The main JobCore session is concurrently landing migration `0013_jobs_select_narrowing.sql`
(slice A4) and needs this session's hosted RLS pass/fail result once A4 closes. A3-verify has
been blocked since the prior checkpoint (`2026-08-11_140933_checkpoint.md`) on two prerequisites:
CLI tooling and hosted DB credentials. Both prerequisites are now resolved to a concrete method
(npm devDependency install; `supabase login` browser handshake) — this plan executes that method
and runs the 8 hosted RLS suites, wrapped `begin;...rollback;`, against the live `jobcore-dev`
Supabase project (`vogkxkcceahtwyovpxsg`).

This turn confirmed by direct disk read (not assumed): `supabase` is **not yet** present in
`Jobcore\app\apps\mobile\package.json` devDependencies (only `eas-cli` is) — so the npm install
has not happened. The A3a-f suite-split crib file (`Jobcore\.crib\a3a-f-suite-split.md`) has been
read in full and resolves the exact suite-to-migration mapping, fixture convention, and seed UUIDs
needed for the hosted run.

**Correction from this turn's disk check (glob of `Jobcore\app\supabase\tests\`):** only
`0001_foundation_rls.hosted.test.sql` and `0004_scheduling_rls.hosted.test.sql` exist on disk
(each with a local-seed `.test.sql` twin). The 6 suites for the 3a-3f split — 0003, 0005, 0007,
0008, 0010, 0012 — do **not** exist yet. An earlier draft of this plan (and the prior checkpoint)
assumed all 8 were "already authored and disk-verified"; that premise is false and is corrected
below. Authoring the 6 missing hosted suites is now an in-scope step, ordered before Karen's run.

**Second correction, same turn:** a fresh read of `Jobcore\app\apps\mobile\package.json` shows
`"supabase": "^1.226.4"` already present in `devDependencies` (line 40, alongside `eas-cli` at
line 39). This contradicts both the checkpoint's claim ("npm install... has not happened") and
this plan's own paragraph above ("supabase is not yet present") — both are now stale. The
`package.json` entry exists; whether `npm install` was actually run to materialize
`node_modules\.bin\supabase` is unconfirmed (a manifest entry isn't proof of a completed install).
Step 1 below is corrected from "add the devDependency" to "confirm the install is functional."

## Steps

1. **Confirm the `supabase` CLI install is functional** — delegate to Karen (verify-hound).
   `package.json` already lists `"supabase": "^1.226.4"` in `devDependencies`
   (`Jobcore\app\apps\mobile\package.json:40`), but that manifest entry doesn't prove
   `npm install` actually ran. Karen runs `npx supabase --version` from
   `Jobcore\app\apps\mobile\` and returns only the resolved version string (or the failure, if
   `node_modules\.bin\supabase` isn't materialized — in which case Karen also runs `npm install`
   to complete it, since adding an already-declared devDependency's binary is not a source edit).

2. **Handoff to Jeff (manual, outside this session's control):** once step 1 confirms the CLI
   works, Jeff runs `npx supabase login` himself from `Jobcore\app\apps\mobile\` in a plain
   terminal. This opens his browser for an OAuth-style approval and stores the access token in a
   local config file under his Windows profile — no token is pasted into this session or any file
   this session writes. **This session pauses here and does not proceed to step 3 until Jeff
   confirms the login is done.**

3. **Author the 6 missing hosted RLS suites** (+ local-seed twins), once login is confirmed.
   Disk-verified as absent this turn (glob of `Jobcore\app\supabase\tests\`): 0003, 0005, 0007,
   0008, 0010, 0012. Dispatch one Nestor (scribe-hound) per suite, in parallel, each authoring
   both the `.hosted.test.sql` file and its local-seed `.test.sql` twin from the exact spec in
   `Jobcore\.crib\a3a-f-suite-split.md` (per-suite table/policy list, ACs, and the fixture/wrapper
   convention documented there — header line, `begin;...rollback;` wrap, `do $$...end $$;` blocks,
   `reset role`-first fixture planting, positive+negative+cross-org probes, hosted seed UUIDs).
   Each Nestor dispatch is one file = one closed-form spec (Rule 33); the two suites sharing a
   cross-suite table (`commissions`: 0005+0008; `job_photos`: 0007+0012; `reviews`: 0010+0012)
   get an explicit no-duplicate-assertion note in their prompts per the crib's coordination flag.
   Each Nestor returns only the file path + line count, never the SQL body inline.

4. **Delegate the 8-suite hosted RLS run to Karen (verify-hound)**, once step 3's 6 new suites
   exist. Suites: 0001, 0004 (pre-existing) + 0003, 0005, 0007, 0008, 0010, 0012 (authored in step
   3). All 8 are wrapped `begin;...rollback;` — Karen only *runs* them, never edits them. Karen
   returns a compact per-suite pass/fail table (max 8 lines) + a crib pointer to the full
   transcript, never raw SQL output inline.

5. **Write `Jobcore\.crib\a3-verify-result.md`** via Nestor once all 8 suites report, recording
   the pass/fail table and noting explicitly that a SECOND full 8-suite re-run will be needed
   post-A4 (migration 0013 changes `jobs`-table RLS after this pass completes).

6. **Correct the stale line** at `Jobcore\jobcore-mobile-build-toolchain.md:47` — currently reads
   "RLS suites PASSED for `0001_foundation`/`0004_scheduling` only, `0005`/`0008`/`0012` suites
   not yet authored/run" — update to reflect the actual 8-suite result from step 4/5. Route
   through Nestor.

7. **Notify the main JobCore session** of completion via `mcp__ccd_session_mgmt__send_message`,
   including the post-A4 re-run note.

## Constraints (standing, do not violate)

- Do NOT touch migration `0013_jobs_select_narrowing.sql` / slice A4 — that is the main thread's
  concurrent work.
- Suites 0001 and 0004 are already authored and disk-verified — do NOT modify those two
  `.hosted.test.sql` / `.test.sql` files, only run them. The other 6 suites (0003, 0005, 0007,
  0008, 0010, 0012) do NOT exist yet and must be authored per step 3 before Karen can run them.
- Local-seed `.test.sql` twins are authored alongside their hosted counterparts (matches the
  0001/0004 pattern) but are not themselves part of A3-verify's gate — A3-verify's gate is the
  hosted run only (step 4). The local twins are a byproduct of step 3, not separately verified
  this session.
- No credential is ever invented, guessed, or entered into a field by this session (Rule 9). The
  `supabase login` browser handshake is the only credential-acquisition path used.

## Verification

- Step 1: Karen's returned `npx supabase --version` string confirms the CLI is functional.
- Step 3: each Nestor's returned file path + line count, cross-checked against a directory glob
  of `Jobcore\app\supabase\tests\` afterward to confirm all 6 hosted suites (+ 6 local twins) now
  exist on disk (Rule 29 same-turn disk check) before step 4 dispatches.
- Step 4: Karen's per-suite pass/fail table is the verification artifact for the RLS suites
  themselves — 8/8 PASS is the gate for closing A3-verify (pending the post-A4 re-run noted above).
- Step 6: re-read `jobcore-mobile-build-toolchain.md:47` after Nestor's edit to confirm the stale
  line no longer reads "not yet authored/run" (Rule 29 same-turn disk check).
