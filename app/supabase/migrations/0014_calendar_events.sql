-- Jobcore — calendar events (job-lifecycle spine, calendar tie-in)
-- Apply after 0013.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

-- Append-only log of calendar-relevant events (status transitions, time off,
-- other manually-logged entries). job_id is nullable so non-job events (e.g.
-- time_off) can still be logged against an organization/tech without a job.
create table public.calendar_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid references public.jobs (id) on delete cascade,
  kind            text not null,
  title           text,
  description     text,
  event_time      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index calendar_events_organization_id_idx on public.calendar_events (organization_id);
create index calendar_events_job_id_idx on public.calendar_events (job_id);
create index calendar_events_event_time_idx on public.calendar_events (event_time);

-- ---------------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------------

alter table public.calendar_events enable row level security;

-- calendar_events: org admin/office staff (owner, admin, sales) have full
-- read within their own organization. Mirrors jobs_select_org (0004) —
-- deliberately excludes tech, whose read visibility is scoped through
-- calendar_events_select_tech below (events on jobs they're assigned to).
create policy calendar_events_select_org on public.calendar_events
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('owner', 'admin', 'sales')
    )
  );

-- calendar_events: a tech sees only events tied to jobs they are assigned
-- to, resolved through job_assignments, still bounded to their own
-- organization. Mirrors jobs_select_tech (0004).
create policy calendar_events_select_tech on public.calendar_events
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and job_id is not null
    and exists (
      select 1
      from public.job_assignments ja
      where ja.job_id = calendar_events.job_id
        and ja.tech_id = auth.uid()
    )
  );

-- calendar_events: any authenticated org member may insert an event they
-- attribute to themselves, within their own organization. This is the write
-- path both admin-finance and field-tech call sites use to log a status
-- transition or other calendar event.
create policy calendar_events_insert_self on public.calendar_events
  for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and created_by = auth.uid()
  );
