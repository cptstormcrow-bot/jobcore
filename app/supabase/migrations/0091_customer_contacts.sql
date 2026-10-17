-- 0091: customer contacts (Close-Out #0018 Contacts tab / Sales & Marketing customer database).
-- One customer -> many phone / email / alt contact values, org-scoped by RLS.
-- Backfills from customers.phone / customers.email, then redefines save_job_customer
-- (latest definition: 0069; signature, security invoker, search_path and no-grant
-- behavior unchanged) to also upsert the saved phone/email into customer_contacts.
-- ASSUMPTION: jobs has no customer_phone column in any migration, so no job-phone backfill.
begin;

create table if not exists public.customer_contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id     uuid not null references public.customers (id) on delete cascade,
  label           text,
  kind            text not null check (kind in ('phone','email','alt')),
  value           text not null,
  created_at      timestamptz not null default now(),
  unique (customer_id, kind, value)
);

create index if not exists customer_contacts_org_customer_idx
  on public.customer_contacts (organization_id, customer_id);

alter table public.customer_contacts enable row level security;

drop policy if exists customer_contacts_select_org on public.customer_contacts;
create policy customer_contacts_select_org on public.customer_contacts
  for select to authenticated using (organization_id = public.current_org_id());
drop policy if exists customer_contacts_insert_org on public.customer_contacts;
create policy customer_contacts_insert_org on public.customer_contacts
  for insert to authenticated with check (organization_id = public.current_org_id());
drop policy if exists customer_contacts_update_org on public.customer_contacts;
create policy customer_contacts_update_org on public.customer_contacts
  for update to authenticated using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());
drop policy if exists customer_contacts_delete_org on public.customer_contacts;
create policy customer_contacts_delete_org on public.customer_contacts
  for delete to authenticated using (organization_id = public.current_org_id());

insert into public.customer_contacts (organization_id, customer_id, kind, value)
select organization_id, id, 'phone', btrim(phone) from public.customers
 where phone is not null and btrim(phone) <> ''
on conflict (customer_id, kind, value) do nothing;

insert into public.customer_contacts (organization_id, customer_id, kind, value)
select organization_id, id, 'email', btrim(email) from public.customers
 where email is not null and btrim(email) <> ''
on conflict (customer_id, kind, value) do nothing;

create or replace function public.save_job_customer(p_job_id uuid, p_customer jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid := public.current_org_id();
  v_job public.jobs%rowtype;
  v_customer public.customers%rowtype;
begin
  if v_org is null then
    raise exception 'save_job_customer: caller has no organization' using errcode = '42501';
  end if;
  select * into v_job from public.jobs
   where id = p_job_id and organization_id = v_org
   for update;
  if not found then
    raise exception 'save_job_customer: job % not found', p_job_id using errcode = 'P0002';
  end if;
  if v_job.customer_id is null then
    insert into public.customers (organization_id, name, phone, email, address)
    values (v_org, p_customer->>'name', p_customer->>'phone', p_customer->>'email', p_customer->>'address')
    returning * into v_customer;
    update public.jobs set customer_id = v_customer.id
     where id = p_job_id and organization_id = v_org;
  else
    update public.customers set
      name    = case when p_customer ? 'name'    then p_customer->>'name'    else name end,
      phone   = case when p_customer ? 'phone'   then p_customer->>'phone'   else phone end,
      email   = case when p_customer ? 'email'   then p_customer->>'email'   else email end,
      address = case when p_customer ? 'address' then p_customer->>'address' else address end
     where id = v_job.customer_id and organization_id = v_org
    returning * into v_customer;
    if not found then
      raise exception 'save_job_customer: customer % not found', v_job.customer_id using errcode = 'P0002';
    end if;
  end if;
  -- 0091: mirror the saved phone/email into customer_contacts.
  insert into public.customer_contacts (organization_id, customer_id, kind, value)
  select v_org, v_customer.id, c.kind, btrim(c.value)
    from (values ('phone', v_customer.phone), ('email', v_customer.email)) as c(kind, value)
   where c.value is not null and btrim(c.value) <> ''
  on conflict (customer_id, kind, value) do nothing;
  return to_jsonb(v_customer);
end;
$$;

commit;
