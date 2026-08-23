/**
 * Qualify: lead → job (P3f.2a, P3f.2b).
 *
 * `03-P3-admin-finance.md` §3 ("Lead inbox and the Qualify step"): Qualify is
 * an explicit screen that confirms the customer, address, service, the three
 * axis fields, and a requested_window, then creates the job in `new` (the
 * separate advance to `qualified` goes through `domain/transition.ts`'s
 * `transitionJob`, not this file — this file only builds the `new` payload).
 *
 * Both functions here are pure — no DB, no network, no clock read — mirroring
 * `lead-readiness.ts`'s style. `validateQualify` reuses `classifyLead` (P3e.2)
 * rather than re-deriving readiness: a lead that is `needs_info` can never be
 * qualified, full stop.
 */

import type { Lead } from './lead';
import { classifyLead, missingFields } from './lead-readiness';

/** Result of `validateQualify`. `reasons` is empty iff `valid` is true. */
export interface QualifyValidation {
  valid: boolean;
  reasons: string[];
}

/**
 * A lead can only be qualified once `classifyLead` reports it `'ready'`
 * (AC: not `needs_info`). `reasons` mirrors `missingFields` so the Qualify
 * screen can show staff exactly which field(s) are blocking it — the same
 * "never hide a gap" rule `lead-readiness.ts` follows.
 */
export function validateQualify(lead: Lead): QualifyValidation {
  if (classifyLead(lead) === 'needs_info') {
    return {
      valid: false,
      reasons: missingFields(lead).map((field) => `Missing required field: ${field}`),
    };
  }
  return { valid: true, reasons: [] };
}

/**
 * The `new`-status job payload `buildJobFromLead` produces. A structural
 * subset of `@jobcore/core`'s `Job` (id/createdAt/timestamps are
 * server-assigned, so they are not this function's concern) plus
 * `serviceAreaId`, which `@jobcore/core`'s `Job` type already declares as
 * `service_area_id` (optional, nullable, in `packages/core/src/index.ts`).
 *
 * `serviceId` is deliberately `null`: `Lead.service` is free text captured at
 * intake, not a `services` table foreign key, and this function is pure (no
 * DB lookup) — resolving a service id from that text is a later, DB-backed
 * step, not this one.
 */
export interface JobDraft {
  organizationId: string;
  status: 'new';
  customerId: string | null;
  serviceId: string | null;
  source: string | null;
  payer: string | null;
  attachTiming: string | null;
  requestedWindow: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  address: string | null;
  description: string | null;
  assignedTechId: string | null;
  serviceAreaId: string | null;
  permitStatus?: string | null;
  parkingAvailable?: string | null;
  rooms?: string[] | null;
  panelInfo?: string | null;
  considerations?: string | null;
}

export type BuildJobFromLeadResult =
  | { ok: true; job: JobDraft }
  | { ok: false; reason: string };

/**
 * Builds a `new`-status job payload from a qualify-ready lead. Pure: the
 * caller resolves `serviceAreaId` (a `service_areas.id` lookup against the
 * lead's address) and passes the result in — this function never queries the
 * DB itself.
 *
 * Two distinct, non-conflated failure reasons on the address/service-area
 * axis:
 *   - "address unknown" — the lead has no address at all. `validateQualify`
 *     should already have blocked this (address is one of
 *     `lead-readiness.ts`'s `REQUIRED_FOR_SCHEDULING` fields), so reaching
 *     this branch means a caller skipped validation — this check is
 *     defensive, not the primary gate.
 *   - "outside the service area" — the address IS known, but the caller
 *     could not resolve it to a `service_areas` row (passed `null`). This is
 *     the expected, everyday rejection case Qualify staff will actually see.
 *     The hard reject below on `serviceAreaId === null` is intentional
 *     business logic — a resolved service area is required before a job can
 *     be created — not a workaround for a missing field on `Job`.
 */
export function buildJobFromLead(lead: Lead, serviceAreaId: string | null): BuildJobFromLeadResult {
  const validation = validateQualify(lead);
  if (!validation.valid) {
    return {
      ok: false,
      reason: `Lead is not ready to qualify: ${validation.reasons.join('; ')}`,
    };
  }

  if (!lead.address || lead.address.trim().length === 0) {
    return { ok: false, reason: 'address unknown' };
  }

  if (serviceAreaId === null) {
    return { ok: false, reason: 'outside the service area' };
  }

  return {
    ok: true,
    job: {
      organizationId: lead.organizationId,
      status: 'new',
      customerId: null,
      serviceId: null,
      source: lead.source,
      payer: lead.payer,
      attachTiming: lead.attachTiming,
      requestedWindow: buildRequestedWindow(lead),
      scheduledStart: null,
      scheduledEnd: null,
      address: lead.address,
      description: lead.projectDetails,
      assignedTechId: null,
      serviceAreaId,
      permitStatus: null,
      parkingAvailable: null,
      rooms: null,
      panelInfo: null,
      considerations: null,
    },
  };
}

/**
 * `requested_window` (what the customer asked for, per `@jobcore/core`'s
 * `Job` doc comment) collapses the lead's separate `preferredDate` /
 * `preferredTime` into one string. `validateQualify` already guarantees
 * `preferredDate` is present by the time this runs; `preferredTime` stays
 * optional.
 */
function buildRequestedWindow(lead: Lead): string | null {
  if (!lead.preferredDate) {
    return null;
  }
  return lead.preferredTime ? `${lead.preferredDate} ${lead.preferredTime}` : lead.preferredDate;
}
