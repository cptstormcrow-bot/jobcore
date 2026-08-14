# A1-verify — migrations 0005–0012 live on hosted jobcore-dev (independent check)

Date: 2026-08-11
Project ref: vogkxkcceahtwyovpxsg
Method: read-only PostgREST schema-cache probe (no Supabase CLI creds available — no DB
password or service_role key present in repo; `.env` only carries the anon publishable key,
per repo policy that secrets never live in the client `.env`). CLI `supabase migration list
--linked` requires a DB password/access token not present here — not usable. No Supabase MCP
tool was available in this session's toolset (Bash + Read only). No local Supabase CLI project
link (`supabase/config.toml` / linked project ref) found either.

Chosen alternative: PostgREST returns 404 (PGRST205, "relation not found in schema cache") for
a genuinely absent table/column regardless of RLS, and 200 (possibly with an empty array, since
RLS denies unauthenticated anon access to tenant-scoped rows) if the object exists. So probing
every table/column each migration 0005–0012 creates, via the anon key against the live REST
endpoint, is a valid independent existence check — it doesn't need to bypass RLS, it just needs
the relation to resolve.

Base URL: https://vogkxkcceahtwyovpxsg.supabase.co
Key used: anon/publishable (from app/apps/mobile/.env, EXPO_PUBLIC_SUPABASE_ANON_KEY)

Command pattern:
```
curl -s -o /dev/null -w "%{http_code}\n" "$URL/rest/v1/<table>?select=<col>&limit=1" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

## Results

### 0005_money.sql (tables: price_sheets, price_sheet_rates, compensation_policies, commissions, reimbursements, payout_batches, payout_lines)
| object | http |
|---|---|
| price_sheets | 200 |
| price_sheet_rates | 200 |
| compensation_policies | 200 |
| commissions | 200 |
| reimbursements | 200 |
| payout_batches | 200 |
| payout_lines | 200 |

Note: earlier probe of a table named `rate_publications` returned 404 — that table name does not
exist in 0005_money.sql at all (checked via `grep "^create table" 0005_money.sql`); the actual
table is `price_sheets`/`price_sheet_rates`. That 404 was a bad guess on my part, not a migration
gap — corrected and reprobed above, all 200.

### 0006_job_service_area.sql (column jobs.service_area_id — no new table)
| object | http |
|---|---|
| jobs.service_area_id | 200 |

### 0007_field_tech_tables.sql (checklist_templates, checklist_instances, checklist_items, job_photos, time_off_requests, job_notes)
| object | http |
|---|---|
| checklist_templates | 200 |
| checklist_instances | 200 |
| checklist_items | 200 |
| job_photos | 200 |
| time_off_requests | 200 |
| job_notes | 200 |

### 0008_field_tech_jobs_rls.sql (policy/trigger only, no new relation/column — not independently
REST-probeable; taken as applied given 0009 (which must follow it) resolves cleanly and the repo's
own apply-order documentation)

### 0009_idempotency_keys.sql (columns audit_log.idempotency_key, job_photos.idempotency_key)
| object | http |
|---|---|
| audit_log.idempotency_key | 200 |
| job_photos.idempotency_key | 200 |

### 0010_payment_review.sql (payment_providers, payments, handoff_tokens, reviews, review_requests)
| object | http |
|---|---|
| payment_providers | 200 |
| payments | 200 |
| handoff_tokens | 200 |
| reviews | 200 |
| review_requests | 200 |

### 0011_handoff_token_issue.sql (function public.issue_handoff_token(uuid), granted to `authenticated` only, not `anon`)
| object | http |
|---|---|
| rpc/issue_handoff_token (anon key, POST) | 404 |

Interpretation: this 404 is consistent with the migration's own grant statement
(`grant execute on function public.issue_handoff_token(uuid) to authenticated;` — anon has no
grant), not evidence of absence. PostgREST hides RPCs from a role's schema cache when that role
has no EXECUTE privilege, which is the expected/correct behavior for a function that should only
be callable by an authenticated tech/admin. Could not independently confirm this one object with
the anon-only credentials available — flagged below as a partial/assumption.

### 0012_marketing.sql (marketing_assets, post_drafts, post_draft_assets, post_targets, campaign_log, social_providers, social_provider_credentials, reviews.sort_order, job_photos.customer_consent)
| object | http |
|---|---|
| marketing_assets | 200 |
| post_drafts | 200 |
| post_draft_assets | 200 |
| post_targets | 200 |
| campaign_log | 200 |
| social_providers | 200 |
| social_provider_credentials | 200 |
| reviews.sort_order | 200 |
| job_photos.customer_consent | 200 |

## Conclusion

Every new table and every new column introduced by migrations 0005 through 0012 resolves live via
PostgREST against the hosted `vogkxkcceahtwyovpxsg` project — independent of Jeff's dashboard
claim, confirmed by direct HTTP probe with the anon key. The two migrations with no independently
probeable new relation (0008: RLS policy + trigger only; 0011: function grant is `authenticated`-
only so anon gets 404, which is the *expected* behavior, not a failure signature) are consistent
with having been applied, given every migration downstream of them (0009, 0012) resolves cleanly
and 0008/0011 are unconditional prerequisites in the file's own numbering/apply-order.

No Supabase CLI `migration list` or `supabase_migrations.schema_migrations` table read was
possible — no DB password, access token, or service_role key was available in this repo (by
design; the README explicitly states secrets never live in the client `.env`), and no Supabase
MCP tool was present in this session's toolset.
