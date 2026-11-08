/**
 * Convert-lead rules (uber 222) — pure, no I/O.
 *
 * A website lead is converted to a job after the office phones the customer.
 * Unlike `qualify.ts` (which needs a preferred date and a resolved service
 * area and moves the job to `qualified`), conversion is deliberately lenient:
 * it creates a `new` job with source `website`, and when no service area can
 * be resolved the job is simply created without one and flagged
 * "Needs service area" (a job with `serviceAreaId === null` IS the flag, so
 * there is no extra column to keep in sync).
 */

import type { Lead } from './lead';
import type { JobDraft } from './qualify';
import type { Customer, ServiceArea } from '../data/ports';

export const NEEDS_SERVICE_AREA_LABEL = 'Needs service area';

/** True for any job that was created without a service area. */
export function needsServiceArea(job: { serviceAreaId?: string | null; service_area_id?: string | null }): boolean {
  return (job.serviceAreaId ?? job.service_area_id ?? null) === null;
}

const norm = (v: string | null | undefined): string => (v ?? '').trim().toLowerCase();

/**
 * Resolves the lead's service area id: the zip against each area's zip list
 * first, then the lead's named service area (case-insensitive). Returns
 * `null` when nothing matches or the match is ambiguous across areas.
 */
export function resolveServiceAreaId(
  lead: Pick<Lead, 'zip' | 'serviceArea'>,
  areas: readonly ServiceArea[]
): string | null {
  const zip = (lead.zip ?? '').trim();
  if (zip !== '') {
    const byZip = areas.filter((a) => a.zipCodes.some((z) => z.trim() === zip));
    if (byZip.length === 1) return byZip[0]?.id ?? null;
    if (byZip.length > 1) return null;
  }
  const name = norm(lead.serviceArea);
  if (name !== '') {
    const byName = areas.filter((a) => norm(a.name) === name);
    if (byName.length === 1) return byName[0]?.id ?? null;
  }
  return null;
}

const digits = (v: string | null | undefined): string => (v ?? '').replace(/\D/g, '');

/** An existing customer with the same phone (last 10 digits) or email, if any. */
export function findMatchingCustomer(
  lead: Pick<Lead, 'phone' | 'email'>,
  customers: readonly Pick<Customer, 'id' | 'phone' | 'email'>[]
): string | null {
  const phone = digits(lead.phone).slice(-10);
  const email = norm(lead.email);
  for (const c of customers) {
    if (phone.length === 10 && digits(c.phone).slice(-10) === phone) return c.id;
    if (email !== '' && norm(c.email) === email) return c.id;
  }
  return null;
}

export type ConvertCheck = { ok: true } | { ok: false; reason: string };

/** A lead can be converted once, and only if it has a name and an address. */
export function canConvert(lead: Lead): ConvertCheck {
  if (lead.convertedJobId) return { ok: false, reason: 'This lead was already converted to a job.' };
  if (!lead.address || lead.address.trim() === '') return { ok: false, reason: 'Add an address to the lead first.' };
  if (!lead.name || lead.name.trim() === '') return { ok: false, reason: 'Add the customer name to the lead first.' };
  return { ok: true };
}

/** The `new` website job a converted lead becomes. */
export function buildJobFromWebsiteLead(lead: Lead, serviceAreaId: string | null, customerId: string | null): JobDraft {
  const requestedWindow = lead.preferredDate
    ? lead.preferredTime ? `${lead.preferredDate} ${lead.preferredTime}` : lead.preferredDate
    : lead.preferredTime;
  return {
    organizationId: lead.organizationId,
    status: 'new',
    customerId,
    serviceId: null,
    source: 'website',
    payer: lead.payer,
    attachTiming: lead.attachTiming,
    requestedWindow: requestedWindow ?? null,
    scheduledStart: null,
    scheduledEnd: null,
    address: lead.address,
    description: lead.projectDetails,
    assignedTechId: null,
    serviceAreaId,
    ingressInstructions: lead.ingressInstructions ?? null,
  };
}

/** Leads nobody has worked yet: not qualified and not converted. Drives the Main Menu Leads badge. */
export function countUnworkedLeads(leads: readonly Pick<Lead, 'qualifiedAt' | 'convertedJobId'>[]): number {
  return leads.filter((l) => !l.qualifiedAt && !l.convertedJobId).length;
}
