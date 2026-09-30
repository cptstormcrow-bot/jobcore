-- tech flips own active flag; expected: BLOCKED (42501)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
with u as (
  update public.profiles set active = not active where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344' returning id
)
select ('RESULT ' || json_build_object(
  'case', '04_tech_own_active',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
