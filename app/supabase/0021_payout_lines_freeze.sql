-- NOTE: reconstructed post-hoc from what was executed live in Supabase; verify payout_lines insert column list against actual table schema before relying on this file as the migration source of truth.
alter table public.payout_lines
  add column if not exists source_hash text;

create or replace function public.create_payout_batch(
  p_period_start date,
  p_period_end date,
  p_lines jsonb
)
returns public.payout_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.payout_batches;
  v_line jsonb;
begin
  if not public.is_org_admin() then
    raise exception 'create_payout_batch: admin role required';
  end if;

  insert into public.payout_batches (organization_id, period_start, period_end, status)
  values (public.current_org_id(), p_period_start, p_period_end, 'draft')
  returning * into v_batch;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    insert into public.payout_lines (batch_id, organization_id, source_hash, amount_cents, payload)
    values (
      v_batch.id,
      public.current_org_id(),
      v_line->>'source_hash',
      (v_line->>'amount_cents')::bigint,
      v_line
    );
  end loop;

  return v_batch;
end;
$$;

revoke all on function public.create_payout_batch(date, date, jsonb) from public;
grant execute on function public.create_payout_batch(date, date, jsonb) to authenticated;
