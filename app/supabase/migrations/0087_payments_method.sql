-- Jobcore - migration 0087: payments.method
--
-- STATIC-REVIEW MIGRATION. Written without touching any database. A live
-- push needs Jeff's explicit go.
--
-- Additive only: one nullable column on public.payments plus a named CHECK.
-- Legacy rows keep method = null. No RLS or policy changes; the existing
-- admin policies already gate writes to this table.

begin;

alter table public.payments add column if not exists method text;

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method is null or method in ('cash', 'check', 'card', 'ach', 'paypal', 'other'));

comment on column public.payments.method is
  'How the payment was received: cash, check, card, ach, paypal or other. Null for legacy rows recorded before this column existed.';

commit;
