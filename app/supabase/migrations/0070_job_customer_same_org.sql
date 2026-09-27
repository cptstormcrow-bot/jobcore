-- C2 (FC1): a job's customer must belong to the job's organization.
-- Composite FK (customer_id, organization_id) -> customers (id, organization_id).
-- MATCH SIMPLE: a null customer_id skips the check. ON DELETE SET NULL (customer_id)
-- (PG15+) nulls only customer_id, never the NOT NULL organization_id.
-- FK keeps the name jobs_customer_id_fkey for PostgREST embed stability.
alter table public.customers add constraint customers_id_organization_id_key unique (id, organization_id);
alter table public.jobs drop constraint jobs_customer_id_fkey;
alter table public.jobs add constraint jobs_customer_id_fkey
  foreign key (customer_id, organization_id)
  references public.customers (id, organization_id)
  on delete set null (customer_id);
