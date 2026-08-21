create or replace function public.approve_reimbursement(p_reimbursement_id uuid)
returns public.reimbursements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.reimbursements;
begin
  if not public.is_org_admin() then
    raise exception 'approve_reimbursement: admin role required';
  end if;

  select * into v_row from public.reimbursements where id = p_reimbursement_id for update;

  if not found then
    raise exception 'approve_reimbursement: reimbursement not found (id=%)', p_reimbursement_id;
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'approve_reimbursement: reimbursement % does not belong to current organization', p_reimbursement_id;
  end if;

  if v_row.status <> 'pending' then
    raise exception 'approve_reimbursement: cannot approve a % reimbursement (id=%)', v_row.status, p_reimbursement_id;
  end if;

  update public.reimbursements set status = 'approved' where id = p_reimbursement_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.approve_reimbursement(uuid) from public;
grant execute on function public.approve_reimbursement(uuid) to authenticated;

create or replace function public.reject_reimbursement(p_reimbursement_id uuid)
returns public.reimbursements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.reimbursements;
begin
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

  update public.reimbursements set status = 'rejected' where id = p_reimbursement_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.reject_reimbursement(uuid) from public;
grant execute on function public.reject_reimbursement(uuid) to authenticated;
