---
classification: sdassemblypros/jobcore
comments: "Deploying `lead-intake`"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/lead-intake/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# Deploying `lead-intake`

Website lead intake for format `jobcore-job-v1`. Inserts a row in `leads` (never a job).
Migration 0139 must be pushed first (Jeff's go).

```
supabase functions deploy lead-intake --no-verify-jwt
```

`--no-verify-jwt` is required: the website has no Supabase session; access control is the secret key.

## Create the key (once per website)

Pick a long random secret, keep it only in the WordPress server config, and store its hash:

```sql
insert into lead_intake_keys (organization_id, key_hash, label)
values ('<org uuid>', encode(digest('<secret>', 'sha256'), 'hex'), 'wordpress');
```

Revoke by setting `active = false`.

## Call it

`POST https://<project-ref>.supabase.co/functions/v1/lead-intake` with header `x-intake-key: <secret>`.
Body is JSON or one-row CSV (`Content-Type: text/csv`). Replies: 200 `{ok:true,duplicate:bool}`,
400/422 with a plain `error`, 401 bad key. Same `lead_id` twice returns 200 `duplicate:true`, no second row.
