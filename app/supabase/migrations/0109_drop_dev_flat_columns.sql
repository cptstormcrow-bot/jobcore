-- Jobcore - migration 0109: drop the deprecated Dev flat-rate columns
--
-- What: removes profiles.flat_rate_cents (with profiles_flat_rate_cents_chk) and
-- compensation_policies.dev_default_flat_cents (with
-- compensation_policies_dev_default_flat_chk).
--
-- Why: Jeff's order 2026-10-24. 0107 deprecated both columns when Dev pay
-- moved to a commission percent of labor; nothing in the app reads them. Live
-- data check (read-only, 2026-10-24): 0 profiles have flat_rate_cents not
-- null, 0 policies have dev_default_flat_cents > 0, 0 job_payout_lines rows
-- have basis 'dev_flat'. Nothing is lost. job_payout_lines is not touched:
-- basis 'dev_flat' stays valid in its check constraint.
--
-- Must be applied AFTER 0107.
--
-- Not applied live until Jeff approves a push. A dry-run on 2026-10-24 listed
-- only this migration (0108 was already live by then).
--
-- Idempotent: drop constraint if exists, drop column if exists. Re-running
-- changes nothing.
--
-- Rollback notes (manual):
--   alter table public.profiles add column if not exists flat_rate_cents integer;
--   alter table public.profiles add constraint profiles_flat_rate_cents_chk
--     check (flat_rate_cents is null or flat_rate_cents >= 0);
--   alter table public.compensation_policies
--     add column if not exists dev_default_flat_cents integer not null default 0;
--   alter table public.compensation_policies
--     add constraint compensation_policies_dev_default_flat_chk
--     check (dev_default_flat_cents >= 0);
--   Values are NOT recoverable (the data was empty when dropped).

begin;

alter table public.profiles drop constraint if exists profiles_flat_rate_cents_chk;
alter table public.profiles drop column if exists flat_rate_cents;

alter table public.compensation_policies
  drop constraint if exists compensation_policies_dev_default_flat_chk;
alter table public.compensation_policies drop column if exists dev_default_flat_cents;

commit;
