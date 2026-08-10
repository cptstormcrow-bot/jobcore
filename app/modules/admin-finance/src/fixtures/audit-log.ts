/**
 * Audit log fixtures (P7 Slice B).
 *
 * Fixed data only — no `Date.now()`, no faked clock, no DB, no network.
 * Mirrors the domain `AuditLogEntry` shape from `../data/ports.ts`.
 *
 * `skewedTransitionEntry` carries a `metadata.skewed: true` flag (device
 * clock materially ahead of/behind the server clock at the moment of the
 * transition — see `@jobcore/core`'s `evaluateSkew`); `onTimeTransitionEntry`
 * is the ordinary non-skewed case. Both are `job.transition.*` rows, the
 * one action type `state-machine.ts`'s `applyTransition` actually writes.
 */

import type { AuditLogEntry } from '../data/ports';

/** An ordinary, non-skewed transition — device and server clocks agree. */
export const onTimeTransitionEntry: AuditLogEntry = {
  id: 'audit-1',
  organizationId: 'org-1',
  actorId: 'user-tech-1',
  action: 'job.transition.en_route',
  entity: 'job',
  entityId: 'job-1',
  metadata: {
    fromState: 'accepted',
    toState: 'en_route',
    occurredAt: '2026-08-01T14:00:00.000Z',
    syncedAt: '2026-08-01T14:00:02.000Z',
    skewMs: 2000,
    skewed: false,
  },
  createdAt: '2026-08-01T14:00:02.000Z',
};

/** A skewed transition — the device clock was materially ahead of the server clock. */
export const skewedTransitionEntry: AuditLogEntry = {
  id: 'audit-2',
  organizationId: 'org-1',
  actorId: 'user-tech-2',
  action: 'job.transition.in_progress',
  entity: 'job',
  entityId: 'job-2',
  metadata: {
    fromState: 'en_route',
    toState: 'in_progress',
    occurredAt: '2026-08-01T15:10:00.000Z',
    syncedAt: '2026-08-01T15:16:45.000Z',
    skewMs: 405000,
    skewed: true,
  },
  createdAt: '2026-08-01T15:16:45.000Z',
};

/** A row with no actor — written by a system/background process rather than an authenticated user. */
export const systemWrittenEntry: AuditLogEntry = {
  id: 'audit-3',
  organizationId: 'org-1',
  actorId: null,
  action: 'job.transition.closed',
  entity: 'job',
  entityId: 'job-3',
  metadata: {
    fromState: 'paid',
    toState: 'closed',
    occurredAt: '2026-08-02T09:00:00.000Z',
    syncedAt: '2026-08-02T09:00:01.000Z',
    skewMs: 1000,
    skewed: false,
  },
  createdAt: '2026-08-02T09:00:01.000Z',
};

export const auditLogFixtures: readonly AuditLogEntry[] = [
  onTimeTransitionEntry,
  skewedTransitionEntry,
  systemWrittenEntry,
];
