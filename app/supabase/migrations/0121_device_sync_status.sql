-- 0121: device_sync_status. One row per tech per phone, reported by the phone
-- after each sync pass so admins can see stuck or failed changes on the web
-- (Tech sync monitor, screen #0101). Read-only monitor: no admin orders yet.
--
-- Writes go only through security definer RPCs so the server, not the phone,
-- sets organization_id, user_id and last_seen_at (phone clocks can be wrong).

create table if not exists public.device_sync_status (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 1 and 100),
  device_name text check (device_name is null or char_length(device_name) <= 100),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  is_online boolean not null default true,
  last_seen_at timestamptz not null default now(),
  pending_count integer not null default 0 check (pending_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  stuck_count integer not null default 0 check (stuck_count >= 0),
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  failed_items jsonb not null default '[]'::jsonb check (jsonb_typeof(failed_items) = 'array'),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists device_sync_status_org_idx
  on public.device_sync_status (organization_id, last_seen_at desc);

alter table public.device_sync_status enable row level security;

-- A tech reads their own rows; admins and the owner read every row in their org.
drop policy if exists device_sync_status_select on public.device_sync_status;
create policy device_sync_status_select on public.device_sync_status
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (user_id = auth.uid() or public.is_org_admin())
  );

-- No insert/update/delete policies: all writes go through the RPCs below.
revoke insert, update, delete on public.device_sync_status from authenticated, anon;
grant select on public.device_sync_status to authenticated;

-- Phone report. Upserts the caller's row for this device; last_seen_at is server time.
-- Reporting clears hidden, so a hidden phone that comes back shows again.
create or replace function public.report_device_sync_status(
  p_device_id text,
  p_device_name text,
  p_app_version text,
  p_is_online boolean,
  p_pending_count integer,
  p_failed_count integer,
  p_stuck_count integer,
  p_last_error text,
  p_failed_items jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_items jsonb := coalesce(p_failed_items, '[]'::jsonb);
begin
  if auth.uid() is null or v_org is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    v_items := '[]'::jsonb;
  end if;
  -- Keep at most 20 items, whatever the phone sends.
  if jsonb_array_length(v_items) > 20 then
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_items
    from (select e from jsonb_array_elements(v_items) with ordinality as t(e, n) where n <= 20) s;
  end if;

  insert into public.device_sync_status as d (
    organization_id, user_id, device_id, device_name, app_version, is_online,
    last_seen_at, pending_count, failed_count, stuck_count, last_error, failed_items, hidden
  ) values (
    v_org, auth.uid(), left(p_device_id, 100), left(p_device_name, 100), left(p_app_version, 40),
    coalesce(p_is_online, true), now(),
    greatest(coalesce(p_pending_count, 0), 0), greatest(coalesce(p_failed_count, 0), 0),
    greatest(coalesce(p_stuck_count, 0), 0), left(p_last_error, 1000), v_items, false
  )
  on conflict (user_id, device_id) do update set
    organization_id = excluded.organization_id,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    is_online = excluded.is_online,
    last_seen_at = now(),
    pending_count = excluded.pending_count,
    failed_count = excluded.failed_count,
    stuck_count = excluded.stuck_count,
    last_error = excluded.last_error,
    failed_items = excluded.failed_items,
    hidden = false;
end;
$$;

revoke all on function public.report_device_sync_status(text, text, text, boolean, integer, integer, integer, text, jsonb) from public;
grant execute on function public.report_device_sync_status(text, text, text, boolean, integer, integer, integer, text, jsonb) to authenticated;

-- Admin hide/unhide of an old phone's row in the admin's own org.
create or replace function public.set_device_sync_status_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_org_admin() then
    raise exception 'admins only';
  end if;
  update public.device_sync_status
    set hidden = coalesce(p_hidden, true)
    where id = p_id and organization_id = public.current_org_id();
end;
$$;

revoke all on function public.set_device_sync_status_hidden(uuid, boolean) from public;
grant execute on function public.set_device_sync_status_hidden(uuid, boolean) to authenticated;
