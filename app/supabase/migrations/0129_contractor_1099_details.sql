-- 0129_contractor_1099_details.sql — admin-only contractor 1099 details (typed-in contractor number, contact, address).
-- Extends public.profile_private (admin-only RLS from 0062). No tax ID beyond the existing ssn_last4.
alter table public.profile_private
  add column if not exists contractor_number text,
  add column if not exists contact_name text,
  add column if not exists contact_phone text,
  add column if not exists contact_email text,
  add column if not exists address_street text,
  add column if not exists address_city text,
  add column if not exists address_state text,
  add column if not exists address_zip text;
comment on column public.profile_private.contractor_number is 'Contractor number typed in by an admin (1099 records).';
comment on column public.profile_private.contact_name is 'Contractor 1099 contact name.';
comment on column public.profile_private.contact_phone is 'Contractor 1099 contact phone.';
comment on column public.profile_private.contact_email is 'Contractor 1099 contact email.';
comment on column public.profile_private.address_street is 'Contractor 1099 mailing address: street.';
comment on column public.profile_private.address_city is 'Contractor 1099 mailing address: city.';
comment on column public.profile_private.address_state is 'Contractor 1099 mailing address: state.';
comment on column public.profile_private.address_zip is 'Contractor 1099 mailing address: ZIP.';
