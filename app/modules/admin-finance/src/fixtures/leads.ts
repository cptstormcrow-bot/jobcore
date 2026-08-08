/**
 * Lead fixtures (P3e.3).
 *
 * Fixed data only — no `Date.now()`, no faked clock, no DB, no network.
 * `heroLead` is the AC-1 fixture: a lead captured through the website's
 * "hero quick form" (Name / Phone / Service only — `00-MASTER-SPEC.md`),
 * which genuinely never collects `preferredDate` or `address`. Those two
 * fields are null here on purpose, not an oversight — `classifyLead` must
 * report this lead as `'needs_info'`.
 */

import type { Lead } from '../domain/lead';

/**
 * Hero quick form intake: Name / Phone / Service only. No date, no address
 * — per the master spec, this is what the hero form is designed to send.
 */
export const heroLead: Lead = {
  id: 'lead-hero-1',
  organizationId: 'org-1',
  sourceForm: 'hero_quick_form',
  name: 'Jamie Rivera',
  phone: '619-555-0142',
  email: null,
  service: 'Furniture Assembly',
  preferredDate: null,
  preferredTime: null,
  address: null,
  projectDetails: null,
  source: null,
  payer: null,
  attachTiming: null,
  qualifiedAt: null,
  convertedJobId: null,
  createdAt: '2026-08-01T09:00:00.000Z',
};

/**
 * Booking form intake: all eight customer fields present. Fully ready for
 * scheduling — `classifyLead` must report this lead as `'ready'`.
 */
export const bookingLead: Lead = {
  id: 'lead-booking-1',
  organizationId: 'org-1',
  sourceForm: 'booking_form',
  name: 'Morgan Lee',
  phone: '619-555-0199',
  email: 'morgan.lee@example.com',
  service: 'TV Mounting',
  preferredDate: '2026-08-10',
  preferredTime: 'afternoon',
  address: '123 Main St, San Diego, CA 92101',
  projectDetails: 'Mount a 65" TV above the fireplace; customer supplies mount.',
  source: 'website',
  payer: 'customer',
  attachTiming: 'same_day',
  qualifiedAt: '2026-08-01T10:30:00.000Z',
  convertedJobId: null,
  createdAt: '2026-08-01T09:15:00.000Z',
};

/**
 * Booking form intake missing only `address` — a partial-completeness case
 * distinct from the hero lead's two-field gap. Must classify `'needs_info'`
 * with `missingFields` reporting exactly `['address']`.
 */
export const addressMissingLead: Lead = {
  ...bookingLead,
  id: 'lead-address-missing-1',
  name: 'Casey Nguyen',
  address: null,
};

export const leadFixtures: readonly Lead[] = [heroLead, bookingLead, addressMissingLead];
