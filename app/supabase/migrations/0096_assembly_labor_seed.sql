-- 0096_assembly_labor_seed.sql
-- Seed of 5 assembly labor items (Desk, Nightstand, Dresser, Bed (basic), Bed with desk)
-- under the 'Furniture Assembly' service for every organization. Idempotent: the service
-- is created only if missing and each task is inserted only if no same-named task exists.

begin;

do $$
declare
  org record;
  v_svc uuid;
  item record;
begin
  for org in select id from public.organizations loop
    select s.id into v_svc from public.services s
     where s.organization_id = org.id and s.name = 'Furniture Assembly'
     order by s.created_at, s.id limit 1;
    if v_svc is null then
      insert into public.services (organization_id, name)
      values (org.id, 'Furniture Assembly') returning id into v_svc;
    end if;

    for item in
      select * from (values
        ('Desk', 89.00::numeric),
        ('Nightstand', 89.00::numeric),
        ('Dresser', 129.00::numeric),
        ('Bed (basic)', 89.00::numeric),
        ('Bed with desk', 129.00::numeric)
      ) as v(name, rate)
    loop
      if not exists (
        select 1 from public.service_tasks st
         where st.organization_id = org.id and st.service_id = v_svc
           and lower(btrim(st.name)) = lower(btrim(item.name))
      ) then
        insert into public.service_tasks (organization_id, service_id, name, rate, price_cents, active, category)
        values (org.id, v_svc, item.name, item.rate, round(item.rate * 100)::integer, true, 'Furniture Assembly');
      end if;
    end loop;
  end loop;
end;
$$;

commit;

notify pgrst, 'reload schema';
