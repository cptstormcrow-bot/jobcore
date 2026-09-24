-- 0066: profiles.hourly_rate_cents + price_sheet_rates.task_id
-- (a) profiles.hourly_rate_cents backs the Employee editor's rate field (v2 AD-04/AD-05):
--     EmployeeRepository.updateEmployee writes it (admin-finance-repos.ts:715-716), but the
--     column was missing so PostgREST rejected the whole update.
-- (b) price_sheet_rates.task_id closes the known gap noted at 0047:15 (the rates upsert sends
--     task_id, which wasn't a column).
-- (c) RLS unchanged: profiles_update_admin (0001:136-146) already covers admin updates to
--     profiles; only role has a column revoke (0002:17).

alter table public.profiles add column if not exists hourly_rate_cents integer;
alter table public.price_sheet_rates
  add column if not exists task_id uuid null references public.service_tasks(id) on delete set null;
notify pgrst, 'reload schema';
