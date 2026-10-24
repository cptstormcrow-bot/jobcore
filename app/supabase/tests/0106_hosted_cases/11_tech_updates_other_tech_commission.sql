-- tech changes another tech's commission_percent; expected: ZERO ROWS or BLOCKED (42501)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
with u as (
  update public.profiles set commission_percent = 5 where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358' returning id
)
select ('RESULT ' || json_build_object(
  'case', '11_tech_updates_other_tech_commission',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
