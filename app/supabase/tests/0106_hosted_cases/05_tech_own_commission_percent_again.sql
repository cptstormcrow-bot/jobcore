-- tech changes own commission_percent (replaces the flat_rate_cents case dropped by 0109); expected: BLOCKED (42501)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
with u as (
  update public.profiles set commission_percent = coalesce(commission_percent, 0) + 1 where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344' returning id
)
select ('RESULT ' || json_build_object(
  'case', '05_tech_own_commission_percent_again',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
