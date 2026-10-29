-- HOSTED VARIANT. Jobcore - assertions for 0115_time_segments_use_event_time.sql
--
-- Hand-applied. Run in the SQL editor AFTER 0001..0115 and seed.hosted.sql.
-- Raises an exception on failure, silent on success. Rolled back at the end.
-- Runs on the service-role path against seed job ...0601 and the seed tech.
-- NOT run against the live DB by the author.

begin;
reset role;
set local request.jwt.claims = '';

-- Fixture: clean job + tech, no segments.
delete from public.job_time_segments where tech_id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344';
update public.jobs
   set assigned_tech_id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
       en_route_at = null, in_progress_at = null, completed_at = null
 where id = '00000000-0000-4000-8000-000000000601';

-- T1: offline travel tap 3h ago -> segment starts 3h ago, not now().
do $$
declare v_start timestamptz;
begin
  update public.jobs set en_route_at = now() - interval '3 hours'
   where id = '00000000-0000-4000-8000-000000000601';
  select started_at into v_start from public.job_time_segments
   where job_id = '00000000-0000-4000-8000-000000000601' and reason_code = 'travel';
  if v_start is null or abs(extract(epoch from (v_start - (now() - interval '3 hours')))) > 2 then
    raise exception 'T1 FAILED: travel started_at % is not ~3h ago', v_start;
  end if;
end $$;

-- T2: arrive 1h ago -> travel closed at 1h ago, job_labor opened at 1h ago.
do $$
declare v_end timestamptz; v_lab timestamptz;
begin
  update public.jobs set in_progress_at = now() - interval '1 hour'
   where id = '00000000-0000-4000-8000-000000000601';
  select ended_at into v_end from public.job_time_segments
   where job_id = '00000000-0000-4000-8000-000000000601' and reason_code = 'travel';
  select started_at into v_lab from public.job_time_segments
   where job_id = '00000000-0000-4000-8000-000000000601' and reason_code = 'job_labor';
  if abs(extract(epoch from (v_end - (now() - interval '1 hour')))) > 2
     or abs(extract(epoch from (v_lab - (now() - interval '1 hour')))) > 2 then
    raise exception 'T2 FAILED: travel end % / labor start % not ~1h ago', v_end, v_lab;
  end if;
end $$;

-- T3: clamp rules.
do $$
begin
  if abs(extract(epoch from (public.clamp_event_time(now() + interval '2 hours') - now()))) > 2 then
    raise exception 'T3a FAILED: future time not clamped to now()';
  end if;
  if abs(extract(epoch from (public.clamp_event_time(now() - interval '30 days') - now()))) > 2 then
    raise exception 'T3b FAILED: >7-day-old time not clamped to now()';
  end if;
  if abs(extract(epoch from (public.clamp_event_time(null) - now()))) > 2 then
    raise exception 'T3c FAILED: null not clamped to now()';
  end if;
end $$;

-- T4: completion closes the labor segment at the supplied time (0114 behavior kept).
do $$
declare v_end timestamptz;
begin
  update public.jobs set completed_at = now() - interval '10 minutes'
   where id = '00000000-0000-4000-8000-000000000601';
  select ended_at into v_end from public.job_time_segments
   where job_id = '00000000-0000-4000-8000-000000000601' and reason_code = 'job_labor';
  if v_end is null or abs(extract(epoch from (v_end - (now() - interval '10 minutes')))) > 2 then
    raise exception 'T4 FAILED: labor ended_at % not ~10min ago', v_end;
  end if;
end $$;

rollback;
