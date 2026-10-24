-- Case 12 (reworded for migration 0111). The tech selects the other tech's commission_percent straight from public.profiles. Expected AFTER 0111: REJECTED with 42501 (permission denied for table profiles). Before 0111 it returned the value - that was the exposure 0111 closes (found 2026-10-24). Run only after 0110 and 0111 are applied, on Jeff's go. Never run before 0111: it would show the value, not an error.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}', true);
do $$
declare v text;
begin
  select commission_percent::text into v from public.profiles where id = '000b2b3c-d636-4bae-a6d3-bdb735bd4358';
  perform set_config('jobcore.case12', 'value:' || coalesce(v, ''), true);
exception when insufficient_privilege then
  perform set_config('jobcore.case12', 'denied', true);
end
$$;
select ('RESULT ' || json_build_object(
  'case', '12',
  'denied', current_setting('jobcore.case12') = 'denied',
  'value', nullif(substr(current_setting('jobcore.case12'), 7), '')
)::text)::int;
rollback;
