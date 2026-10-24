-- admin sets Dev Tech commission_percent to 25 with RETURNING id (what admin-people.ts does); expected AFTER 0111: rows_updated 1 (RETURNING id needs SELECT on id only, which stays granted)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
with u as (
  update public.profiles set commission_percent = 25 where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344' returning id
)
select ('RESULT ' || json_build_object(
  'case', '07_admin_pay_update_returning_id',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
