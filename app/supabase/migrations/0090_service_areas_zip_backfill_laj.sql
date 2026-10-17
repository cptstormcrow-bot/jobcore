-- 0090_service_areas_zip_backfill_laj.sql
-- Idempotent: ensure La Jolla service area(s) carry the La Jolla zips (union with
-- existing, no duplicates), then backfill jobs.service_area_id for unassigned jobs
-- whose address mentions a La Jolla zip or "La Jolla". No destructive statements.

update public.service_areas sa
   set zip_codes = (
     select coalesce(array_agg(z order by z), '{}')
       from (
         select unnest(coalesce(sa.zip_codes, '{}') || '{92037,92038,92039,92092,92093}'::text[]) as z
         group by 1
       ) u
   )
 where sa.name ilike 'La Jolla'
   and not (coalesce(sa.zip_codes, '{}') @> '{92037,92038,92039,92092,92093}'::text[]);

update public.jobs j
   set service_area_id = sa.id
  from public.service_areas sa
 where sa.name ilike 'La Jolla'
   and sa.organization_id = j.organization_id
   and j.service_area_id is null
   and (
     j.address ilike '%La Jolla%'
     or j.address ~ '(92037|92038|92039|92092|92093)'
   );
