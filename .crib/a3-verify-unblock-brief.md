---
# A3-Verify Unblock Brief — handoff to sister session "Verify Supabase Ongoing"

## Mission
Unblock and complete slice A3-verify from the governing plan
`E:\Jeff\.claude\plans\jobcore-workstream-a-closure-then-workstream-b-android.md`:
run all 8 hosted RLS test suites against the live `jobcore-dev` Supabase instance
(project ref `vogkxkcceahtwyovpxsg`), each wrapped `begin; ... rollback;`, and report
pass/fail with evidence. This session is a sister/parallel session to the main JobCore
build thread — the main thread is proceeding with slice A4 independently and will
return to consume this session's result after A4 closes.

## Current blocker (from Karen/verify-hound's BLOCKED run)
Karen searched the repo and environment and found NO usable DB credentials or CLI access:
- Checked `app\.env.example`, `apps\mobile\.env`, `app\supabase\README.md`, `package.json`
  — no DB connection string, no service-role key.
- Checked for `supabase/config.toml` and any CLI wrapper scripts — none found (no CLI link
  established).
- Checked `psql` and `supabase` on PATH — neither binary is installed in this environment.

Per standing instruction (CLAUDE.md Rule 9 — model-advisor pause / no-invent-credentials),
Karen correctly stopped rather than guessing or prompting inline for secrets. **Do not
invent, guess, or synthesize any credential.** Ask Jeff directly.

## What's needed from Jeff to unblock (ask him directly, in Plan Mode, before doing anything else)
Present these as options, not a demand:
1. A direct Postgres connection string for `vogkxkcceahtwyovpxsg` (host/port/db/user/password
   or a full `postgresql://` URI), OR
2. A Supabase CLI access token, so this session can run `supabase link --project-ref vogkxkcceahtwyovpxsg`
   and then `supabase db execute` / `psql` through the CLI's connection.
3. Either way, confirm whether Jeff wants `psql` and/or the `supabase` CLI installed into
   this dev environment (neither is currently present), and via what channel (winget/npm/direct
   download) — do not install silently.

## The 8 hosted RLS suites to run once unblocked
All live in `app\supabase\tests\` (Jobcore repo root: `E:\Jeff\Codespace\SDAssemblyPros\Jobcore`).
Each has a `*.hosted.test.sql` (real `auth.users` seed UUIDs, run this against the live instance)
and a non-hosted `.test.sql` twin (placeholder UUIDs, local/offline use only — do not run against
hosted for this verify pass):
- 0001_*.hosted.test.sql
- 0003_invitations_rls.hosted.test.sql
- 0004_*.hosted.test.sql
- 0005_*.hosted.test.sql
- 0007_field_tech_tables_rls.hosted.test.sql
- 0008_*.hosted.test.sql
- 0010_payment_review_rls.hosted.test.sql
- 0012_*.hosted.test.sql

Run convention: each file is self-contained `begin; ... rollback;` — safe to run sequentially
against the live DB with no lasting side effects. A suite fails if any `raise exception` fires;
otherwise it passes. Capture stdout per suite as the evidence artifact.

## Working method for this session
- Start in Plan Mode (already requested by Jeff when this session was created).
- Once Jeff supplies credentials/tooling decisions, delegate the actual suite-by-suite run
  to Karen (verify-hound) as the main JobCore thread has been doing throughout Workstream A —
  do not run raw DB commands from the main session turn; route through a hound per Rule 30.
  Use Agent Teams / hounds generally to keep this session's own context light, same as the
  parent thread.
- On completion (all 8 suites run, pass/fail known), write a short result summary to
  `E:\Jeff\Codespace\SDAssemblyPros\Jobcore\.crib\a3-verify-result.md` (route the write through
  Nestor/scribe-hound) and use the `mcp__ccd_session_mgmt__send_message` tool to notify the main
  JobCore session (search for it via `list_sessions` if the session id isn't already known —
  it's the session working the governing plan at
  `E:\Jeff\.claude\plans\jobcore-workstream-a-closure-then-workstream-b-android.md`) that A3-verify
  is closed and where the result file lives.

## Do NOT do in this session
- Do not touch migration 0013 / slice A4 (jobs RLS narrowing) — that's the main thread's job,
  running concurrently.
- Do not modify any `.hosted.test.sql` / `.test.sql` files — they're already authored and
  disk-verified; this session only *runs* them.
</content>
