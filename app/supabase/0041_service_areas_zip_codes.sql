-- 0041_service_areas_zip_codes.sql
-- zip-code list on service_areas for address-based auto-select (plan decision S2, 2026-09-03).
alter table public.service_areas add column if not exists zip_codes text[] not null default '{}';
create index if not exists service_areas_zip_codes_gin on public.service_areas using gin (zip_codes);
