-- postgres/owner session (no role switch) changes the tech's role directly; guard steps aside; expected: ALLOWED
begin;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
with u as (
  update public.profiles set role = case when role = 'tech' then 'sales' else 'tech' end::public.user_role where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344' returning id
)
select ('RESULT ' || json_build_object(
  'case', '10_postgres_bypasses_guard',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
