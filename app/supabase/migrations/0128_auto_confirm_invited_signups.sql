-- Jobcore - migration 0128: invited signups are auto-confirmed
--
-- The live project requires email confirmation, so an invited tech or admin
-- who signed up could not sign in until they clicked a mail link that often
-- never arrived or expired ("Sign-in failed: email not confirmed").
--
-- An admin invitation already vouches for the email address, so
-- handle_new_user() (0075 body) now also stamps auth.users.email_confirmed_at
-- when it provisions a profile from an invitation. Signups with NO invitation
-- are unchanged: they stay unconfirmed and profile-less.
--
-- Also backfills accounts that signed up through an invitation earlier and are
-- still stuck unconfirmed (they have a profile row).

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
    insert into public.signup_attempts (user_id, email)
    values (new.id, new.email);

    return new;
  end if;

  insert into public.profiles (id, organization_id, full_name, role, email)
  values (new.id, invite.organization_id, invite.full_name, invite.role, new.email);

  update public.invitations
     set consumed_at = now()
   where id = invite.id;

  -- The invitation vouches for the email: confirm it so sign-in works at once.
  update auth.users
     set email_confirmed_at = coalesce(email_confirmed_at, now())
   where id = new.id;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

-- Backfill: invited accounts (they have a profile) stuck unconfirmed.
update auth.users u
   set email_confirmed_at = now()
 where u.email_confirmed_at is null
   and exists (select 1 from public.profiles p where p.id = u.id);
