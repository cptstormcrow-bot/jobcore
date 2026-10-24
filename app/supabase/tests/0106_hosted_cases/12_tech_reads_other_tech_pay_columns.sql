-- tech reads another tech's pay columns (documents profiles_select_own_org exposure; not a fix); expected: INFORMATIONAL
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '12_tech_reads_other_tech_pay_columns',
  'rows_visible', (select count(*) from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'commission_percent_seen', (select commission_percent from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
