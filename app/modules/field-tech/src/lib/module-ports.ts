/**
 * Repository-port seam for the field-tech module (P4.S1.3).
 *
 * Mirrors the admin-finance module's session-injection pattern
 * (`modules/admin-finance/src/lib/module-session.ts`): the host is the
 * ONLY writer, via `setModulePorts`, and this module never constructs its
 * own repository implementations. Unlike the session seam, `getModulePorts`
 * is fail-closed — it THROWS if called before the host has injected ports,
 * rather than returning `null`, because every field-tech screen needs a
 * working repository set to render anything meaningful at all.
 *
 * The nine fields are typed against the repository interfaces declared in
 * `modules/field-tech/src/data/ports.ts` (sibling slice S1.1). If that file
 * has not landed yet, these names will not resolve until it does — the
 * import is written now, by exact name, so this file is correct output
 * once S1.1 is present.
 */

import type {
  ChecklistRepository,
  JobPhotoRepository,
  TimeOffRepository,
  JobNoteRepository,
  TechJobRepository,
  ReimbursementRequestRepository,
  CalendarEventRepository,
  CameraRepository,
  EstimateRepository,
  TimeEntryRepository,
  JobInvestigationRepository,
} from '../data/ports';

export interface ModulePorts {
  jobs: TechJobRepository;
  checklist: ChecklistRepository;
  photos: JobPhotoRepository;
  timeOff: TimeOffRepository;
  notes: JobNoteRepository;
  reimbursements: ReimbursementRequestRepository;
  calendarEvents: CalendarEventRepository;
  camera: CameraRepository;
  estimates: EstimateRepository;
  investigations: JobInvestigationRepository;
  timeEntries: TimeEntryRepository;
  localPrefs: { getBool(key: string, defaultValue: boolean): Promise<boolean>; setBool(key: string, value: boolean): Promise<void>; };
  techs: { list(organizationId: string): Promise<{ id: string; fullName: string }[]> };
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
      'getModulePorts() called before setModulePorts() — the host must inject ports before any field-tech screen renders.',
    );
  }
  return current;
}
