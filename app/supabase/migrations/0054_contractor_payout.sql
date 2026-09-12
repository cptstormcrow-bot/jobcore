-- Contractor payout tracking for the Close-Outs feature (Slice 6).
-- Records a finalized payout amount owed to a contractor/tech for a closed-out job.
create table if not exists contractor_payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  job_id uuid not null references jobs(id),
  tech_id uuid not null references profiles(id),
  amount_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table contractor_payouts enable row level security;

create policy contractor_payouts_select on contractor_payouts
  for select using (organization_id = (auth.jwt() ->> 'organization_id')::uuid);

create policy contractor_payouts_insert on contractor_payouts
  for insert with check (organization_id = (auth.jwt() ->> 'organization_id')::uuid);
