create or replace function public.resolve_close_out_failure_manual(p_failure_id uuid, p_note text default null)
returns public.close_out_failures
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.close_out_failures;
begin
  if not public.is_org_admin() then
    raise exception 'resolve_close_out_failure_manual: admin role required';
  end if;

  select * into v_row from public.close_out_failures where id = p_failure_id for update;

  if not found then
    raise exception 'resolve_close_out_failure_manual: close out failure not found (id=%)', p_failure_id;
  end if;

  if v_row.organization_id <> public.current_org_id() then
    raise exception 'resolve_close_out_failure_manual: close out failure % does not belong to current organization', p_failure_id;
  end if;

  if v_row.status not in ('open', 'retrying') then
    raise exception 'resolve_close_out_failure_manual: cannot resolve a % close out failure (id=%)', v_row.status, p_failure_id;
  end if;

  update public.close_out_failures
  set resolved_by = auth.uid(),
      resolved_at = now(),
      status = 'resolved_manual',
      resolution_note = p_note,
      updated_at = now()
  where id = p_failure_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.resolve_close_out_failure_manual(uuid, text) from public;
grant execute on function public.resolve_close_out_failure_manual(uuid, text) to authenticated;
