-- Jobcore — migration 0115: job time segments use the phone-time event time.
-- Fixes: a tech working offline taps Travel/Arrive; the lifecycle patch replays
-- hours later and open_time_segment stamped started_at = now() (sync time), so
-- travel/labor hours were wrong. The client already sends the tap-time values
-- as jobs.en_route_at / in_progress_at / completed_at (captured at enqueue in
-- patchLifecycle), so no new column is needed: open_time_segment now takes an
-- optional start time and sync_job_time_segments passes the clamped event time.
-- Clamp (clamp_event_time): null, in the future, or older than 7 days -> now().
-- Also: open_time_segment re-gains the 0059 null-tech guard that 0113 dropped,
-- and close helpers never write ended_at < started_at (job_time_segments check).
-- Everything else from 0113/0114 is preserved.
-- NOT applied live yet; held until Jeff says.

begin;

create or replace function public.clamp_event_time(p_event_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_event_at is null then now()
    when p_event_at > now() then now()
    when p_event_at < now() - interval '7 days' then now()
    else p_event_at
  end;
$$;

-- Replace the 3-arg signature (0113) with a 4-arg one whose last arg defaults,
-- so existing 3-arg callers (0060 RPCs) keep working without ambiguity.
drop function if exists public.open_time_segment(uuid, uuid, public.time_segment_reason);

create or replace function public.open_time_segment(
  p_tech_id uuid,
  p_job_id uuid,
  p_reason_code public.time_segment_reason,
  p_started_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_start timestamptz;
begin
  if p_tech_id is null then
    return;
  end if;

  select organization_id into v_organization_id
  from public.jobs
  where id = p_job_id;

  v_start := public.clamp_event_time(p_started_at);

  -- Never start before the tech's own latest segment start (keeps order sane).
  v_start := greatest(
    v_start,
    coalesce(
      (select max(s.started_at) from public.job_time_segments s where s.tech_id = p_tech_id),
      '-infinity'::timestamptz
    )
  );

  -- A tech has at most one open segment (job_time_segments_one_open_per_tech).
  update public.job_time_segments
  set ended_at = greatest(v_start, started_at)
  where tech_id = p_tech_id
    and ended_at is null;

  insert into public.job_time_segments (
    organization_id, job_id, tech_id, reason_code, started_at, source, created_by
  ) values (
    v_organization_id, p_job_id, p_tech_id, p_reason_code, v_start, 'trigger', p_tech_id
  );
end;
$$;

create or replace function public.close_time_segment(
  p_tech_id uuid,
  p_ended_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_time_segments
  set ended_at = greatest(p_ended_at, started_at)
  where tech_id = p_tech_id
    and ended_at is null;
end;
$$;

create or replace function public.sync_job_time_segments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Tech reassignment mid-job (admin, online): close at now() and flag for review.
  if new.assigned_tech_id is distinct from old.assigned_tech_id
     and old.assigned_tech_id is not null
  then
    perform public.close_time_segment(old.assigned_tech_id, now());

    insert into public.job_time_segment_corrections (
      organization_id, segment_id, tech_id, note, requested_by
    )
    select
      s.organization_id, s.id, s.tech_id,
      'Auto-flagged: tech reassigned mid-job',
      old.assigned_tech_id
    from public.job_time_segments s
    where s.job_id = new.id
      and s.tech_id = old.assigned_tech_id
      and s.ended_at = now();
  end if;

  if old.en_route_at is null and new.en_route_at is not null then
    perform public.open_time_segment(
      new.assigned_tech_id, new.id, 'travel', new.en_route_at);
  end if;

  if old.in_progress_at is null and new.in_progress_at is not null then
    perform public.close_time_segment(
      new.assigned_tech_id, public.clamp_event_time(new.in_progress_at));
    perform public.open_time_segment(
      new.assigned_tech_id, new.id, 'job_labor', new.in_progress_at);
  end if;

  if new.completed_at is not null and new.completed_at is distinct from old.completed_at then
    perform public.close_time_segment(new.assigned_tech_id, new.completed_at);
  end if;

  return new;
end;
$$;

commit;
