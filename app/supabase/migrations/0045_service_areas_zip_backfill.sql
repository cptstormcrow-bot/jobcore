-- 0045_service_areas_zip_backfill.sql
-- One-time backfill of service_areas.zip_codes (text[]) for the 31 seeded San Diego service areas.

-- La Jolla
update public.service_areas set zip_codes = '{92037,92038,92039,92092,92093}' where id = '00000000-0000-4000-8000-000000000401';
-- Chula Vista
update public.service_areas set zip_codes = '{91909,91910,91911,91912,91913,91914,91915,91921}' where id = '00000000-0000-4000-8000-000000000402';
-- Poway
update public.service_areas set zip_codes = '{92064,92074}' where id = '00000000-0000-4000-8000-000000000403';
-- Encinitas
update public.service_areas set zip_codes = '{92007,92024,92067,92091}' where id = '00000000-0000-4000-8000-000000000404';
-- Carlsbad
update public.service_areas set zip_codes = '{92008,92009,92010,92011,92013,92018}' where id = '00000000-0000-4000-8000-000000000405';
-- El Cajon
update public.service_areas set zip_codes = '{92019,92020,92021,92022,92090}' where id = '00000000-0000-4000-8000-000000000406';
-- San Diego
update public.service_areas set zip_codes = '{92101,92102,92105,92106,92107,92113,92114,92115,92116,92117,92126,92132,92134,92139,92140,92154}' where id = '00000000-0000-4000-8000-000000000407';
-- Pacific Beach
update public.service_areas set zip_codes = '{92109}' where id = '00000000-0000-4000-8000-000000000408';
-- Rancho Bernardo
update public.service_areas set zip_codes = '{92127,92128}' where id = '00000000-0000-4000-8000-000000000409';
-- Carmel Valley
update public.service_areas set zip_codes = '{92130}' where id = '00000000-0000-4000-8000-00000000040a';
-- National City
update public.service_areas set zip_codes = '{91950,91951}' where id = '00000000-0000-4000-8000-00000000040b';
-- Imperial Beach
update public.service_areas set zip_codes = '{91932,91933}' where id = '00000000-0000-4000-8000-00000000040c';
-- Coronado
update public.service_areas set zip_codes = '{92118}' where id = '00000000-0000-4000-8000-00000000040d';
-- La Mesa
update public.service_areas set zip_codes = '{91941,91942,91943,91944}' where id = '00000000-0000-4000-8000-00000000040e';
-- Santee
update public.service_areas set zip_codes = '{92071}' where id = '00000000-0000-4000-8000-00000000040f';
-- Lemon Grove
update public.service_areas set zip_codes = '{91945}' where id = '00000000-0000-4000-8000-000000000410';
-- Del Mar
update public.service_areas set zip_codes = '{92014}' where id = '00000000-0000-4000-8000-000000000411';
-- Solana Beach
update public.service_areas set zip_codes = '{92075}' where id = '00000000-0000-4000-8000-000000000412';
-- Oceanside
update public.service_areas set zip_codes = '{92049,92051,92052,92054,92056,92057,92058}' where id = '00000000-0000-4000-8000-000000000413';
-- Escondido
update public.service_areas set zip_codes = '{92025,92026,92027,92029}' where id = '00000000-0000-4000-8000-000000000414';
-- San Marcos
update public.service_areas set zip_codes = '{92069}' where id = '00000000-0000-4000-8000-000000000415';
-- Vista
update public.service_areas set zip_codes = '{92081,92083,92084,92085}' where id = '00000000-0000-4000-8000-000000000416';
-- Ramona
update public.service_areas set zip_codes = '{92065}' where id = '00000000-0000-4000-8000-000000000417';
-- Alpine
update public.service_areas set zip_codes = '{91901}' where id = '00000000-0000-4000-8000-000000000418';
-- Lakeside
update public.service_areas set zip_codes = '{92040}' where id = '00000000-0000-4000-8000-000000000419';
-- Bonsall
update public.service_areas set zip_codes = '{92003}' where id = '00000000-0000-4000-8000-00000000041a';
-- Spring Valley
update public.service_areas set zip_codes = '{91978}' where id = '00000000-0000-4000-8000-00000000041b';
-- Hillcrest
update public.service_areas set zip_codes = '{92103}' where id = '00000000-0000-4000-8000-00000000041c';
-- North Park
update public.service_areas set zip_codes = '{92104}' where id = '00000000-0000-4000-8000-00000000041d';
-- Mission Valley
update public.service_areas set zip_codes = '{92108,92110,92111,92123}' where id = '00000000-0000-4000-8000-00000000041e';
-- Scripps Ranch
update public.service_areas set zip_codes = '{92131}' where id = '00000000-0000-4000-8000-00000000041f';

select count(*) filter (where cardinality(zip_codes) > 0) as populated, sum(cardinality(zip_codes)) as total_zips from public.service_areas;
