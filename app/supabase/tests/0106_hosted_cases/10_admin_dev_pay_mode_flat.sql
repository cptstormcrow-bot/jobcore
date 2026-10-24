-- admin sets Dev Tech dev_pay_mode to flat; expected: REJECTED (23514, flat removed by 0107)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
with u as (
  update public.profiles set dev_pay_mode = 'flat' where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344' returning id
)
select ('RESULT ' || json_build_object(
  'case', '10_admin_dev_pay_mode_flat',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
