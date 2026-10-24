-- catalog canary (no row data); expected AFTER 0111: profiles_cols 22, view_cols 22, only_in_profiles 0, only_in_view 0, pay_cols_selectable 0, open_cols_selectable 16
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}', true);
select ('RESULT ' || json_build_object(
  'case', '08_canary_column_sets_match',
  'profiles_cols', (select count(*) from pg_attribute where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped),
  'view_cols', (select count(*) from pg_attribute where attrelid = 'public.employee_profiles_v'::regclass and attnum > 0 and not attisdropped),
  'only_in_profiles', (select count(*) from (
    select attname from pg_attribute where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
    except
    select attname from pg_attribute where attrelid = 'public.employee_profiles_v'::regclass and attnum > 0 and not attisdropped
  ) d),
  'only_in_view', (select count(*) from (
    select attname from pg_attribute where attrelid = 'public.employee_profiles_v'::regclass and attnum > 0 and not attisdropped
    except
    select attname from pg_attribute where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped
  ) d),
  'pay_cols_selectable', (select count(*) from unnest(array['hourly_rate_cents','worker_type','tech_role','dev_pay_mode','commission_enabled','commission_percent']) c
    where has_column_privilege('authenticated', 'public.profiles', c, 'select')),
  'open_cols_selectable', (select count(*) from unnest(array['id','organization_id','full_name','phone','email','role','active','created_at','is_test','address','drivers_license_number','vehicle_status','tool_status','paid_travel','paid_travel_policy_message','test_jobs_only']) c
    where has_column_privilege('authenticated', 'public.profiles', c, 'select')),
  'jwt_sub', auth.uid()
)::text)::int;
rollback;
