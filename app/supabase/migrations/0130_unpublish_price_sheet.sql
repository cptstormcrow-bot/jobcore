-- 0130_unpublish_price_sheet.sql — admin can send the live price sheet back to Draft (unpublish),
-- so sheets can be swapped in and out and a sheet can be edited and re-published.
-- Commissions snapshot amount_cents, so past pay does not move when a sheet is edited.

-- 1. Trigger: additionally allow the status-only published -> draft transition.
create or replace function public.price_sheets_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'price_sheets: cannot delete a % price sheet (id=%)', old.status, old.id;
    end if;
    return old;
  end if;

  -- tg_op = 'UPDATE'
  if old.status = 'draft' then
    return new;
  end if;

  if old.status = 'published' and new.status in ('superseded', 'draft')
     and new.id = old.id
     and new.organization_id = old.organization_id
     and new.version = old.version
     and new.effective_from is not distinct from old.effective_from
     and new.published_at is not distinct from old.published_at
     and new.created_at = old.created_at
  then
    return new;
  end if;

  raise exception 'price_sheets: cannot modify a % price sheet (id=%)', old.status, old.id;
end;
$$;

-- 2. RPC: unpublish_price_sheet(uuid) — published -> draft, admin only, own organization only.
create or replace function public.unpublish_price_sheet(p_price_sheet_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.price_sheets;
begin
  if not public.is_org_admin() then
    raise exception 'unpublish_price_sheet: caller is not an org admin';
  end if;

  select * into v_target
  from public.price_sheets
  where id = p_price_sheet_id
  for update;

  if not found then
    raise exception 'unpublish_price_sheet: price sheet not found (id=%)', p_price_sheet_id;
  end if;

  if v_target.organization_id <> public.current_org_id() then
    raise exception 'unpublish_price_sheet: price sheet does not belong to caller organization (id=%)', p_price_sheet_id;
  end if;

  if v_target.status <> 'published' then
    raise exception 'unpublish_price_sheet: price sheet is not published (id=%, status=%)', v_target.id, v_target.status;
  end if;

  update public.price_sheets
  set status = 'draft'
  where id = v_target.id;
end;
$$;

revoke all on function public.unpublish_price_sheet(uuid) from public;
grant execute on function public.unpublish_price_sheet(uuid) to authenticated;
