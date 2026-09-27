-- Purpose: atomic "save the job's customer" for the job-detail screen.
-- If the job already has a linked customer, patch it; if not, create a
-- customer in the caller's org and link it to the job -- all in ONE call
-- so a customer row can never be created without the job being linked.
-- Previously this was two client round-trips (customers insert/update,
-- then jobs update), which could leave orphaned customer rows if the
-- second call failed.
--
-- Single source of truth: the job row's customer_id, read under
-- `for update`. The function deliberately takes no client-supplied
-- customer id.
--
-- Atomicity: PostgREST runs an RPC in a single transaction; any raise
-- (including the jobs_tech_update_whitelist trigger rejecting a
-- non-admin relinking customer_id) rolls back the whole call, including
-- the customer insert.
--
-- Why `security invoker`, not the `security definer` used by 0039:
-- 0039 uses definer only to bypass the admin-only estimate_tokens RLS.
-- Here we WANT the caller's RLS (customers/jobs org policies) and the
-- tech whitelist trigger to apply.
--
-- `select ... for update` under RLS requires the row to pass the UPDATE
-- policy: admins pass via jobs_update_org (0013); others get
-- "not found" (P0002).
--
-- No grant lines, matching 0039. Anon is stopped by the null
-- current_org_id() check (42501) plus RLS.
--
-- Patch semantics: absent jsonb keys leave the column unchanged; a
-- present key with JSON null sets NULL. On the create path, a
-- missing/null name hits customers.name NOT NULL and rolls back.

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
  return to_jsonb(v_customer);
end;
$$;
