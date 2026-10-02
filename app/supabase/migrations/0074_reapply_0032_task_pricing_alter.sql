-- Jobcore - migration 0074: re-apply 0032's adjustment_target ALTER
--
-- Fixes an ordering bug: 0032 ran before 0049 created
-- public.price_sheet_area_adjustments, so on a fresh `db reset` its ALTER
-- failed. 0032 now skips that ALTER when the table is missing; this migration
-- applies it once the table exists.
--
-- Idempotent: a no-op on a DB that already has the column and constraint
-- (e.g. hosted, where 0032 was already applied).

alter table public.price_sheet_area_adjustments
  add column if not exists adjustment_target text not null default 'total';

DO $guard$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'price_sheet_area_adjustments_target_check'
      AND conrelid = 'public.price_sheet_area_adjustments'::regclass
  ) THEN
    alter table public.price_sheet_area_adjustments
      add constraint price_sheet_area_adjustments_target_check
      check (adjustment_target in ('materials', 'labor', 'total'));
  END IF;
END $guard$;
