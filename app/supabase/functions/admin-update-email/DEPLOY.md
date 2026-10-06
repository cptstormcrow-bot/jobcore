---
classification: sdassemblypros/jobcore
comments: "admin-update-email — deploy notes"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/functions/admin-update-email/DEPLOY.md
tags: [sdassemblypros, jobcore]
---
# admin-update-email — deploy notes

Lets an owner/admin change another employee's login email in their own organization.

## Deploy

```
supabase functions deploy admin-update-email
```

Do NOT pass `--no-verify-jwt`: default JWT verification stays on. The function also
re-checks the caller with `auth.getUser()` and the owner/admin role.

## Secrets

None beyond the defaults Supabase injects automatically: `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Request

`POST` `{ "userId": "<uuid>", "email": "<new email>" }` (email is trimmed and lower-cased).
Success: `200 { "ok": true, "email": "<normalized>" }`.

## Smoke-test matrix

| Case | Expected |
|------|----------|
| Admin/owner changes a same-org employee | 200 `{ok:true,email}` |
| Tech (non-admin) caller | 403 |
| Target user in a different organization (or missing) | 404 |
| userId equals caller's own id | 400 "Cannot change your own email here" |
| Email already used by another account | 409 `{error:"email_taken"}` |
| Non-POST method | 405 |
| OPTIONS preflight | 2xx with Access-Control-Allow-Origin |
| Bad/missing body or invalid email | 400 |
| No/invalid bearer token | 401 |
