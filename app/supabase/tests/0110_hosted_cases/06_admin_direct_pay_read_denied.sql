-- admin selects a tech's hourly_rate_cents straight from public.profiles; expected AFTER 0111: REJECTED (42501) - even admins read pay through employee_profiles_v
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '06_admin_direct_pay_read_denied',
  'hourly_rate_cents_seen', (select hourly_rate_cents from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358'),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
