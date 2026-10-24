-- tech selects only the granted (non-pay) columns of another tech straight from public.profiles; expected AFTER 0111: works, rows_visible 1, full_name_seen not null
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '05_tech_direct_open_columns_ok',
  'rows_visible', (select count(*) from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'full_name_seen', (select full_name from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'role_seen', (select role from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'active_seen', (select active from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
