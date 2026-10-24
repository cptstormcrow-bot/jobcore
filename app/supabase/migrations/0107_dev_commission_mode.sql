-- Jobcore - migration 0107: Dev pay becomes a commission percent of labor
--
-- What: Jeff's order 2026-10-24 - the Dev "flat rate" ($ per assembly) becomes
-- a commission percent (0-50) of the job's LABOR charged.
--   1. profiles.dev_pay_mode now accepts ('hourly', 'commission'); existing
--      'flat' rows are mapped to 'commission' before the check is re-added.
--   2. A Dev's personal percent reuses profiles.commission_percent from 0106
--      (no new per-tech column). Its upper bound tightens from 100 to 50.
--      A guard raises an exception if any profile already exceeds 50, so no
--      money data is changed silently. profiles_commission_enabled_chk from
--      0106 is untouched.
--   3. compensation_policies gains dev_default_commission_percent
--      numeric(5,2) not null default 0, checked between 0 and 50: the policy
--      fallback percent of labor for a Dev tech in commission mode with no
--      personal percent.
--   4. flat_rate_cents and dev_default_flat_cents stay in place, unused
--      (DEPRECATED by 0107, no longer read by the app). Nothing is dropped.
--      job_payout_lines is not touched: basis 'dev_flat' stays valid for
--      history, and 0106 already allows 'commission'.
--
-- Must be applied AFTER 0106.
--
-- Not applied live until Jeff approves the push.
--
-- Idempotent: add column if not exists, drop constraint if exists then add,
-- update only touches rows still on 'flat'. Re-running changes nothing.
--
-- Rollback notes (manual, in this order):
--   alter table public.compensation_policies
--     drop constraint if exists compensation_policies_dev_default_commission_chk,
--     drop column if exists dev_default_commission_percent;
--   alter table public.profiles drop constraint if exists profiles_dev_pay_mode_chk;
--   alter table public.profiles add constraint profiles_dev_pay_mode_chk
--     check (dev_pay_mode is null or dev_pay_mode in ('hourly', 'flat'));
--     -- first map rows back: update public.profiles set dev_pay_mode = 'flat'
--     --   where dev_pay_mode = 'commission';
--     -- NOT lossless: 0107 cannot tell which 'commission' rows were originally
--     -- 'flat', so a rollback maps every one of them back to 'flat'.
--   profiles_commission_percent_chk may be restored to <= 100 if wanted.

begin;

-- 1. profiles.dev_pay_mode: flat -> commission -------------------------------
alter table public.profiles drop constraint if exists profiles_dev_pay_mode_chk;

update public.profiles set dev_pay_mode = 'commission' where dev_pay_mode = 'flat';

alter table public.profiles
  add constraint profiles_dev_pay_mode_chk
  check (dev_pay_mode is null or dev_pay_mode in ('hourly', 'commission'));

-- 2. profiles.commission_percent: cap at 50 (guarded, never silently edits) ---
do $$
declare
  v_over integer;
begin
  select count(*) into v_over
  from public.profiles
  where commission_percent > 50;

  if v_over > 0 then
    raise exception 'Profiles with commission_percent over 50 exist; fix them before applying 0107 (count=%)', v_over;
  end if;
end
$$;

alter table public.profiles drop constraint if exists profiles_commission_percent_chk;
alter table public.profiles
  add constraint profiles_commission_percent_chk
  check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 50));

-- 3. compensation_policies: Dev default commission percent -------------------
alter table public.compensation_policies
  add column if not exists dev_default_commission_percent numeric(5,2) not null default 0;

alter table public.compensation_policies
  drop constraint if exists compensation_policies_dev_default_commission_chk;
alter table public.compensation_policies
  add constraint compensation_policies_dev_default_commission_chk
  check (dev_default_commission_percent between 0 and 50);

comment on column public.compensation_policies.dev_default_commission_percent is
  'Policy fallback commission percent of labor for a Dev tech in commission mode with no personal percent.';

-- 4. Deprecated flat columns (kept, unused) -----------------------------------
comment on column public.profiles.flat_rate_cents is
  'DEPRECATED by 0107, no longer read by the app. Dev pay is now commission_percent of labor.';
comment on column public.compensation_policies.dev_default_flat_cents is
  'DEPRECATED by 0107, no longer read by the app. Use dev_default_commission_percent.';

commit;
