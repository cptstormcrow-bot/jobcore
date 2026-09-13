-- Jobcore — conditional paid-travel-time policy (admin-toggle, per employee)
-- Apply after 0054.
--
-- Jeff's requirement: travel time is only payable for a tech when the admin
-- module explicitly turns "Paid Travel" on for that employee's profile. The
-- policy message is editable per org but defaults to a standard sentence.
-- This migration adds the two columns; it does not change any RLS policy
-- surface (profiles' existing RLS continues to govern read/write access to
-- these new columns exactly as it already governs the rest of the row).

alter table public.profiles
  add column paid_travel boolean not null default false;

alter table public.profiles
  add column paid_travel_policy_message text not null default
    'Paid travel time is allowable if a vehicle is assigned to tech.';

comment on column public.profiles.paid_travel is
  'Admin-set toggle: true = this tech''s travel time counts toward payroll hours. Default false (no paid travel) per Jeff''s requirement that travel pay is the exception, not the default.';

comment on column public.profiles.paid_travel_policy_message is
  'Editable policy message shown to admins/techs explaining when paid travel applies. Defaults to Jeff''s standard sentence; org admins may edit the wording without changing the toggle semantics.';
