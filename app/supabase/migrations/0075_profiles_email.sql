-- Jobcore - migration 0075: profiles.email, tied to the login email
--
-- Adds public.profiles.email so the employee detail editor can show the login
-- email. It is kept in step with auth.users.email:
--   * backfilled once from auth.users,
--   * set at signup by handle_new_user() (0003 body + email),
--   * re-synced by sync_profile_email() when auth.users.email changes.
--
-- Idempotent: safe to re-run. The on_auth_user_created trigger from 0003 is
-- unchanged (create or replace on the function keeps the trigger bound).

alter table public.profiles
  add column if not exists email text;

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id;

-- handle_new_user(): body copied from 0003 (newest definition); the only
-- change is email in the profiles insert. security definer + empty
-- search_path preserved, so every identifier stays schema-qualified.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.invitations%rowtype;
begin
  select *
    into invite
    from public.invitations
   where lower(email) = lower(new.email)
     and consumed_at is null
   order by created_at desc
   limit 1;

  if invite.id is null then
    -- No invitation: log the attempt and let the auth user exist WITHOUT a
    -- profile (see 0003 for the full rationale).
    insert into public.signup_attempts (user_id, email)
    values (new.id, new.email);

    return new;
  end if;

  insert into public.profiles (id, organization_id, full_name, role, email)
  values (new.id, invite.organization_id, invite.full_name, invite.role, new.email);

  update public.invitations
     set consumed_at = now()
   where id = invite.id;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

-- Keep profiles.email in step when the login email changes.
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id;
  return new;
end;
$$;

revoke all on function public.sync_profile_email() from public;

drop trigger if exists profiles_email_sync on auth.users;
create trigger profiles_email_sync
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();

create index if not exists profiles_email_lower_idx
  on public.profiles (lower(email));
