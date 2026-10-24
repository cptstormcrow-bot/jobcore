-- tech reads ANOTHER tech through employee_profiles_v; expected: rows_visible 1, full_name_seen not null, pay_columns_non_null 0 (all six pay columns masked to NULL)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '02_tech_view_colleague_pay_masked',
  'rows_visible', (select count(*) from public.employee_profiles_v where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'full_name_seen', (select full_name from public.employee_profiles_v where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'pay_columns_non_null', (
    select (hourly_rate_cents is not null)::int + (worker_type is not null)::int + (tech_role is not null)::int
         + (dev_pay_mode is not null)::int + (commission_enabled is not null)::int + (commission_percent is not null)::int
    from public.employee_profiles_v where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'
  ),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
