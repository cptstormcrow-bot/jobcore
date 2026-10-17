-- Jobcore - migration 0092 (extend): payments.method CHECK
--
-- STATIC-REVIEW MIGRATION. Written without touching any database. A live
-- push needs Jeff's explicit go. Adds zelle, venmo, debit, credit; legacy
-- card, ach, other stay allowed.

begin;

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method is null or method in ('cash', 'check', 'card', 'ach', 'paypal', 'other', 'zelle', 'venmo', 'debit', 'credit'));

commit;
