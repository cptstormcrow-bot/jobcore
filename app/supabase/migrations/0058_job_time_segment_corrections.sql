-- Jobcore — job_time_segment_corrections (approve/reject workflow for job_time_segments)
-- Apply after 0057.

-- ---------------------------------------------------------------------------
-- 1. time_segment_correction_status enum
-- ---------------------------------------------------------------------------

create type time_segment_correction_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- 2. job_time_segment_corrections
-- ---------------------------------------------------------------------------

-- Propose → admin approve/reject workflow for job_time_segments. A tech (or
-- the sync trigger, for auto-flagged mid-job reassignment cases) requests a
-- correction; an admin reviews it via the RPCs in 0058_time_segment_
-- correction_rpcs (per plan numbering — this file is 0058 in the applied
-- sequence). There is intentionally no tech update path: decisions only
-- happen through the review RPCs, keeping the audit trail intact.
create table public.job_time_segment_corrections (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  segment_id             uuid not null references public.job_time_segments (id) on delete cascade,
  tech_id                uuid not null references auth.users (id) on delete cascade,
  requested_started_at   timestamptz,
  requested_ended_at     timestamptz,
  requested_reason_code  time_segment_reason,
  note                   text not null,
  status                 time_segment_correction_status not null default 'pending',
  requested_by           uuid not null references auth.users (id),
  reviewed_by            uuid references auth.users (id),
  reviewed_at            timestamptz,
  created_at             timestamptz not null default now()
);

create index job_time_segment_corrections_organization_id_idx
  on public.job_time_segment_corrections (organization_id);
create index job_time_segment_corrections_segment_id_idx
  on public.job_time_segment_corrections (segment_id);
create index job_time_segment_corrections_tech_id_idx
  on public.job_time_segment_corrections (tech_id);
-- Inference (plan silent on this index): admin queue screen filters/sorts by
-- status (per plan's TimeSegmentCorrectionQueueScreen.tsx), mirrored from
-- the org/job/tech indexing pattern in 0056 — added conservatively.
create index job_time_segment_corrections_status_idx
  on public.job_time_segment_corrections (status);

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------

alter table public.job_time_segment_corrections enable row level security;

-- job_time_segment_corrections: org admins get full read/write within their
-- own organization, mirroring job_time_segments_admin_all in 0056 /
-- job_time_entries_admin_all in 0024. Approve/reject happen through the
-- review RPCs (security definer), but admin_all still covers direct admin
-- reads and any manual correction of a correction row itself.
create policy job_time_segment_corrections_admin_all
  on public.job_time_segment_corrections for all
  to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- A tech may select only their own correction requests, scoped to their org.
create policy job_time_segment_corrections_select_own
  on public.job_time_segment_corrections for select
  to authenticated
  using (organization_id = public.current_org_id() and tech_id = auth.uid());

-- A tech may insert only a correction request for their own segment, always
-- starting in 'pending' status and self-attributed as requester. Segment
-- ownership is validated directly against job_time_segments.tech_id (no
-- job_assignments hop needed here, unlike job_time_segments_insert_own,
-- since the segment row itself already carries tech_id).
create policy job_time_segment_corrections_insert_own
  on public.job_time_segment_corrections for insert
  to authenticated
  with check (
    organization_id = public.current_org_id()
    and tech_id = auth.uid()
    and requested_by = auth.uid()
    and status = 'pending'
    and exists (
      select 1
      from public.job_time_segments jts
      where jts.id = job_time_segment_corrections.segment_id
        and jts.tech_id = auth.uid()
        and jts.organization_id = job_time_segment_corrections.organization_id
    )
  );

-- No tech update policy: per plan, decisions only happen via the
-- approve_time_segment_correction / reject_time_segment_correction RPCs
-- (security definer, admin-gated), not modeled on time_off_requests'
-- auto-decide pattern — human approval is required here for audit
-- integrity. Admin updates go through job_time_segment_corrections_admin_all
-- above (or the RPCs, which run as security definer and bypass RLS).
