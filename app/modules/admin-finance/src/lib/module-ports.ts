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
 * The fields are typed against the repository interfaces declared in
 * `modules/admin-finance/src/data/ports.ts`.
 */

import type {
  JobRepository,
  PriceSheetRepository,
  PayPeriodRepository,
  LeadRepository,
  EmployeeRepository,
  InvitationRepository,
  JobAssignmentRepository,
  CommissionRepository,
  AuditLogRepository,
  JobPhotoRepository,
  JobNoteRepository,
  PaymentsRepository,
  CalendarEventRepository,
  TechServiceAreaRepository,
  TechSkillRepository,
  ServiceAreaRepository,
  CustomerRepository,
} from '../data/ports';
import type { PriceSheetRepo, PriceSheetAreaAdjustment } from '../data/price-sheet-repo';
import type { CalculationResult } from '../money/types';
import type { ReimbursementRepo } from '../data/reimbursement-repo';
import type { PayoutBatchRepo } from '../data/payout-batch-repo';
import type { TimeOffAdminRepo } from '../data/time-off-repo';

export interface ModulePorts {
  jobs: JobRepository;
  customers: CustomerRepository;
  priceSheets: PriceSheetRepository;
  payPeriods: PayPeriodRepository;
  leads: LeadRepository;
  employees: EmployeeRepository;
  invitations: InvitationRepository;
  techServiceAreas: TechServiceAreaRepository;
  serviceAreas: ServiceAreaRepository;
  techSkills: TechSkillRepository;
  jobAssignments: JobAssignmentRepository;
  commissions: CommissionRepository;
  auditLog: AuditLogRepository;
  priceSheetPublish: PriceSheetRepo;
  priceSheetAreaAdjustments: {
    list(priceSheetId: string): Promise<CalculationResult<PriceSheetAreaAdjustment[]>>;
    save(
      priceSheetId: string,
      serviceAreaId: string,
      adjustmentType: 'percent' | 'flat',
      adjustmentValue: number
    ): Promise<CalculationResult<PriceSheetAreaAdjustment>>;
  };
  reimbursements: ReimbursementRepo;
  payoutBatches: PayoutBatchRepo;
  closeOutPhotos: JobPhotoRepository;
  closeOutNotes: JobNoteRepository;
  payments: PaymentsRepository;
  calendarEvents: CalendarEventRepository;
  timeOffAdmin: TimeOffAdminRepo;
  /**
   * Durable on-device key/value boolean preference storage — persists across
   * in-app navigation, app restarts, and logout/login. Backed by SecureStore
   * on native and localStorage on web (see local-prefs.ts / local-prefs.web.ts
   * in the host app).
   */
  localPrefs: {
    getBool(key: string, defaultValue: boolean): Promise<boolean>;
    setBool(key: string, value: boolean): Promise<void>;
  };
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
