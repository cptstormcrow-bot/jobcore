/**
 * Convert-lead flow (uber 222) — website lead -> `new` job after the phone call.
 *
 * 1. Resolve the service area from the lead's zip or named area. No match is
 *    allowed: the job is created without one and shows "Needs service area".
 * 2. Create the customer, then the `new` job with source `website`.
 * 3. Stamp `converted_job_id` and `qualified_at` on the lead (clears the
 *    Main Menu Leads badge). Status stays `new` — no transition is made.
 *
 * Not transactional (same stance as `qualifyLead`): three sequential awaits.
 */

import type { Job } from '@jobcore/core';
import type { Lead } from '../domain/lead';
import { buildJobFromWebsiteLead, canConvert, resolveServiceAreaId } from '../domain/convert-lead';
import type { CustomerRepository, JobRepository, LeadRepository, ServiceArea } from '../data/ports';

export interface ConvertLeadDeps {
  jobs: JobRepository;
  leads: LeadRepository;
  customers: CustomerRepository;
  serviceAreas: readonly ServiceArea[];
  now: () => string;
}

export type ConvertLeadResult =
  | { ok: true; job: Job; lead: Lead; needsServiceArea: boolean }
  | { ok: false; reason: string };

export async function convertLead(lead: Lead, deps: ConvertLeadDeps): Promise<ConvertLeadResult> {
  const check = canConvert(lead);
  if (!check.ok) return { ok: false, reason: check.reason };

  const serviceAreaId = resolveServiceAreaId(lead, deps.serviceAreas);
  const customer = await deps.customers.create({
    organizationId: lead.organizationId,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
  });
  const job = await deps.jobs.create(buildJobFromWebsiteLead(lead, serviceAreaId, customer.id));
  const updated = await deps.leads.markQualified(lead.id, job.id, deps.now());
  return { ok: true, job, lead: updated, needsServiceArea: serviceAreaId === null };
}
