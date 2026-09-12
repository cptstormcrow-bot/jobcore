-- 0034_price_sheet_archive.sql
--
-- archive_price_sheet(uuid) RPC: allows an org admin to manually retire a
-- published price sheet without publishing a replacement. This performs the
-- exact same published -> superseded, status-only transition that
-- price_sheets_immutable_trg (defined in 0005_money.sql) already permits --
-- see the comment above that trigger's definition. This migration does NOT
-- modify price_sheets_immutable_trg or price_sheets_immutable() in any way;
-- it only adds a new RPC that relies on the permission already carved out
-- for that transition.

-- security definer, stable search_path, and full schema-qualification
-- follow the same rationale as public.is_org_admin() / publish_price_sheet()
-- in 0005_money.sql.
create or replace function public.archive_price_sheet(p_price_sheet_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.price_sheets;
begin
  if not public.is_org_admin() then
    raise exception 'archive_price_sheet: caller is not an org admin';
  end if;

  select *
  into v_target
  from public.price_sheets
  where id = p_price_sheet_id
  for update;

  if not found then
    raise exception 'archive_price_sheet: price sheet not found (id=%)', p_price_sheet_id;
  end if;

  if v_target.organization_id <> public.current_org_id() then
    raise exception 'archive_price_sheet: price sheet does not belong to caller organization (id=%)', p_price_sheet_id;
  end if;

  if v_target.status <> 'published' then
    raise exception 'archive_price_sheet: price sheet is not published (id=%, status=%)', v_target.id, v_target.status;
  end if;

  update public.price_sheets
  set status = 'superseded'
  where id = v_target.id;
end;
$$;

revoke all on function public.archive_price_sheet(uuid) from public;
grant execute on function public.archive_price_sheet(uuid) to authenticated;
