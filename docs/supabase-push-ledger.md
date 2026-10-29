---
classification: sdassemblypros/jobcore
comments: "JobCore Supabase push ledger"
origin: Codespace/SDAssemblyPros/Jobcore/docs/supabase-push-ledger.md
tags: [sdassemblypros, jobcore]
---
# JobCore Supabase push ledger

Live project: `vogkxkcceahtwyovpxsg`. Seeded 2026-10-24 from `npx supabase migration list` (run from `app`) and the JobCore memory notes; nothing here is invented.

## Purpose and rules

- Every mention, plan or discussion of a migration, push or live push gets a row in this ledger.
- A row goes in **Future** when the migration is planned, written or pending. It MOVES to **Past** when pushed (or attempted).
- Consult this ledger before planning any migration work.
- Never push without Jeff's explicit per-push approval that names the migration numbers.
- A plain `db push` applies ALL pending migrations, so list the pending ones first (`npx supabase migration list`, then `db push --dry-run`).

Past pushes: OK 11 · FAILED 1 · PARTIAL 0 · UNKNOWN 2

## Future (planned / pending push)

| Migration | Purpose | Status & who must approve | Added |
|-----------|---------|---------------------------|-------|
| 0115_time_segments_use_event_time.sql | Job time segments start/close at the phone-time en_route_at / in_progress_at (clamped: null, future, or >7 days old falls back to now()); restores 0059 null-tech guard in open_time_segment; close helpers never write ended_at < started_at. No new column; no client change needed. Test: app/supabase/tests/0115_time_segments_use_event_time.hosted.test.sql | Written, NOT applied. Needs Jeff's explicit per-push approval naming 0115. | 2026-10-29 |

## Past (pushes and attempts)

| Date | Migrations | Result | Pushed by / session | Notes or error |
|------|------------|--------|---------------------|----------------|
| 2026-10-25 | (data fix, no migration) jobs row, Job #11 | OK | This JobCore session, authorized by Jeff in chat | Job #11 status in_progress -> paid via a single guarded UPDATE (where job_number=11 and status='in_progress'). No trigger touched. Reason: payments were fully settled ($199.00 = work total) but the job never reached completed, so the app never moved it to paid; the progress-bar Paid step needed status 'paid'. |
| 2026-10-25 | (data fix, no migration) payments row 49ff810c-2bcf-4e06-8708-196c3faa1ac1, Job #11 | OK | This JobCore session, on Jeff's explicit go ('Edit the Job #11 payment row's amount down to the balance'; trigger disable approved separately) | Duplicate cash payment (two $199.00 rows 4 seconds apart vs a $199.00 work total). One guarded UPDATE via `supabase db query --linked` set amount 199.00 to 0.00 (where id, amount, status, job_id matched). Needed `ALTER TABLE payments DISABLE TRIGGER payments_tech_confirm_whitelist_trg` for the update because the CLI role is not is_org_admin(); trigger re-enabled in the same batch, post-check tgenabled='O'. Post-check: settled total 199.00 = work total, balance 0.00. Row kept (not deleted). |
| 2026-10-24 | 0114_sync_time_segments_recomplete.sql | OK | This JobCore session, on Jeff's explicit go ('push 114') | `supabase db push` applied only 0114 (pre-checked: `migration list --linked` showed only Local 0114 pending); output 'Applying migration 0114... Finished supabase db push.'; migration list afterwards shows local=0114 remote=0114. |
| 2026-10-24 | 0113_open_time_segment_closes_prior.sql | OK | This JobCore session, on Jeff's explicit go ('Push 0113') | `supabase db push` applied only 0113 (pre-checked: `migration list --linked` showed 0113 Local-only, Remote empty, nothing else pending); output 'Applying migration 0113_open_time_segment_closes_prior.sql... Finished supabase db push.'; migration list afterwards shows 0113 in Local and Remote. |
| 2026-10-24 | 0112_tech_cash_payment_insert.sql | OK | This JobCore session, on Jeff's explicit go ('push it') | `supabase db push` applied only 0112 (pre-checked: it was the only Local-only migration); output 'Applying migration 0112... Finished supabase db push'; migration list afterwards shows 0112 in Local and Remote. Policy behavior (tech cash insert) not yet tested live. |
| 2026-10-23 | 0100, 0101, 0102 | UNKNOWN | Another session (not the one that wrote 0100) | Found applied on Remote (Local+Remote in migration list). Push time and output were not observed; table existence not independently verified. 0100_company_info rode along on a `db push` per playbook. |
| 2026-10-23 | 0099 | OK | Main session, `supabase db push` | job-photos storage UPDATE policy; in Local and Remote; not checked in pg_policies. |
| 2026-10-22 | 0098 | OK | Session not recorded | materials_onsite backfill; post-check 10 arrived=true, 0 not onsite. |
| 2026-10-22 | 0094, 0095, 0096 | OK | Session not recorded (0095 from the parallel Job Archive and Flags session, pushed in same run) | Verified in Local and Remote. |
| 2026-10-17 | 0090, 0091, 0092 | OK | Main session, `supabase db push` | Verified in migration list 2026-10-17. |
| 2026-10-13 | 0088 | OK | Main session, on Jeff's explicit order | withdraw_timesheet replacement. |
| 2026-10-12 | 0078, 0079, 0086 | OK | Session not recorded | Live per memory notes. |
| 2026-10-06 | 0077 | OK | Session not recorded | Live per memory notes. |
| 2026-09-19 | 0062, 0063, 0064 | OK | Main session, plain `npx supabase db push` | EXIT=0 after the failed attempts below; confirmed in migration list. |
| 2026-09-19 (before the OK push) | 0062-0064 (attempts) | FAILED | Main session and Workflow subagent attempts | Count of failed attempts unknown (notes say three W3 attempts). Errors: 28P01 password auth failure, SASL auth failure on migration list / dry-run (stale credential, Jeff re-authenticated), and a "[Production Deploy]" classifier block when the push ran inside a Workflow. |
| before 2026-09-19 / undated | 0001-0061, 0065-0076, 0080-0085, 0087, 0089, 0093, 0097, 0103-0111 | UNKNOWN | Not recorded | Applied (Local+Remote in migration list 2026-10-24) but no known push date or result. Memory notes mention some earlier dated applies (0032 by 2026-09-01, 0035 by 2026-08-27) without push detail. 0087 is live but its file was noted untracked locally on 2026-10-13. |
