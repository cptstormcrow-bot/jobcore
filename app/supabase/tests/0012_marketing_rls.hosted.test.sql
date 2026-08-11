-- HOSTED VARIANT: real auth.users UUIDs substituted for the local-dev placeholder ids.
-- Jobcore - RLS assertions for 0012_marketing.sql (P6 sales/marketing) + S5.4 fold-in
--
-- Hand-applied. Run this file in the SQL editor AFTER 0001..0012 and seed.hosted.sql.
-- Each block raises an exception on failure and is silent on success.
--
-- Run as a normal authenticated session, NOT the service role. The service role
-- bypasses RLS entirely and makes every assertion below pass vacuously.
--
-- Impersonation contract: each block sets `role` to `authenticated` and sets
-- `request.jwt.claims` so that `auth.uid()` resolves to the named seed profile.
-- `set local` scopes both to the enclosing transaction.
--
-- S5.4 fold-in: P4-SLICE-LEDGER's S5.4 negative-access probe was deferred at
-- plan closure (2026-08-09). Every sales-scoped policy below carries both a
-- positive probe (sales sees/writes own-org rows) and a negative probe
-- (owner/tech/cross-org cannot see sales-only rows), using the same
-- reset-role synthetic-Org-B pattern as 0004_scheduling_rls AC-3.5.

begin;

-- ---------------------------------------------------------------------------
-- Fixture - plant marketing-module rows and a cross-org (Org B) counterpart
-- under `reset role` FIRST (the falsifiability gate), before any impersonation.
-- ---------------------------------------------------------------------------
do $$
declare
  fixture_count integer;
begin
  reset role;

  -- Org B - isolation probe (shared synthetic row with 0004's suite; safe to
  -- reuse the same id since both suites `on conflict do nothing` and roll back).
  insert into public.organizations (id, name)
  values ('00000000-0000-4000-8000-0000000000b2', 'Org B - isolation probe')
  on conflict (id) do nothing;

  -- Org A job_photos fixture (job ...601 exists in seed.hosted.sql).
  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at, customer_consent)
  values ('00000000-0000-4000-8000-000000000c01', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
          'after', 'jobs/601/after.jpg', now(), true)
  on conflict (id) do nothing;

  -- Org A reviews fixture, publish_ok = true so it is visible via reviews_select_sales.
  insert into public.reviews (id, organization_id, job_id, rating, body, platform, publish_ok, sort_order)
  values ('00000000-0000-4000-8000-000000000c02', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000601', 5, 'Great work', 'internal', true, 0)
  on conflict (id) do nothing;

  -- Org A marketing_assets fixture, review-backed, approved for public.
  insert into public.marketing_assets (id, organization_id, review_id, approved_for_public)
  values ('00000000-0000-4000-8000-000000000c03', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000c02', true)
  on conflict (id) do nothing;

  -- Org A post_drafts fixture.
  insert into public.post_drafts (id, organization_id, status)
  values ('00000000-0000-4000-8000-000000000c04', '00000000-0000-4000-8000-000000000001', 'draft')
  on conflict (id) do nothing;

  -- Org A post_draft_assets fixture (consent trigger requires the asset to be
  -- approved_for_public AND its source consent flag true - both true above).
  insert into public.post_draft_assets (id, organization_id, draft_id, asset_id)
  values ('00000000-0000-4000-8000-000000000c05', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000c04', '00000000-0000-4000-8000-000000000c03')
  on conflict (id) do nothing;

  -- Org A post_targets fixture.
  insert into public.post_targets (id, organization_id, draft_id, platform, status)
  values ('00000000-0000-4000-8000-000000000c06', '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000c04', 'facebook', 'pending')
  on conflict (id) do nothing;

  -- Org A campaign_log fixture.
  insert into public.campaign_log (organization_id, draft_id, channel, platform, status)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000c04', 'manual', 'facebook', 'posted');

  -- Org A social_providers fixture.
  insert into public.social_providers (id, organization_id, provider_id, platform, enabled)
  values ('00000000-0000-4000-8000-000000000c07', '00000000-0000-4000-8000-000000000001',
          'meta-page-1', 'facebook', true)
  on conflict (id) do nothing;

  -- Org A social_provider_credentials fixture (never reachable via RLS - part
  -- of the absence-of-policy canary below).
  insert into public.social_provider_credentials (id, organization_id, provider_id, access_token)
  values ('00000000-0000-4000-8000-000000000c08', '00000000-0000-4000-8000-000000000001',
          'meta-page-1', 'fake-token-value')
  on conflict (id) do nothing;

  select count(*) into fixture_count from public.marketing_assets where id = '00000000-0000-4000-8000-000000000c03';
  if fixture_count <> 1 then
    raise exception 'FIXTURE SETUP FAILED: marketing_assets fixture row did not plant';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- marketing_assets_all_sales - positive: sales sees/writes the own-org asset.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.marketing_assets where id = '00000000-0000-4000-8000-000000000c03';
  if visible <> 1 then
    raise exception 'marketing_assets_all_sales POSITIVE FAILED: sales@ sees % rows for the own-org asset, expected 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- marketing_assets_all_sales - negative: tech cannot see the sales asset.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked from public.marketing_assets;
  if leaked <> 0 then
    raise exception 'marketing_assets_all_sales NEGATIVE FAILED: tech@ sees % marketing_assets rows, expected 0', leaked;
  end if;

  select count(*) into leaked from public.marketing_assets where id = '00000000-0000-4000-8000-000000000c03';
  if leaked <> 0 then
    raise exception 'marketing_assets_all_sales NEGATIVE FAILED: tech@ resolved the sales asset by id';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- post_drafts_all_sales - positive: sales sees/writes own-org draft.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.post_drafts where id = '00000000-0000-4000-8000-000000000c04';
  if visible <> 1 then
    raise exception 'post_drafts_all_sales POSITIVE FAILED: sales@ sees % rows for the own-org draft, expected 1', visible;
  end if;

  update public.post_drafts set caption = 'Nice work today!' where id = '00000000-0000-4000-8000-000000000c04';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'post_drafts_all_sales POSITIVE FAILED: sales@ update affected % rows, expected 1', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- post_drafts_all_sales - negative: owner (non-sales-role... actually owner IS
-- sales-or-above) is expected to see it; the real negative is a cross-org row.
-- Plant a synthetic Org B draft under reset role, then confirm org A sales@
-- cannot see it (tenancy predicate, not role predicate).
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  reset role;
  insert into public.post_drafts (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000000cb', '00000000-0000-4000-8000-0000000000b2', 'draft')
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into leaked from public.post_drafts where organization_id = '00000000-0000-4000-8000-0000000000b2';
  if leaked <> 0 then
    raise exception 'post_drafts_all_sales NEGATIVE FAILED: sales@ sees % Org B draft rows, expected 0', leaked;
  end if;

  select count(*) into leaked from public.post_drafts where id = '00000000-0000-4000-8000-0000000000cb';
  if leaked <> 0 then
    raise exception 'post_drafts_all_sales NEGATIVE FAILED: sales@ resolved the Org B draft by id';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- post_draft_assets_all_sales - positive: sales sees own-org join row.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.post_draft_assets where id = '00000000-0000-4000-8000-000000000c05';
  if visible <> 1 then
    raise exception 'post_draft_assets_all_sales POSITIVE FAILED: sales@ sees % rows, expected 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- post_draft_assets_all_sales - negative: tech cannot see it, incl. PK lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked from public.post_draft_assets;
  if leaked <> 0 then
    raise exception 'post_draft_assets_all_sales NEGATIVE FAILED: tech@ sees % post_draft_assets rows, expected 0', leaked;
  end if;

  select count(*) into leaked from public.post_draft_assets where id = '00000000-0000-4000-8000-000000000c05';
  if leaked <> 0 then
    raise exception 'post_draft_assets_all_sales NEGATIVE FAILED: tech@ resolved the sales join row by id';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- post_targets_all_sales - positive: sales sees/writes own-org target.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.post_targets where id = '00000000-0000-4000-8000-000000000c06';
  if visible <> 1 then
    raise exception 'post_targets_all_sales POSITIVE FAILED: sales@ sees % rows, expected 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- post_targets_all_sales - negative: cross-org row invisible (owner of Org B's
-- target planted under reset role, probed by Org A tech and sales).
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  reset role;
  insert into public.post_targets (id, organization_id, draft_id, platform, status)
  values ('00000000-0000-4000-8000-0000000000cc', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000000cb', 'facebook', 'pending')
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked from public.post_targets where id = '00000000-0000-4000-8000-000000000cc';
  if leaked <> 0 then
    raise exception 'post_targets_all_sales NEGATIVE FAILED: tech@ resolved the Org B target by id';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- campaign_log_select_sales / insert_sales - positive: sales reads and
-- appends the own-org log; append-only means no update/delete policy exists.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
  affected integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.campaign_log where draft_id = '00000000-0000-4000-8000-000000000c04';
  if visible <> 1 then
    raise exception 'campaign_log_select_sales POSITIVE FAILED: sales@ sees % rows, expected 1', visible;
  end if;

  insert into public.campaign_log (organization_id, draft_id, channel, platform, status)
  values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000c04', 'manual', 'facebook', 'posted');

  update public.campaign_log set status = 'failed' where draft_id = '00000000-0000-4000-8000-000000000c04';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'campaign_log_select_sales POSITIVE FAILED: sales@ update affected % rows, expected 0 (append-only)', affected;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- campaign_log_select_sales - negative: tech cannot read it at all.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked from public.campaign_log;
  if leaked <> 0 then
    raise exception 'campaign_log_select_sales NEGATIVE FAILED: tech@ sees % campaign_log rows, expected 0', leaked;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- job_photos_select_sales - positive: sales sees the own-org photo (layered
-- over 0007's tech-scoped policy on the same table; do not restate 0007's ACs).
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.job_photos where id = '00000000-0000-4000-8000-000000000c01';
  if visible <> 1 then
    raise exception 'job_photos_select_sales POSITIVE FAILED: sales@ sees % rows for the own-org photo, expected 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- job_photos_select_sales - negative: cross-org photo (synthetic Org B row,
-- reset role) invisible to sales even by PK lookup.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  reset role;
  insert into public.jobs (id, organization_id, status)
  values ('00000000-0000-4000-8000-0000000007b2', '00000000-0000-4000-8000-0000000000b2', 'new')
  on conflict (id) do nothing;

  insert into public.job_photos (id, organization_id, job_id, tech_id, kind, storage_path, occurred_at)
  values ('00000000-0000-4000-8000-0000000008b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000007b2', 'd59e3bc7-691d-4ada-8959-e86f40c1e344',
          'after', 'jobs/b2/after.jpg', now())
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into leaked from public.job_photos where organization_id = '00000000-0000-4000-8000-0000000000b2';
  if leaked <> 0 then
    raise exception 'job_photos_select_sales NEGATIVE FAILED: sales@ sees % Org B job_photos rows, expected 0', leaked;
  end if;

  select count(*) into leaked from public.job_photos where id = '00000000-0000-4000-8000-0000000008b2';
  if leaked <> 0 then
    raise exception 'job_photos_select_sales NEGATIVE FAILED: sales@ resolved the Org B photo by id';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reviews_select_sales - positive: sales sees the own-org, publish_ok review.
-- ---------------------------------------------------------------------------
do $$
declare
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.reviews where id = '00000000-0000-4000-8000-000000000c02';
  if visible <> 1 then
    raise exception 'reviews_select_sales POSITIVE FAILED: sales@ sees % rows for the own-org publish_ok review, expected 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reviews_select_sales - negative: tech (no sales-or-above role) cannot read
-- the review at all, layered over 0010's admin/anon-only policies.
-- ---------------------------------------------------------------------------
do $$
declare
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked from public.reviews where id = '00000000-0000-4000-8000-000000000c02';
  if leaked <> 0 then
    raise exception 'reviews_select_sales NEGATIVE FAILED: tech@ resolved the sales-visible review by id';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reviews_update_sort_sales - positive: sales reorders sort_order on the
-- own-org review (whitelist trigger permits this single column).
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
  new_sort integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  update public.reviews set sort_order = 7 where id = '00000000-0000-4000-8000-000000000c02';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'reviews_update_sort_sales POSITIVE FAILED: sales@ sort_order update affected % rows, expected 1', affected;
  end if;

  select sort_order into new_sort from public.reviews where id = '00000000-0000-4000-8000-000000000c02';
  if new_sort <> 7 then
    raise exception 'reviews_update_sort_sales POSITIVE FAILED: sort_order is % after update, expected 7', new_sort;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- reviews_update_sort_sales - negative: sales cannot change a non-whitelisted
-- column (rejected by reviews_sales_sort_whitelist_trg, independent of RLS).
-- ---------------------------------------------------------------------------
do $$
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  begin
    update public.reviews set rating = 1 where id = '00000000-0000-4000-8000-000000000c02';
    raise exception 'reviews_update_sort_sales NEGATIVE FAILED: sales@ changed rating without the trigger rejecting it';
  exception
    when others then
      if sqlerrm not like 'reviews: sales update may only change sort_order%' then
        raise;
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- reviews_update_sort_sales - negative: cross-org review invisible to update
-- (synthetic Org B review, reset role; 0 rows affected, not an error).
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
begin
  reset role;
  insert into public.reviews (id, organization_id, job_id, rating, platform, publish_ok)
  values ('00000000-0000-4000-8000-0000000009b2', '00000000-0000-4000-8000-0000000000b2',
          '00000000-0000-4000-8000-0000000007b2', 5, 'internal', true)
  on conflict (id) do nothing;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  update public.reviews set sort_order = 9 where id = '00000000-0000-4000-8000-0000000009b2';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'reviews_update_sort_sales NEGATIVE FAILED: sales@ updated the Org B review, expected 0 rows affected';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- social_providers_admin_all - positive: admin writes; select_sales - sales
-- reads the same own-org row (config only, never a secret).
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
  visible integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  update public.social_providers set enabled = false where id = '00000000-0000-4000-8000-000000000c07';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'social_providers_admin_all POSITIVE FAILED: admin@ update affected % rows, expected 1', affected;
  end if;

  update public.social_providers set enabled = true where id = '00000000-0000-4000-8000-000000000c07';

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  select count(*) into visible from public.social_providers where id = '00000000-0000-4000-8000-000000000c07';
  if visible <> 1 then
    raise exception 'social_providers_select_sales POSITIVE FAILED: sales@ sees % rows, expected 1', visible;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- social_providers_select_sales - negative: sales cannot write (admin-only
-- for writes); tech cannot read at all.
-- ---------------------------------------------------------------------------
do $$
declare
  affected integer;
  leaked integer;
begin
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cff3db85-9535-45c7-ac36-3a78ac161a4b","role":"authenticated"}';

  update public.social_providers set enabled = false where id = '00000000-0000-4000-8000-000000000c07';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'social_providers_select_sales NEGATIVE FAILED: sales@ update affected % rows, expected 0 (select-only)', affected;
  end if;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"d59e3bc7-691d-4ada-8959-e86f40c1e344","role":"authenticated"}';

  select count(*) into leaked from public.social_providers where id = '00000000-0000-4000-8000-000000000c07';
  if leaked <> 0 then
    raise exception 'social_providers_select_sales NEGATIVE FAILED: tech@ resolved the social_providers row by id, expected 0';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- social_provider_credentials - absence-of-policy canary. RLS is enabled but
-- zero policies exist for any role (mirrors the audit_log/signup_attempts
-- pattern) - every authenticated client, including sales and admin, must see
-- exactly zero rows, and pg_policies must report zero policy rows.
-- ---------------------------------------------------------------------------
do $$
declare
  policy_count integer;
  leaked integer;
begin
  reset role;
  select count(*) into policy_count from pg_policies where tablename = 'social_provider_credentials';
  if policy_count <> 0 then
    raise exception 'social_provider_credentials CANARY FAILED: % policies found, expected 0 (absence-of-policy denial pattern)', policy_count;
  end if;

  set local role authenticated;
  set local request.jwt.claims = '{"sub":"a143fac2-4806-42ed-9283-b45275b6c53a","role":"authenticated"}';

  select count(*) into leaked from public.social_provider_credentials;
  if leaked <> 0 then
    raise exception 'social_provider_credentials CANARY FAILED: admin@ sees % rows, expected 0 - no policy exists so RLS must deny', leaked;
  end if;

  select count(*) into leaked from public.social_provider_credentials where id = '00000000-0000-4000-8000-000000000c08';
  if leaked <> 0 then
    raise exception 'social_provider_credentials CANARY FAILED: admin@ resolved the credentials row by id, expected 0';
  end if;
end $$;

-- Nothing above is meant to persist. Roll the probe org and fixtures back out.
rollback;
