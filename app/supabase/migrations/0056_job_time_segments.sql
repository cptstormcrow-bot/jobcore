-- Jobcore — job_time_segments (unified time tracking, conditional travel pay)
-- Apply after 0055.

-- ---------------------------------------------------------------------------
-- 1. time_segment_reason enum
-- ---------------------------------------------------------------------------

create type time_segment_reason as enum (
  'job_labor', 'lunch', 'materials', 'prem_visit', 'travel', 'other'
);

-- ---------------------------------------------------------------------------
-- 2. job_time_segments
-- ---------------------------------------------------------------------------

-- One row per contiguous span of a tech's time, tagged with reason_code.
-- Segments are either trigger-opened (linked to job-status transitions:
-- 'travel' and 'job_labor') or manually opened by the tech ('lunch',
-- 'materials', 'prem_visit', 'other'). source distinguishes the two paths
-- and is the tech/trigger boundary enforced below.
create table public.job_time_segments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id          uuid references public.jobs (id) on delete cascade,
  tech_id         uuid not null references auth.users (id) on delete cascade,
  reason_code     time_segment_reason not null,
  started_at      timestamptz not null,
  ended_at        timestamptz,
  source          text not null check (source in ('trigger', 'manual')),
  synced_at       timestamptz not null default now(),
  created_by      uuid not null references auth.users (id),
  created_at      timestamptz not null default now(),
  constraint job_time_segments_job_required_for_reason
    check (reason_code not in ('job_labor', 'prem_visit') or job_id is not null),
  constraint job_time_segments_ended_after_started
    check (ended_at is null or ended_at >= started_at)
);

create index job_time_segments_organization_id_idx on public.job_time_segments (organization_id);
create index job_time_segments_job_id_idx on public.job_time_segments (job_id);
create index job_time_segments_tech_id_idx on public.job_time_segments (tech_id);

-- One open segment per tech at a time.
create unique index job_time_segments_one_open_per_tech
  on public.job_time_segments (tech_id) where (ended_at is null);

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table public.job_time_segments enable row level security;

-- job_time_segments: org admins get full read/write within their own
-- organization, mirroring job_time_entries_admin_all in 0024.
create policy job_time_segments_admin_all
  on public.job_time_segments for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- A tech may select only their own segments, scoped to their org.
create policy job_time_segments_select_own
  on public.job_time_segments for select
  to authenticated
  using (organization_id = public.current_org_id() and tech_id = auth.uid());

-- A tech may insert only source = 'manual' rows, and never reason_code =
-- 'job_labor' or 'travel' (those are trigger-exclusive, opened only by
-- sync_job_time_segments() via open_time_segment()). Job association is
-- still validated through job_assignments when job_id is set, mirroring
-- job_time_entries_insert_own in 0024.
create policy job_time_segments_insert_own
  on public.job_time_segments for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and source = 'manual'
    and reason_code not in ('job_labor', 'travel')
    and (
      job_id is null
      or exists (
        select 1
        from public.job_assignments ja
        where ja.job_id = job_time_segments.job_id
          and ja.tech_id = auth.uid()
      )
    )
  );

-- A tech may update ONLY their own segment, and only while it is still open
-- (ended_at is null) — mirrors job_time_entries_update_own_open_entry in
-- 0024. The tech-update whitelist trigger (paired migration, per plan)
-- further restricts non-admin updates to the ended_at column only and
-- rejects any attempt to change source.
create policy job_time_segments_update_own_open_entry
  on public.job_time_segments for update
  to authenticated
  using (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and ended_at is null
  )
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
  );
