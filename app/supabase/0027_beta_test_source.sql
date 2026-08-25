-- 0027_beta_test_source.sql
-- Widen jobs_source_check to allow 'beta-test' as an explicit source value.
-- spawnTestJobs() (apps/mobile/src/lib/sales-marketing-repos.ts) inserts
-- source: 'beta-test' on the synthetic rows it creates for the "Spawn Test
-- Jobs" dev/QA feature, and uses is_beta = true + source = 'beta-test' to
-- find and reset them on the next spawn. 0022_referrer_taxonomy_and_area_pricing
-- only allow-listed real referrer channels (website/costco/ikea/owm), which
-- blocked this insert. leads.source is untouched -- leads never carry
-- is_beta / beta-test rows.
alter table public.jobs
  drop constraint if exists jobs_source_check;

alter table public.jobs
  add constraint jobs_source_check
  check (source is null or source in ('website', 'costco', 'ikea', 'owm', 'beta-test'));
