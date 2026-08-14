-- Jobcore - RLS assertions for 0012_marketing.sql (P6 - sales/marketing module)
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0012 and seed.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- CROSS-SUITE SCOPE NOTE (see .crib/a3a-f-suite-split.md "Cross-suite
-- coordination flags"): `job_photos` is also touched by suite 0007 and
-- `reviews` is also touched by suite 0010. This file covers ONLY the
-- policies 0012 itself adds: `job_photos_select_sales` and
-- `reviews_select_sales` / `reviews_update_sort_sales`. It does NOT re-probe
-- 0007's `job_photos_admin_all` / `_select_tech` / `_insert_tech`, nor
-- 0010's `reviews_admin_all` / `reviews_insert_anon` -- those stay in
-- 0007_field_tech_tables_rls and 0010_payment_review_rls respectively.

begin;

-- ---------------------------------------------------------------------------
-- Shared fixtures: one job_photo and two reviews (published / unpublished)
-- planted under `reset role` so the sales-visibility probes below have rows
-- to actually find. Reuses job ...601 (org A, tech-assigned) from seed.sql.
-- ---------------------------------------------------------------------------
do $$
begin
  reset role;

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at, customer_consent)
  values (
    '00000000-0000-4000-8000-000000000c01',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000103',
    'after',
    'test/fixture-c01.jpg',
    now(),
    true
  )
  on conflict (id) do nothing;

  insert into public.reviews (id, organization_id, job_id, rating, platform, publish_ok)
  values
    ('00000000-0000-4000-8000-000000000d01', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 5, 'internal', true),
    ('00000000-0000-4000-8000-000000000d02', '00000000-0000-4000-8000-000000000001',
     '00000000-0000-4000-8000-000000000601', 3, 'internal', false)
  on conflict (id) do nothing;

  if (select count(*) from public.job_photos where id = '00000000-0000-4000-8000-000000000c01') <> 1 then
    raise exception 'FIXTURE FAILED: job_photos ...c01 did not plant';
  end if;

  if (select count(*) from public.reviews where id in ('00000000-0000-4000-8000-000000000d01','00000000-0000-4000-8000-000000000d02')) <> 2 then
    raise exception 'FIXTURE FAILED: reviews ...d01/...d02 did not plant';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.1 - marketing_assets_all_sales: sales creates an asset referencing
-- the fixture photo (positive write path).
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  insert into public.marketing_assets (id, organization_id, job_photo_id, approved_for_public)
  values ('00000000-0000-4000-8000-000000000e01', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000c01', true)
  on conflict (id) do nothing;

  select count(*) into seen from public.marketing_assets where id = '00000000-0000-4000-8000-000000000e01';

  if seen <> 1 then
    raise exception 'AC-12.1 FAILED: sales@ could not create/select a marketing_assets row in own org, saw %', seen;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.1b - marketing_assets_all_sales: a tech (not sales-or-above) cannot
-- insert into marketing_assets.
-- ---------------------------------------------------------------------------
do $$
declare
  blocked boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.marketing_assets (id, organization_id, review_id, approved_for_public)
    values ('00000000-0000-4000-8000-000000000e02', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000d01', true);
  exception
    when others then
      blocked := true;
  end;

  if not blocked then
    raise exception 'AC-12.1b FAILED: tech@ inserted into marketing_assets - is_org_sales_or_above() is not gating writes';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.1c - marketing_assets_all_sales is tenant-scoped: a synthetic Org B
-- asset (planted with RLS bypassed) is invisible to Org A's sales user, both
-- by bulk select and by point lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  reset role;

  insert into public.organizations (id, name, slug)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe', 'org-b-isolation-probe')
  on conflict (id) do nothing;

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
  values ('00000000-0000-4000-8000-000000000cb2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000006b2', '00000000-0000-4000-8000-000000000103',
          'after', 'test/fixture-cb2.jpg', now())
  on conflict (id) do nothing;

  insert into public.marketing_assets (id, organization_id, job_photo_id, approved_for_public)
  values ('00000000-0000-4000-8000-000000000eb2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-000000000cb2', true)
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  select count(*) into leaked from public.marketing_assets where id = '00000000-0000-4000-8000-000000000eb2';

  if leaked <> 0 then
    raise exception 'AC-12.1c FAILED: sales@ resolved an org B marketing_assets row by id - tenant boundary leaked';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.2 - post_drafts_all_sales: sales creates a draft (positive); tech
-- cannot (negative).
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  insert into public.post_drafts (id, organization_id, status)
  values ('00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-000000000001', 'draft')
  on conflict (id) do nothing;

  select count(*) into seen from public.post_drafts where id = '00000000-0000-4000-8000-000000000f01';

  if seen <> 1 then
    raise exception 'AC-12.2 FAILED: sales@ could not create/select a post_drafts row in own org, saw %', seen;
  end if;
end $$;

do $$
declare
  blocked boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.post_drafts (id, organization_id, status)
    values ('00000000-0000-4000-8000-000000000f02', '00000000-0000-4000-8000-000000000001', 'draft');
  exception
    when others then
      blocked := true;
  end;

  if not blocked then
    raise exception 'AC-12.2b FAILED: tech@ inserted into post_drafts - is_org_sales_or_above() is not gating writes';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.3 - post_draft_assets_all_sales: sales attaches the approved,
-- consented asset to the draft (positive, RLS-level not trigger-level);
-- tech is blocked before the trigger even runs.
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  insert into public.post_draft_assets (id, organization_id, draft_id, asset_id)
  values ('00000000-0000-4000-8000-000000001001', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-000000000e01')
  on conflict (id) do nothing;

  select count(*) into seen from public.post_draft_assets where id = '00000000-0000-4000-8000-000000001001';

  if seen <> 1 then
    raise exception 'AC-12.3 FAILED: sales@ could not attach a consented/approved asset to own draft, saw %', seen;
  end if;
end $$;

do $$
declare
  blocked boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.post_draft_assets (id, organization_id, draft_id, asset_id)
    values ('00000000-0000-4000-8000-000000001002', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-000000000e01');
  exception
    when others then
      blocked := true;
  end;

  if not blocked then
    raise exception 'AC-12.3b FAILED: tech@ inserted into post_draft_assets - is_org_sales_or_above() is not gating writes';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.4 - post_targets_all_sales: sales targets a platform for the draft
-- (positive); tech is blocked (negative).
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  insert into public.post_targets (id, organization_id, draft_id, platform)
  values ('00000000-0000-4000-8000-000000001101', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000f01', 'facebook')
  on conflict (id) do nothing;

  select count(*) into seen from public.post_targets where id = '00000000-0000-4000-8000-000000001101';

  if seen <> 1 then
    raise exception 'AC-12.4 FAILED: sales@ could not create a post_targets row on own draft, saw %', seen;
  end if;
end $$;

do $$
declare
  blocked boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  begin
    insert into public.post_targets (id, organization_id, draft_id, platform)
    values ('00000000-0000-4000-8000-000000001102', '00000000-0000-4000-8000-000000000001',
            '00000000-0000-4000-8000-000000000f01', 'instagram');
  exception
    when others then
      blocked := true;
  end;

  if not blocked then
    raise exception 'AC-12.4b FAILED: tech@ inserted into post_targets - is_org_sales_or_above() is not gating writes';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.5 - campaign_log: sales selects/inserts (positive); tech's select
-- sees zero rows (negative); the table is append-only, so an authenticated
-- update/delete from sales affects zero rows regardless of role (no policy
-- exists for either verb -- absence of a policy is a denial).
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  insert into public.campaign_log (organization_id, draft_id, channel, status)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000f01', 'manual', 'posted');

  select count(*) into seen from public.campaign_log where draft_id = '00000000-0000-4000-8000-000000000f01';

  if seen <> 1 then
    raise exception 'AC-12.5 FAILED: sales@ could not insert/select own-org campaign_log row, saw %', seen;
  end if;
end $$;

do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated"}';

  select count(*) into seen from public.campaign_log where draft_id = '00000000-0000-4000-8000-000000000f01';

  if seen <> 0 then
    raise exception 'AC-12.5b FAILED: tech@ sees % campaign_log row(s), expected 0 - is_org_sales_or_above() is not gating select', seen;
  end if;
end $$;

do $$
declare
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  update public.campaign_log set status = 'tampered' where draft_id = '00000000-0000-4000-8000-000000000f01';
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-12.5c FAILED: update affected % campaign_log row(s), expected 0 - an UPDATE policy exists where none should', affected;
  end if;

  delete from public.campaign_log where draft_id = '00000000-0000-4000-8000-000000000f01';
  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'AC-12.5d FAILED: delete affected % campaign_log row(s), expected 0 - a DELETE policy exists where none should', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.6 - job_photos_select_sales (0012's own addition, no consent
-- filter): sales sees the org's photo fixture; the org B photo stays
-- invisible. 0007's own admin/tech policies on this table are out of scope
-- here.
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  select count(*) into seen from public.job_photos where id = '00000000-0000-4000-8000-000000000c01';
  if seen <> 1 then
    raise exception 'AC-12.6 FAILED: sales@ does not see the own-org job_photos fixture, saw %', seen;
  end if;

  select count(*) into leaked from public.job_photos where id = '00000000-0000-4000-8000-000000000cb2';
  if leaked <> 0 then
    raise exception 'AC-12.6b FAILED: sales@ resolved an org B job_photos row by id - job_photos_select_sales dropped its organization_id predicate';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.7 - reviews_select_sales (0012's own predicate: publish_ok = true
-- on top of org scoping): sales sees the published review, not the
-- unpublished one. 0010's admin_all/insert_anon policies are out of scope
-- here.
-- ---------------------------------------------------------------------------
do $$
declare
  seen_published integer;
  seen_unpublished integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  select count(*) into seen_published from public.reviews where id = '00000000-0000-4000-8000-000000000d01';
  if seen_published <> 1 then
    raise exception 'AC-12.7 FAILED: sales@ does not see the published review, saw %', seen_published;
  end if;

  select count(*) into seen_unpublished from public.reviews where id = '00000000-0000-4000-8000-000000000d02';
  if seen_unpublished <> 0 then
    raise exception 'AC-12.7b FAILED: sales@ sees the unpublished review, expected the publish_ok=true predicate to hide it';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.8 - reviews_update_sort_sales + reviews_sales_sort_whitelist_trg:
-- sales may reorder (sort_order only); any other column change from a
-- non-admin caller is rejected by the trigger.
-- ---------------------------------------------------------------------------
do $$
declare
  new_sort integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  update public.reviews set sort_order = 7 where id = '00000000-0000-4000-8000-000000000d01';

  select sort_order into new_sort from public.reviews where id = '00000000-0000-4000-8000-000000000d01';
  if new_sort <> 7 then
    raise exception 'AC-12.8 FAILED: sales@ could not update sort_order on own-org published review, saw %', new_sort;
  end if;
end $$;

do $$
declare
  blocked boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  begin
    update public.reviews set rating = 1 where id = '00000000-0000-4000-8000-000000000d01';
  exception
    when others then
      blocked := true;
  end;

  if not blocked then
    raise exception 'AC-12.8b FAILED: sales@ changed reviews.rating - reviews_sales_sort_whitelist_trg did not reject a non-sort_order column change';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.9 - social_providers_admin_all + social_providers_select_sales:
-- admin writes, sales reads but cannot write.
-- ---------------------------------------------------------------------------
do $$
declare
  seen integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  insert into public.social_providers (id, organization_id, provider_id, platform, enabled)
  values ('00000000-0000-4000-8000-000000001201', '00000000-0000-4000-8000-000000000001',
          'meta-fb-test', 'facebook', true)
  on conflict (id) do nothing;

  select count(*) into seen from public.social_providers where id = '00000000-0000-4000-8000-000000001201';
  if seen <> 1 then
    raise exception 'AC-12.9 FAILED: admin@ could not create/select a social_providers row, saw %', seen;
  end if;
end $$;

do $$
declare
  seen integer;
  blocked boolean := false;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000104","role":"authenticated"}';

  select count(*) into seen from public.social_providers where id = '00000000-0000-4000-8000-000000001201';
  if seen <> 1 then
    raise exception 'AC-12.9b FAILED: sales@ does not see the org social_providers row via social_providers_select_sales, saw %', seen;
  end if;

  begin
    update public.social_providers set enabled = false where id = '00000000-0000-4000-8000-000000001201';
  exception
    when others then
      blocked := true;
  end;

  if not blocked then
    raise exception 'AC-12.9c FAILED: sales@ updated social_providers - social_providers_select_sales is select-only and admin_all should still gate writes';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- AC-12.10 - social_provider_credentials: RLS enabled, zero policies for any
-- role (absence-of-policy canary, mirroring audit_log). A row planted with
-- RLS bypassed is invisible to every authenticated caller, including admin.
-- ---------------------------------------------------------------------------
do $$
declare
  policy_count integer;
  leaked integer;
begin
  reset role;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public' and tablename = 'social_provider_credentials';

  if policy_count <> 0 then
    raise exception 'AC-12.10 FAILED: social_provider_credentials has % policies, expected exactly 0', policy_count;
  end if;

  insert into public.social_provider_credentials (id, organization_id, provider_id, access_token)
  values ('00000000-0000-4000-8000-000000001301', '00000000-0000-4000-8000-000000000001',
          'meta-fb-test', 'test-token-value')
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}';

  select count(*) into leaked from public.social_provider_credentials where id = '00000000-0000-4000-8000-000000001301';

  if leaked <> 0 then
    raise exception 'AC-12.10b FAILED: admin@ resolved a social_provider_credentials row - a policy exists where none should';
  end if;
end $$;

-- Nothing above is meant to persist.
rollback;
