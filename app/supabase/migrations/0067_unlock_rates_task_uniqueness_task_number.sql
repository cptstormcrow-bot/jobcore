-- 0067: unlock price_sheet_rates for published sheets + service_tasks.task_number
-- (a) price_sheet_rates_immutable_trg (0005_money.sql:305-307, function at
--     0005_money.sql:280-303) blocked updates/deletes on rates once the parent
--     price sheet left 'draft'. Jeff decision 2026-09-25 "Unlock published
--     sheets": rates on published sheets must now be directly editable, so the
--     trigger and its function are dropped. RLS (price_sheet_rates_admin_all,
--     0005_money.sql:483-501) is unaffected and still scopes writes to org
--     admins on the parent sheet's organization.
-- (b) price_sheet_rates_sheet_service_timing_idx (0005_money.sql:116-117) did
--     not account for task_id (added 0066), so two rows differing only by
--     task_id could not both exist under the old index once task_id was
--     compared; replaced with an index that includes task_id and treats NULLs
--     as equal (nulls not distinct), matching the old index's NULL-collapsing
--     behavior for attach_timing.
-- (c) service_tasks.task_number: a stable, human-facing sequential identifier
--     for service_tasks rows, independent of the uuid primary key.

-- ---------------------------------------------------------------------------
-- 1. Guard: refuse to proceed if duplicate groups already exist under the
--    new uniqueness definition (NULLs treated as equal, matching
--    "nulls not distinct").
-- ---------------------------------------------------------------------------
do $$
declare
  v_dupe_groups integer;
begin
  select count(*) into v_dupe_groups
  from (
    select price_sheet_id, service_id, attach_timing, task_id
    from public.price_sheet_rates
    group by price_sheet_id, service_id, attach_timing, task_id
    having count(*) > 1
  ) d;

  if v_dupe_groups > 0 then
    raise exception 'price_sheet_rates: % duplicate group(s) found under (price_sheet_id, service_id, attach_timing, task_id); resolve before running 0067', v_dupe_groups;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Replace the rate-uniqueness index to include task_id.
-- ---------------------------------------------------------------------------
drop index if exists public.price_sheet_rates_sheet_service_timing_idx;

create unique index price_sheet_rates_sheet_service_timing_task_idx
  on public.price_sheet_rates (price_sheet_id, service_id, attach_timing, task_id)
  nulls not distinct;

-- ---------------------------------------------------------------------------
-- 3. Drop the immutability trigger and its function.
--    Jeff decision 2026-09-25 "Unlock published sheets".
-- ---------------------------------------------------------------------------
drop trigger if exists price_sheet_rates_immutable_trg on public.price_sheet_rates;
drop function if exists public.price_sheet_rates_immutable();

-- ---------------------------------------------------------------------------
-- 4. service_tasks.task_number
-- ---------------------------------------------------------------------------
alter table public.service_tasks
  add column if not exists task_number bigint;

-- 4a. Backfill from the UUID's 5th hyphen-group where it already encodes a
--     6-digit task number in the low 6 digits (tail pattern 000000NNNNNN).
--     If two rows share the same tail, only the earliest (by created_at,
--     then id, since service_tasks has no updated_at column) takes it.
with tail_matches as (
  select
    id,
    split_part(id::text, '-', 5) as tail,
    row_number() over (
      partition by split_part(id::text, '-', 5)
      order by created_at, id
    ) as rn
  from public.service_tasks
  where task_number is null
    and split_part(id::text, '-', 5) ~ '^0{6}[0-9]{6}$'
)
update public.service_tasks st
set task_number = (right(tm.tail, 6))::bigint
from tail_matches tm
where st.id = tm.id
  and tm.rn = 1;

-- 4b. Sequentially number whatever is still NULL, continuing after the
--     current max, ordered the same way.
with remaining as (
  select
    id,
    row_number() over (order by created_at, id) as rn
  from public.service_tasks
  where task_number is null
),
base as (
  select coalesce(max(task_number), 0) as v_base from public.service_tasks
)
update public.service_tasks st
set task_number = base.v_base + remaining.rn
from remaining, base
where st.id = remaining.id;

-- 4c. Backing sequence for future inserts.
create sequence if not exists public.service_tasks_task_number_seq
  owned by public.service_tasks.task_number;

do $$
declare
  v_max bigint;
begin
  select max(task_number) into v_max from public.service_tasks;

  if v_max is null then
    perform setval('public.service_tasks_task_number_seq', 1, false);
  else
    perform setval('public.service_tasks_task_number_seq', v_max, true);
  end if;
end;
$$;

alter table public.service_tasks
  alter column task_number set default nextval('public.service_tasks_task_number_seq');

alter table public.service_tasks
  alter column task_number set not null;

create unique index if not exists service_tasks_task_number_idx
  on public.service_tasks (task_number);

grant usage, select on sequence public.service_tasks_task_number_seq to authenticated;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Rollback notes:
--   - Re-create price_sheet_rates_immutable() and price_sheet_rates_immutable_trg
--     exactly as defined in 0005_money.sql:280-307.
--   - Drop price_sheet_rates_sheet_service_timing_task_idx and re-create
--     price_sheet_rates_sheet_service_timing_idx as defined in
--     0005_money.sql:116-117 (only safe if no rows rely on task_id
--     differentiation added after this migration).
--   - service_tasks.task_number: drop default, drop not null, drop
--     service_tasks_task_number_idx, drop service_tasks_task_number_seq,
--     drop column task_number. Any external reference to task_number values
--     is lost on rollback.
