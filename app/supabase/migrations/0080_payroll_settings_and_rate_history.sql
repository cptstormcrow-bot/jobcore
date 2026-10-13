-- Jobcore - migration 0080: payroll settings and employee rate history
--
-- payroll_settings: one row per org (weekly pay only). The app falls back to
-- these defaults if an org has no row.
-- employee_rate_history: dated hourly rates; payroll always reads this table.

begin;

-- A) payroll_settings ---------------------------------------------------------
create table if not exists public.payroll_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  week_start_dow smallint not null default 1 check (week_start_dow between 0 and 6), -- 0 = Sunday
  period_anchor_date date not null default date '2024-01-01',
  ot_daily_after_min integer not null default 480,
  dt_daily_after_min integer not null default 720,
  ot_weekly_after_min integer not null default 2400,
  seventh_day_rule boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_settings_ot_daily_pos check (ot_daily_after_min > 0),
  constraint payroll_settings_dt_daily_pos check (dt_daily_after_min > 0),
  constraint payroll_settings_ot_weekly_pos check (ot_weekly_after_min > 0),
  constraint payroll_settings_dt_ge_ot check (dt_daily_after_min >= ot_daily_after_min)
);

insert into public.payroll_settings (organization_id)
select o.id from public.organizations o
on conflict (organization_id) do nothing;

alter table public.payroll_settings enable row level security;

drop policy if exists payroll_settings_select_org on public.payroll_settings;
create policy payroll_settings_select_org on public.payroll_settings
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists payroll_settings_admin_all on public.payroll_settings;
create policy payroll_settings_admin_all on public.payroll_settings
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- B) employee_rate_history ----------------------------------------------------
create table if not exists public.employee_rate_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  hourly_rate_cents integer not null check (hourly_rate_cents >= 0),
  effective_from date not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (user_id, effective_from)
);

create index if not exists employee_rate_history_user_effective_idx
  on public.employee_rate_history (user_id, effective_from desc);

alter table public.employee_rate_history enable row level security;

drop policy if exists employee_rate_history_select_own_or_admin on public.employee_rate_history;
create policy employee_rate_history_select_own_or_admin on public.employee_rate_history
  for select to authenticated
  using (
    organization_id = public.current_org_id()
    and (user_id = auth.uid() or public.is_org_admin())
  );

drop policy if exists employee_rate_history_admin_all on public.employee_rate_history;
create policy employee_rate_history_admin_all on public.employee_rate_history
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- C) Backfill baseline rows ---------------------------------------------------
insert into public.employee_rate_history (organization_id, user_id, hourly_rate_cents, effective_from)
select p.organization_id, p.id, p.hourly_rate_cents, date '1970-01-01'
from public.profiles p
where p.hourly_rate_cents is not null
on conflict (user_id, effective_from) do nothing;

-- D) Mirror sync --------------------------------------------------------------
-- The mirror reflects the rate in force when the history last changed; payroll
-- itself always reads employee_rate_history, never the mirror.
create or replace function public.sync_profile_rate_mirror()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if tg_op = 'DELETE' then
    v_user := old.user_id;
  else
    v_user := new.user_id;
  end if;

  update public.profiles
     set hourly_rate_cents = (
       select r.hourly_rate_cents
         from public.employee_rate_history r
        where r.user_id = v_user
          and r.effective_from <= current_date
        order by r.effective_from desc
        limit 1
     )
   where id = v_user
     and (
       select r.hourly_rate_cents
         from public.employee_rate_history r
        where r.user_id = v_user
          and r.effective_from <= current_date
        order by r.effective_from desc
        limit 1
     ) is not null;

  return null;
end;
$$;

drop trigger if exists employee_rate_history_sync_mirror on public.employee_rate_history;
create trigger employee_rate_history_sync_mirror
  after insert or update or delete on public.employee_rate_history
  for each row execute function public.sync_profile_rate_mirror();

-- E) set_employee_rate --------------------------------------------------------
create or replace function public.set_employee_rate(
  p_user_id uuid,
  p_cents integer,
  p_effective_from date
)
returns public.employee_rate_history
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.employee_rate_history;
begin
  if not public.is_org_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_cents is null or p_cents < 0 or p_effective_from is null then
    raise exception 'invalid rate or effective date' using errcode = '22023';
  end if;
  if (select organization_id from public.profiles where id = p_user_id)
     is distinct from public.current_org_id() then
    raise exception 'unknown employee' using errcode = 'P0002';
  end if;

  insert into public.employee_rate_history
    (organization_id, user_id, hourly_rate_cents, effective_from, created_by)
  values
    (public.current_org_id(), p_user_id, p_cents, p_effective_from, auth.uid())
  on conflict (user_id, effective_from) do update
    set hourly_rate_cents = excluded.hourly_rate_cents,
        created_by = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;

-- F) Grants -------------------------------------------------------------------
revoke all on table public.payroll_settings from anon, public;
grant select, insert, update, delete on table public.payroll_settings to authenticated;

revoke all on table public.employee_rate_history from anon, public;
grant select, insert, update, delete on table public.employee_rate_history to authenticated;

revoke all on function public.set_employee_rate(uuid, integer, date) from public, anon;
grant execute on function public.set_employee_rate(uuid, integer, date) to authenticated;

revoke all on function public.sync_profile_rate_mirror() from public, anon;

commit;
