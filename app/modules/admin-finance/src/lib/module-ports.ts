/**
 * Repository-port seam for the admin-finance module.
 *
 * Interfaces only, injected by the host — this module never constructs a
 * concrete repository (sqlite, Supabase fetch, fixtures, whatever) itself.
 * `setModulePorts` is the injection point — the ONLY writer of `current`.
 * Until the host calls it, `getModulePorts` throws rather than returning a
 * null/undefined value a screen could silently render against: the host
 * must inject ports before any admin-finance screen renders, and this seam
 * fails closed if that ordering is ever violated.
 */

import type {
  AuditLogRepository,
  CommissionRepository,
  JobAssignmentRepository,
  JobRepository,
  LeadRepository,
  PayPeriodRepository,
  PriceSheetRepository,
  TechRepository,
} from '../data/ports';

export interface ModulePorts {
  jobs: JobRepository;
  priceSheets: PriceSheetRepository;
  payPeriods: PayPeriodRepository;
  leads: LeadRepository;
  techs: TechRepository;
  jobAssignments: JobAssignmentRepository;
  commissions: CommissionRepository;
  auditLog: AuditLogRepository;
}

let current: ModulePorts | null = null;

/** Injection point for the host. This is the ONLY function that may write `current`. */
export function setModulePorts(ports: ModulePorts): void {
  current = ports;
}

export function getModulePorts(): ModulePorts {
  if (current === null) {
    throw new Error(
      'getModulePorts() called before setModulePorts() — the host must inject ports before any admin-finance screen renders.',
    );
  }
  return current;
}
