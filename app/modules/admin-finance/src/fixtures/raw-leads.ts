/**
 * Fixed-literal `RawLead`/`MockFeedEntry` fixtures for P7 Slice A tests.
 *
 * No `Date.now()`, no faked clocks — every timestamp below is a literal
 * string, matching `fixtures/leads.ts`'s "zero setup" discipline.
 */

import type { RawLead } from '../domain/intake-normalize';
import type { MockFeedEntry } from '../data/intake-adapter';

/** A raw lead with every axis field stated explicitly — normalizing this assumes nothing. */
export const fullyStatedRawLead: RawLead = {
  sourceForm: 'website-hero-quick-form',
  name: 'Priya Natarajan',
  phone: '555-0101',
  email: 'priya@example.com',
  service: 'trampoline-assembly',
  preferredDate: '2026-08-15',
  preferredTime: 'morning',
  address: '12 Birchwood Ave',
  projectDetails: '14ft trampoline, needs net',
  source: 'google-ads',
  payer: 'customer',
  attachTiming: 'at_purchase',
};

/** A raw lead missing all three axis fields — normalizing this assumes all three and flags for review. */
export const barePartnerRawLead: RawLead = {
  sourceForm: 'partner-referral-webhook',
  name: 'Marcus Ihejirika',
  phone: '555-0102',
  email: null,
  service: 'shed-assembly',
  preferredDate: null,
  preferredTime: null,
  address: '88 Larkspur Rd',
  projectDetails: null,
};

/** A raw lead missing exactly one axis field (`payer`) — normalizing this assumes one field and flags for review. */
export const partiallyStatedRawLead: RawLead = {
  sourceForm: 'website-hero-quick-form',
  name: 'Donte Wallace',
  phone: null,
  email: 'donte@example.com',
  service: 'furniture-assembly',
  preferredDate: '2026-08-20',
  preferredTime: 'afternoon',
  address: '4 Cobblestone Ct',
  projectDetails: 'bedroom set, 3 pieces',
  source: 'direct',
  attachTiming: 'at_purchase',
};

/** Aggregate of every `RawLead` fixture above, for iteration-style tests. */
export const rawLeadFixtures: readonly RawLead[] = [
  fullyStatedRawLead,
  barePartnerRawLead,
  partiallyStatedRawLead,
];

/** `MockFeedEntry` fixtures for `MockFeedAdapter` tests — fixed `occurredAt` cursors, no faked clock. */
export const mockFeedEntryFixtures: readonly MockFeedEntry[] = [
  { externalId: 'feed-001', occurredAt: '2026-08-01T09:00:00Z', lead: fullyStatedRawLead },
  { externalId: 'feed-002', occurredAt: '2026-08-05T14:30:00Z', lead: barePartnerRawLead },
  { externalId: 'feed-003', occurredAt: '2026-08-10T11:15:00Z', lead: partiallyStatedRawLead },
];
