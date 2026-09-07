-- 0044: jobs.ingress_instructions (gate codes, meetup spot, lockbox notes)
-- surfaced by the mobile Job Details form. Nullable free text; no trigger
-- change needed — 0008 jobs_tech_update_whitelist compares a fixed column
-- list, so tech-role updates to this column are allowed by omission.
alter table public.jobs add column if not exists ingress_instructions text;
