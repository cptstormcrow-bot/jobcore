-- anon updates a profile (no UPDATE privilege: permission denied for table, 42501); expected: BLOCKED (42501)
begin;
set local role anon;
with u as (
  update public.profiles set full_name = 'anon' where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344' returning id
)
select ('RESULT ' || json_build_object(
  'case', '09_anon_update_denied',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
