-- 0042: Plan region's own editable copy of the E-visit fields (ingress/logistics/parking/state). Seeded from job_investigations client-side where null, then diverges (plan decision 9, 2026-09-03).
alter table public.job_planning_details add column if not exists ingress_notes text;
alter table public.job_planning_details add column if not exists logistics_notes text;
alter table public.job_planning_details add column if not exists parking_notes text;
alter table public.job_planning_details add column if not exists state_assessment text;
