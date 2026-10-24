-- tech selects another tech's commission_percent straight from public.profiles; expected AFTER 0111: REJECTED (42501 permission denied for table profiles). Before 0111 it returned the value (the exposure this migration closes).
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '04_tech_direct_pay_read_denied',
  'commission_percent_seen', (select commission_percent from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
