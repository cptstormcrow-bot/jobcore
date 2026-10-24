-- tech reads OWN row through employee_profiles_v; expected: rows_visible 1 and own pay columns UNMASKED (worker_type_seen not null)
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '01_tech_view_own_pay_visible',
  'rows_visible', (select count(*) from public.employee_profiles_v where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'),
  'worker_type_seen', (select worker_type from public.employee_profiles_v where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'),
  'tech_role_seen', (select tech_role from public.employee_profiles_v where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'),
  'dev_pay_mode_seen', (select dev_pay_mode from public.employee_profiles_v where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'),
  'commission_enabled_seen', (select commission_enabled from public.employee_profiles_v where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'),
  'commission_percent_seen', (select commission_percent from public.employee_profiles_v where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'),
  'hourly_rate_cents_seen', (select hourly_rate_cents from public.employee_profiles_v where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344'),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
