-- Jobcore — historical job-status backfill (job-lifecycle spine, calendar tie-in)
-- Apply after 0014. One-time data correction, not a repeated job — see
-- Workstream E "Historical backfill" in the job-lifecycle-spine plan.
--
-- Every pre-existing jobs row is stuck at status='new' regardless of what
-- actually happened, because the going-forward fix (0014 + transitionJob's
-- calendar-event side effect) only stops the drift from here forward. This
-- migration uses the same signal Workstream I-4 already documents —
-- closeOutJob() already writes a commissions row for a paid job, even though
-- jobs.status itself was never updated — to backfill history:
--
--   - jobs row with a matching non-voided commissions row, where that
--     commission's user/period is covered by a 'paid' payout_batches row
--     (joined via payout_lines on user_id + organization_id, with the
--     batch's period bounding the commission's created_at date) -> backfill
--     to 'paid'.
--   - jobs row with a matching non-voided commissions row but no such paid
--     batch coverage -> backfill to 'completed'.
--   - jobs row with a job_photos row where kind='after' but no commissions
--     row -> backfill to 'completed' (job finished, not yet reconciled).
--   - every other row is left untouched — 'new' (or whatever non-terminal
--     status it already holds) remains correct for a job that genuinely
--     never progressed.
--
-- This only ever moves a status forward — gated by jobs.status < 'completed'
-- using job_status's declared enum ordering (new < qualified < scheduled <
-- assigned < accepted < en_route < in_progress < completed < paid < closed <
-- declined < needs_reschedule < cancelled) — never backward, and only ever
-- touches rows with corroborating evidence, never a blanket rewrite. Safe to
-- run more than once: every predicate re-evaluates against current state, so
-- a rerun after a prior partial run is a no-op for already-backfilled rows.
--
-- NOTE: commissions has no direct FK to payout_batches/payout_lines
-- (verified against 0005_money.sql at implementation time, per Workstream
-- I-4's own verification note) — the join below (payout_lines.user_id
-- matching commissions.user_id within the same organization, batch status
-- 'paid', and the batch's period_start/period_end bounding the commission's
-- created_at date) is the best available signal, not a guaranteed-exact
-- linkage.

-- ---------------------------------------------------------------------------
-- 1. paid: commission exists AND that user had a paid payout_batches row
--    whose period covers the commission's created_at date.
-- ---------------------------------------------------------------------------

update public.jobs j
set status = 'paid'
where j.status < 'completed'
  and exists (
    select 1
    from public.commissions c
    where c.job_id = j.id
      and c.voided_at is null
      and exists (
        select 1
        from public.payout_lines pl
        join public.payout_batches pb on pb.id = pl.payout_batch_id
        where pl.user_id = c.user_id
          and pl.organization_id = c.organization_id
          and pb.status = 'paid'
          and c.created_at::date between pb.period_start and pb.period_end
      )
  );

-- ---------------------------------------------------------------------------
-- 2. completed: commission exists but no paid-batch coverage found above.
--    (Rows already advanced to 'paid' in step 1 no longer satisfy
--    j.status < 'completed', so this step never reprocesses them.)
-- ---------------------------------------------------------------------------

update public.jobs j
set status = 'completed'
where j.status < 'completed'
  and exists (
    select 1
    from public.commissions c
    where c.job_id = j.id
      and c.voided_at is null
  );

-- ---------------------------------------------------------------------------
-- 3. completed: no commission, but an 'after' job_photos row exists — job
--    finished, not yet reconciled.
-- ---------------------------------------------------------------------------

update public.jobs j
set status = 'completed'
where j.status < 'completed'
  and exists (
    select 1
    from public.job_photos jp
    where jp.job_id = j.id
      and jp.kind = 'after'
  )
  and not exists (
    select 1
    from public.commissions c
    where c.job_id = j.id
      and c.voided_at is null
  );

-- Every other row (no commission, no 'after' photo) is left untouched.
