---
classification: sdassemblypros/jobcore
comments: "0071 hosted cases"
origin: Codespace/SDAssemblyPros/Jobcore/app/supabase/tests/0071_hosted_cases/README.md
tags: [sdassemblypros, jobcore]
---
# 0071 hosted cases

Per-case split of `../0071_profiles_sensitive_column_guard_rls.hosted.test.sql`, with no `$$` and no `do` blocks, so each file can be run on its own through `supabase db query`.

| File | What it tries | Expected |
|------|---------------|----------|
| 01_tech_own_name_phone.sql | tech updates own full_name + phone | ALLOWED (1 row) |
| 02_tech_own_role.sql | tech changes own role | BLOCKED 42501 (role message) |
| 03_tech_own_hourly_rate.sql | tech changes own hourly_rate_cents | BLOCKED 42501 (own-profile message) |
| 04_tech_own_active.sql | tech flips own active | BLOCKED 42501 (own-profile message) |
| 05_tech_updates_admin_name.sql | tech updates admin's full_name | 0 rows (blocked by RLS before the trigger fires) |
| 06_admin_updates_tech_rate_active.sql | admin updates tech's rate + active | ALLOWED (1 row) |
| 07_admin_sets_tech_role_directly.sql | admin sets tech's role directly | BLOCKED 42501 (role message) |
| 08_admin_set_employee_role_fn.sql | admin calls admin_set_employee_role() | ALLOWED |
| 09_anon_update_denied.sql | anon updates a profile | BLOCKED 42501 (permission denied for table) |
| 10_postgres_bypasses_guard.sql | owner session changes role directly | ALLOWED (1 row) |

## Forced-error rollback pattern

Each file ends its statement with `('RESULT ' || json_build_object(...)::text)::int`. That text cannot be cast to int, so Postgres always raises 22P02 (invalid input syntax for type integer), and the error message carries the `RESULT {...}` JSON (case, rows_updated, current_user, jwt_sub). The error aborts the statement, including the data-modifying CTE, so nothing persists even if the tool ignores `begin`/`rollback`. Never remove the `::int`. Reading results: a BLOCKED case errors earlier with 42501 and the guard message instead of reaching the 22P02 RESULT line; an ALLOWED case shows the 22P02 error quoting the RESULT JSON (check `rows_updated`).

## How to run

From `app`:

```
npx -y supabase@2.116.0 db query --linked --file "<absolute path to case file>"
```
