-- admin updates the tech's hourly_rate_cents and active; expected: ALLOWED
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
with u as (
  update public.profiles set hourly_rate_cents = coalesce(hourly_rate_cents, 0) + 1, active = not active where id = 'd59e3bc7-691d-4ada-8959-e86f40c1e344' returning id
)
select ('RESULT ' || json_build_object(
  'case', '06_admin_updates_tech_rate_active',
  'rows_updated', (select count(*) from u),
  'current_user', current_user,
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
