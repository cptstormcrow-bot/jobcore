-- admin reads a tech through employee_profiles_v; expected: rows_visible 1, full_name_seen not null, worker_type_seen not null (admin sees pay), pay_columns_non_null >= 1
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '03_admin_view_colleague_pay_visible',
  'rows_visible', (select count(*) from public.employee_profiles_v where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'full_name_seen', (select full_name from public.employee_profiles_v where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'worker_type_seen', (select worker_type from public.employee_profiles_v where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'pay_columns_non_null', (
    select (hourly_rate_cents is not null)::int + (worker_type is not null)::int + (tech_role is not null)::int
         + (dev_pay_mode is not null)::int + (commission_enabled is not null)::int + (commission_percent is not null)::int
    from public.employee_profiles_v where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'
  ),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
