-- tech updates the admin's full_name; RLS filters the row (0 rows, no error); expected: 0 rows (blocked by RLS before the trigger fires)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
with u as (
  update public.profiles set full_name = 'Hijacked' where id = 'a143fac2-4806-42ed-9283-b45275b6c53a' returning id
)
select ('RESULT ' || json_build_object(
  'case', '05_tech_updates_admin_name',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
