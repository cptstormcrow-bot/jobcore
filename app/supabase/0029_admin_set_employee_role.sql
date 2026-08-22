-- Jobcore — admin employee-role change RPC.
-- Apply after 0028.

-- 0002_profiles_role_column_guard.sql revokes `update (role)` on
-- public.profiles from authenticated, so an ordinary client update can never
-- change a profile's role directly. This RPC is the sanctioned path an admin
-- uses to change a teammate's role despite that revoke: it runs as the
-- function owner via security definer, so it can write the role column
-- itself while every caller still goes through the admin-authorization and
-- org-match guards below.
--
-- security definer, stable search_path, row lock via `for update`, and full
-- schema-qualification follow the same rationale as public.is_org_admin()
-- and public.publish_price_sheet() in 0005_money.sql.
create or replace function public.admin_set_employee_role(
  p_profile_id uuid,
  p_new_role public.user_role
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if not public.is_org_admin() then
    raise exception 'admin_set_employee_role: admin role required';
  end if;

  select * into v_profile from public.profiles where id = p_profile_id for update;

  if not found then
    raise exception 'admin_set_employee_role: profile not found (id=%)', p_profile_id;
  end if;

  if v_profile.organization_id <> public.current_org_id() then
    raise exception 'admin_set_employee_role: profile % does not belong to current organization', p_profile_id;
  end if;

  update public.profiles set role = p_new_role where id = p_profile_id
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.admin_set_employee_role(uuid, public.user_role) from public;
grant execute on function public.admin_set_employee_role(uuid, public.user_role) to authenticated;
