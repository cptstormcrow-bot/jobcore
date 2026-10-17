-- Jobcore - migration 0089: estimate redlines
-- UNAPPLIED. Written only; Jeff applies it via the live-push playbook.
--
-- job_estimates: materials on-site flag, tracking info, per-estimate fine
-- print (null = use the org template), PDF delivery flag, contingencies.
-- estimate_settings: one row per org holding the fine-print template.
-- The default template is PLACEHOLDER wording to be reviewed; not legal advice.

begin;

alter table public.job_estimates
  add column if not exists materials_onsite boolean not null default false,
  add column if not exists tracking_number text null,
  add column if not exists tracking_status text null,
  add column if not exists tracking_checked_at timestamptz null,
  add column if not exists fine_print text null,
  add column if not exists pdf_delivery boolean not null default false,
  add column if not exists contingencies jsonb not null default '[]'::jsonb; -- array of {description, price|null}

create table if not exists public.estimate_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  fine_print_template text not null default 'This estimate is based on conditions visible at the time of inspection. Hidden or unforeseen conditions may change the price. Work follows applicable building codes and accessibility requirements. This is placeholder wording to be reviewed; it is not legal advice.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.estimate_settings enable row level security;

drop policy if exists estimate_settings_select_org on public.estimate_settings;
create policy estimate_settings_select_org on public.estimate_settings
  for select to authenticated
  using (organization_id = public.current_org_id());

drop policy if exists estimate_settings_admin_all on public.estimate_settings;
create policy estimate_settings_admin_all on public.estimate_settings
  for all to authenticated
  using (organization_id = public.current_org_id() and public.is_org_admin())
  with check (organization_id = public.current_org_id() and public.is_org_admin());

-- Jeff 2026-10-13 dropped Rejected and Negotiating; existing rejected rows map to draft.
update public.job_estimates set status = 'draft' where status = 'rejected';
alter table public.job_estimates drop constraint if exists job_estimates_status_check;
alter table public.job_estimates add constraint job_estimates_status_check check (status in ('draft','submitted','approved'));

commit;
