-- 0063_service_task_pricing.sql — customer-facing price + free text per task.
-- service_tasks created 0032:20-26; estimated_minutes/rate/category/active
-- added 0046:5-9. Additive only; RLS service_tasks_admin_all (0032) unchanged.
alter table public.service_tasks
  add column if not exists price_cents integer,
  add column if not exists details text,
  add column if not exists materials text;
alter table public.service_tasks
  drop constraint if exists service_tasks_price_cents_check,
  add constraint service_tasks_price_cents_check check (price_cents is null or price_cents >= 0),
  drop constraint if exists service_tasks_details_len_check,
  add constraint service_tasks_details_len_check check (details is null or char_length(details) <= 2000),
  drop constraint if exists service_tasks_materials_len_check,
  add constraint service_tasks_materials_len_check check (materials is null or char_length(materials) <= 2000);
