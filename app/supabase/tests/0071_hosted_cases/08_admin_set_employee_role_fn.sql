-- admin changes the tech's role via public.admin_set_employee_role() (security definer, guard steps aside); expected: ALLOWED
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
with u as (
  select public.admin_set_employee_role('d59e3bc7-691d-4ada-8959-e86f40c1e344', 'sales') as called
)
select ('RESULT ' || json_build_object(
  'case', '08_admin_set_employee_role_fn',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
