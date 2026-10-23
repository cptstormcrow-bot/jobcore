-- Jobcore - migration 0097: estimate red flags + Fine Print default unification
-- UNAPPLIED. Written only; Jeff applies it via the live-push playbook.
--
-- (a) job_investigations: three red-flag booleans plus a notes field.
-- (b) estimate_settings.fine_print_template: default becomes the shared
--     placeholder; rows still holding the old 0089 default text are updated.
--     job_estimates.fine_print has no default in 0089 (null = use the org
--     template), so it is left alone. Idempotent: re-running is a no-op.

begin;

alter table public.job_investigations
  add column if not exists red_flag_marginal_equipment boolean not null default false,
  add column if not exists red_flag_undocumented_system boolean not null default false,
  add column if not exists red_flag_substandard_start boolean not null default false,
  add column if not exists red_flag_notes text null;

comment on column public.job_investigations.red_flag_marginal_equipment is 'Red flag: existing equipment is marginal or near end of life.';
comment on column public.job_investigations.red_flag_undocumented_system is 'Red flag: existing system is undocumented or its configuration is unknown.';
comment on column public.job_investigations.red_flag_substandard_start is 'Red flag: the job starts from a substandard or non-compliant existing condition.';
comment on column public.job_investigations.red_flag_notes is 'Free-text notes explaining any red flag raised on the estimate.';

alter table public.estimate_settings
  alter column fine_print_template set default '[PLACEHOLDER - Fine Print wording not yet supplied. Replace it with your own text using Edit Fine Print Template. This is not legal advice.]';

update public.estimate_settings
  set fine_print_template = '[PLACEHOLDER - Fine Print wording not yet supplied. Replace it with your own text using Edit Fine Print Template. This is not legal advice.]'
  where fine_print_template = 'This estimate is based on conditions visible at the time of inspection. Hidden or unforeseen conditions may change the price. Work follows applicable building codes and accessibility requirements. This is placeholder wording to be reviewed; it is not legal advice.';

commit;
