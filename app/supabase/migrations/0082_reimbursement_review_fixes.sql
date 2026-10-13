-- Jobcore - migration 0082: reimbursement review fixes and lockdown
--
-- Visibility rule: a reimbursement is visible to org admins and to its
-- submitter only. No org-wide select policy exists and none may be added.
-- This migration creates and drops no policies.
--
-- Receipt requirement: deliberately NOT a CHECK constraint on
-- receipt_photo_path. It is enforced in the app layer so admin updates on
-- legacy rows with a null path keep working.

begin;

-- A) rejection reason column
alter table public.reimbursements add column if not exists rejection_reason text;

-- B) reject RPC with new signature (a changed argument list is a new
-- overload in Postgres, so drop the old one first).
drop function if exists public.reject_reimbursement(uuid);

create or replace function public.reject_reimbursement(
  p_reimbursement_id uuid,
  p_approved_by uuid default null,
  p_reason text default null
)
returns public.reimbursements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.reimbursements;
begin
  -- p_approved_by is accepted for client compatibility but IGNORED: a client
  -- must never name the approver. The approver is always auth.uid().
  if not public.is_org_admin() then
    raise exception 'reject_reimbursement: admin role required';
  end if;

  select * into v_row from public.reimbursements where id = p_reimbursement_id for update;

  if not found then
    raise exception 'reject_reimbursement: reimbursement not found (id=%)', p_reimbursement_id;
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'reject_reimbursement: reimbursement % does not belong to current organization', p_reimbursement_id;
  end if;

  if v_row.status <> 'pending' then
    raise exception 'reject_reimbursement: cannot reject a % reimbursement (id=%)', v_row.status, p_reimbursement_id;
  end if;

  update public.reimbursements
     set status = 'rejected',
         rejection_reason = nullif(btrim(p_reason), ''),
         approved_by = auth.uid(),
         approved_at = now(),
         updated_at = now()
   where id = p_reimbursement_id
  returning * into v_row;

  return v_row;
end;
$$;

-- C) mark paid RPC
create or replace function public.mark_reimbursement_paid(p_reimbursement_id uuid)
returns public.reimbursements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.reimbursements;
begin
  if not public.is_org_admin() then
    raise exception 'mark_reimbursement_paid: admin role required';
  end if;

  select * into v_row from public.reimbursements where id = p_reimbursement_id for update;

  if not found then
    raise exception 'mark_reimbursement_paid: reimbursement not found (id=%)', p_reimbursement_id;
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'mark_reimbursement_paid: reimbursement % does not belong to current organization', p_reimbursement_id;
  end if;

  if v_row.status <> 'approved' then
    raise exception 'reimbursement is not approved' using errcode = '22023';
  end if;

  -- No updated_at trigger exists on this table, so stamp it here.
  update public.reimbursements
     set status = 'paid',
         updated_at = now()
   where id = p_reimbursement_id
  returning * into v_row;

  return v_row;
end;
$$;

-- E) lockdown
alter table public.reimbursements enable row level security;

revoke all on table public.reimbursements from anon, public;

revoke all on function public.approve_reimbursement(uuid) from public, anon;
grant execute on function public.approve_reimbursement(uuid) to authenticated;

revoke all on function public.reject_reimbursement(uuid, uuid, text) from public, anon;
grant execute on function public.reject_reimbursement(uuid, uuid, text) to authenticated;

revoke all on function public.mark_reimbursement_paid(uuid) from public, anon;
grant execute on function public.mark_reimbursement_paid(uuid) to authenticated;

commit;
