/**
 * Repository-port seam for the admin-finance module (P3d.1).
 *
 * Mirrors the field-tech module's session-injection pattern
 * (`modules/admin-finance/src/lib/module-session.ts`): the host is the
 * ONLY writer, via `setModulePorts`, and this module never constructs its
 * own repository implementations. `getModulePorts` is fail-closed — it
 * THROWS if called before the host has injected ports, rather than
 * returning `null`, because every admin-finance screen needs a working
 * repository set to render anything meaningful at all. There is no hook —
 * screens call `getModulePorts()` directly.
 *
 * The eight fields are typed against the repository interfaces declared in
 * `modules/admin-finance/src/data/ports.ts`.
 */

import type {
  JobRepository,
  PriceSheetRepository,
  PayPeriodRepository,
  LeadRepository,
  TechRepository,
  JobAssignmentRepository,
  CommissionRepository,
  AuditLogRepository,
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

/**
 * Injection point for the host. Pass the fully-constructed repository set
 * once the host has resolved its own data layer. This is the ONLY function
 * that may write `current`.
 */
export function setModulePorts(ports: ModulePorts): void {
  current = ports;
}

/**
 * Returns the injected repository set. Fail-closed: throws if the host has
 * not yet called `setModulePorts`, so a caller can never silently proceed
 * against an absent data layer.
 */
export function getModulePorts(): ModulePorts {
  if (current === null) {
    throw new Error(
      'getModulePorts() called before setModulePorts() — the host must inject ports before any admin-finance screen renders.',
    );
  }
  return current;
}
