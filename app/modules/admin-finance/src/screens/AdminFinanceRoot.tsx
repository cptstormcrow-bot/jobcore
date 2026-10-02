/**
 * Route component for the admin-finance module (P3d.3).
 *
 * The host renders this with zero props (`<Screen />`) — ports are injected
 * by the host into the module-scope seam in `../lib/module-ports` (via
 * `setModulePorts`) synchronously in its own render body, BEFORE this
 * component's render body runs (see `apps\mobile\app\m\[moduleId].tsx`'s
 * admin-finance block for why that ordering is guaranteed). This component
 * therefore calls `getModulePorts()` directly, with no null-guard around it,
 * the same pattern `Reporting.tsx` (sales-marketing) uses for its ports —
 * `getModulePorts()` is fail-closed and will throw if that guarantee is ever
 * broken, which is the correct behavior (caught by the per-module Error
 * Boundary) rather than silently rendering with no data.
 *
 * The session is still read through the injected seam in `../lib/module-session`,
 * unchanged from before.
 *
 * This is an internal state-driven sub-view switcher, not a navigator —
 * `route.path` is never read here. Read-only: this screen never writes a
 * job's stage. It has no access to any write path for that field at all.
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, StyleSheet, Alert, Text } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { addDays, addMonths, subMonths, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, format } from 'date-fns';
import { Card, ListItem, Button, Select, EmptyState, LoadingState, ErrorState, WeekView, MonthView, CalendarHeader, AppChrome, colors, spacing, radius } from '@jobcore/ui';
import type { TimeOffEvent, CalendarMode, MenuItem } from '@jobcore/ui';
import type { Commission, Job, JobStatus, Profile } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import { moduleSwitcherItems } from '@jobcore/module-sdk';
import type { PayoutBatch } from '../money/payout-batch';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import { awaitingCloseOut } from '../domain/closeout';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';
import { LeadInboxScreen } from './LeadInboxScreen';
import { PriceSheetListScreen } from './PriceSheetListScreen';
import { TimeOffQueueScreen } from './TimeOffQueueScreen';
import { PaymentsHubScreen } from './PaymentsHubScreen';
import { AssignmentBoardScreen } from './AssignmentBoardScreen';
import { ReportsScreen } from './ReportsScreen';
import { QualifyScreen, type QualifyAxisSelection } from './QualifyScreen';
import { LeadCreateScreen } from './LeadCreateScreen';
import { LeadEditScreen } from './LeadEditScreen';
import { PlanningScreen } from './PlanningScreen';
import { JobEstimateScreen } from './JobEstimateScreen';
import { CloseOutQueueScreen } from './CloseOutQueueScreen';
import { CloseOutReviewScreen } from './CloseOutReviewScreen';
import { PriceSheetEditorScreen } from './PriceSheetEditorScreen';
import { PriceSheetCreateScreen } from './PriceSheetCreateScreen';
import { EmployeeRosterScreen } from './EmployeeRosterScreen';
import { EmployeeEditorScreen } from './EmployeeEditorScreen';
import { EmployeeDetailScreen } from './EmployeeDetailScreen';
import { EmployeeJobDetailScreen } from './EmployeeJobDetailScreen';
import { BlackoutEditorScreen } from './BlackoutEditorScreen';
import { EmployeeInvitationsScreen } from './EmployeeInvitationsScreen';
import type { CloseOutPhoto, TechServiceArea, ServiceArea, TechSkill, ServiceTask } from '../data/ports';
import type { CalculationResult } from '../money/types';
import type { Lead } from '../domain/lead';
import { assignJob } from '../flows/assign-job';
import { unassignJob } from '../flows/unassign-job';
import { assignInvestigator } from '../flows/assign-investigator';
import { qualifyLead } from '../flows/qualify-lead';
import { closeOutJob } from '../flows/close-out-job';
import type { TechColumnTech } from '../components/TechColumn';

type SubView =
  | 'overview' | 'jobs'
  | 'leadInbox' | 'leadCreate' | 'qualify' | 'leadEdit'
  | 'planning' | 'jobEstimate'
  | 'assignmentBoard'
  | 'closeOutQueue' | 'closeOutReview'
  | 'priceSheetList' | 'priceSheetEditor' | 'priceSheetCreate'
  | 'timeOffQueue'
  | 'reports'
  | 'payments' | 'paymentReview'
  | 'employee-roster' | 'employee-detail' | 'employee-editor' | 'employee-job-detail'
  | 'employee-invitations'
  | 'blackout-editor'
  | 'calendar';

const TOP: Partial<Record<SubView, SubView>> = {
  leadCreate: 'leadInbox', qualify: 'leadInbox', leadEdit: 'leadInbox',
  planning: 'jobs', jobEstimate: 'jobs',
  closeOutReview: 'closeOutQueue',
  priceSheetEditor: 'priceSheetList', priceSheetCreate: 'priceSheetList',
  'employee-detail': 'employee-roster', 'employee-editor': 'employee-roster',
  'employee-job-detail': 'employee-roster', 'employee-invitations': 'employee-roster',
  'blackout-editor': 'timeOffQueue',
};

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; jobs: Job[]; employees: Profile[]; commissions: Commission[]; techServiceAreas: TechServiceArea[]; serviceAreas: ServiceArea[]; techSkills: TechSkill[]; timeOffRequests: TimeOffRequestAdmin[] }
  | { kind: 'failed'; message: string };

/**
 * Expands each `TimeOffRequestAdmin` (spanning a startDate/endDate range) into one
 * `TimeOffEvent` per calendar day in range, for the shared job+time-off Calendar view.
 */
function parseCalendarDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid calendar date "${dateOnly}"`);
  }
  return new Date(year, month - 1, day);
}

function toCalendarTimeOffEvents(
  requests: TimeOffRequestAdmin[],
  techNameById: Map<string, string>,
): TimeOffEvent[] {
  const events: TimeOffEvent[] = [];
  for (const request of requests) {
    if (request.status === 'cancelled' || request.status === 'denied') continue;
    const start = parseCalendarDate(request.startDate);
    const end = parseCalendarDate(request.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }
    const techName = techNameById.get(request.techId) ?? 'Unknown tech';
    let cursor = start;
    while (cursor.getTime() <= end.getTime()) {
      events.push({
        id: `${request.id}-${cursor.toISOString().slice(0, 10)}`,
        title: `${techName}: Time off`,
        description: request.reason,
        eventTime: cursor.toISOString(),
        techId: request.techId,
      });
      cursor = addDays(cursor, 1);
    }
  }
  return events;
}

const BOARD_HIDDEN_STATUSES = new Set<JobStatus>(['closed', 'cancelled', 'archived']);
const PREF_KEY_SHOW_TEST_JOBS = 'admin-finance.assignment-board.show-test-jobs';
const PREF_KEY_SHOW_TEST_EMPLOYEES = 'admin-finance.assignment-board.show-test-employees';
const PREF_KEY_SHOW_TEST_EMPLOYEES_ROSTER = 'admin-finance.employee-roster.show-test-employees';
const SHOW_BLACKOUTS_KEY = 'admin-finance.calendar.show-blackouts';

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return parsed.toLocaleDateString();
}

export function AdminFinanceRoot() {
  const router = useRouter();
  const [subView, setSubView] = useState<SubView>('overview');
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [showTestJobs, setShowTestJobs] = useState(false);
  const [showTestEmployees, setShowTestEmployees] = useState(true);
  const [editorIsTest, setEditorIsTest] = useState(false);
  const [editorPaidTravel, setEditorPaidTravel] = useState(false);
  const [showTestEmployeesRoster, setShowTestEmployeesRoster] = useState(false);
  const [showBlackouts, setShowBlackouts] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [qualifying, setQualifying] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCloseOutJob, setSelectedCloseOutJob] = useState<Job | null>(null);
  const [selectedPriceSheetId, setSelectedPriceSheetId] = useState<string | null>(null);
  const [closeOutPhotos, setCloseOutPhotos] = useState<CloseOutPhoto[]>([]);
  const [closeOutNotes, setCloseOutNotes] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [employeeHoursWorked, setEmployeeHoursWorked] = useState<number | null>(null);
  const [selectedPayoutBatch, setSelectedPayoutBatch] = useState<PayoutBatch | null>(null);
  const [paymentsScrollTarget, setPaymentsScrollTarget] = useState<'payoutBatches' | null>(null);
  const [selectedEmployeeJob, setSelectedEmployeeJob] = useState<Job | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [calendarAnchorDay, setCalendarAnchorDay] = useState(() => new Date());
  const [selectedCalendarTechId, setSelectedCalendarTechId] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [techNames, setTechNames] = useState<Record<string, string>>({});

  const session = useModuleSession();
  const orgId = session?.org.id ?? null;
  const ports = getModulePorts();
  const {
    jobs: jobRepository,
    employees: employeeRepository,
    commissions: commissionRepository,
    techServiceAreas: techServiceAreaRepository,
  } = ports;

  function refreshEmployees() {
    if (!session) {
      return;
    }
    void employeeRepository.listEmployees(session.org.id).then((employees) => {
      setLoadState((prev) => (prev.kind === 'loaded' ? { ...prev, employees } : prev));
      setSelectedEmployee((prev) => (prev ? employees.find((e) => e.id === prev.id) ?? prev : prev));
    });
  }

  function refreshJobs() {
    if (!orgId) {
      return;
    }
    void jobRepository.listForOrganization(orgId).then((jobs) => {
      setLoadState((prev) => (prev.kind === 'loaded' ? { ...prev, jobs } : prev));
    });
    void ports.timeOffAdmin.listForOrganization(orgId).then((timeOffRequests) => {
      setLoadState((prev) => (prev.kind === 'loaded' ? { ...prev, timeOffRequests } : prev));
    });
  }

  const hasFocusedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnceRef.current) {
        hasFocusedOnceRef.current = true;
        return;
      }
      refreshJobs();
    }, [orgId, jobRepository])
  );

  useEffect(() => {
    if (!orgId) {
      return undefined;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    Promise.all([
      jobRepository.listForOrganization(orgId),
      employeeRepository.listEmployees(orgId),
      commissionRepository.listForOrganization(orgId),
      techServiceAreaRepository.listForOrganization(orgId),
      ports.serviceAreas.listForOrganization(orgId),
      ports.techSkills.listForOrganization(orgId),
      ports.timeOffAdmin.listForOrganization(orgId),
    ])
      .then(([jobs, employees, commissions, techServiceAreas, serviceAreas, techSkills, timeOffRequests]) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', jobs, employees, commissions, techServiceAreas, serviceAreas, techSkills, timeOffRequests });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load jobs.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, jobRepository, employeeRepository, commissionRepository, techServiceAreaRepository, ports.serviceAreas, ports.techSkills, ports.timeOffAdmin]);

  useEffect(() => {
    const jobs = loadState.kind === 'loaded' ? loadState.jobs : [];
    const distinctCustomerIds = Array.from(
      new Set(jobs.map((job) => job.customerId).filter((id): id is string => id !== null))
    );
    if (distinctCustomerIds.length === 0) {
      return;
    }
    let cancelled = false;
    (async () => {
      const modulePorts = getModulePorts();
      const entries = await Promise.all(
        distinctCustomerIds.map(async (id) => {
          const customer = await modulePorts.customers.getById(id);
          return [id, customer?.name ?? ''] as const;
        })
      );
      if (!cancelled) {
        setCustomerNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadState]);

  const [investigatorTechIdByJob, setInvestigatorTechIdByJob] = useState<Record<string, string>>({});
  const [boardError, setBoardError] = useState<string | null>(null);

  // Turns a raw repository/database error into a plain sentence for the board.
  function friendlyAssignError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err ?? '');
    const stripped = message.replace(/^create job assignment failed: /, '').trim();
    if (/duplicate key|unique constraint/i.test(stripped)) {
      return 'This job already has a Prem tech linked. Refresh and try again.';
    }
    if (stripped === '') {
      return 'Something went wrong. Please try again.';
    }
    return stripped;
  }

  const refreshInvestigatorTechIds = useCallback(() => {
    const jobs = loadState.kind === 'loaded' ? loadState.jobs : [];
    if (jobs.length === 0) {
      return;
    }
    void ports.jobAssignments
      .listInvestigatorTechIds(jobs.map((job) => job.id))
      .then((byJob) => {
        setInvestigatorTechIdByJob(byJob);
      })
      .catch((error: unknown) => {
        console.error('Failed to load Prem tech links', error);
      });
  }, [loadState, ports.jobAssignments]);

  useEffect(() => {
    refreshInvestigatorTechIds();
  }, [refreshInvestigatorTechIds]);

  const boardJobs = useMemo(
    () =>
      (loadState.kind === 'loaded' ? loadState.jobs : [])
        .filter((j) => !BOARD_HIDDEN_STATUSES.has(j.status))
        .map((j) => ({
          ...j,
          customerName: j.customerName || (j.customerId ? customerNames[j.customerId] || null : null),
        })),
    [loadState, customerNames],
  );

  useEffect(() => {
    const employees = loadState.kind === 'loaded' ? loadState.employees : [];
    if (employees.length === 0) {
      return;
    }
    setTechNames((prev) => ({
      ...prev,
      ...Object.fromEntries(employees.map((employee) => [employee.id, employee.fullName])),
    }));
  }, [loadState]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [jobs, employees, employeesRoster, blackouts] = await Promise.all([
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_JOBS, false),
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_EMPLOYEES, true),
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_EMPLOYEES_ROSTER, false),
        ports.localPrefs.getBool(SHOW_BLACKOUTS_KEY, true),
      ]);
      if (cancelled) return;
      setShowTestJobs(jobs);
      setShowTestEmployees(employees);
      setShowTestEmployeesRoster(employeesRoster);
      setShowBlackouts(blackouts);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void ports.localPrefs.setBool(PREF_KEY_SHOW_TEST_EMPLOYEES_ROSTER, showTestEmployeesRoster).catch((error) => {
      console.error('Failed to persist show-test-employees-roster preference', error);
    });
  }, [showTestEmployeesRoster]);

  function handleShowTestJobsChange(value: boolean) {
    setShowTestJobs(value);
    void ports.localPrefs.setBool(PREF_KEY_SHOW_TEST_JOBS, value);
  }

  function handleShowTestEmployeesChange(value: boolean) {
    setShowTestEmployees(value);
    void ports.localPrefs.setBool(PREF_KEY_SHOW_TEST_EMPLOYEES, value);
  }

  async function handleShowTestEmployeesRosterChange(value: boolean) {
    setShowTestEmployeesRoster(value);
    try {
      await ports.localPrefs.setBool(PREF_KEY_SHOW_TEST_EMPLOYEES_ROSTER, value);
    } catch (error) {
      console.error('Failed to persist show-test-employees-roster preference', error);
    }
  }

  async function handleAssign(job: Job, techId: string) {
    if (!session) {
      return;
    }
    setBoardError(null);
    const assignDeps = {
      jobs: jobRepository,
      assignments: ports.jobAssignments,
      calendarEvents: ports.calendarEvents,
      ctx: { role: session.role, now: () => new Date().toISOString() },
    };
    // Service swap: a different Service tech is already set. unassignJob clears
    // every link on the job (Prem included), so remember the Prem tech first and
    // re-link it after the new Service tech is assigned.
    const isServiceSwap = job.assignedTechId != null && job.assignedTechId !== techId;
    let rememberedPremTechId: string | null = null;
    let swapJob: Job = job;
    if (isServiceSwap) {
      try {
        rememberedPremTechId = await ports.jobAssignments.getInvestigatorTechId(job.id);
        const unassigned = await unassignJob(job, assignDeps);
        if (!unassigned.ok) {
          Alert.alert('Assignment failed', unassigned.reason);
          setBoardError(friendlyAssignError(new Error(unassigned.reason)));
          refreshInvestigatorTechIds();
          return;
        }
        swapJob = unassigned.job;
      } catch (error) {
        const message = friendlyAssignError(error);
        Alert.alert('Assignment failed', message);
        setBoardError(message);
        refreshJobs();
        refreshInvestigatorTechIds();
        return;
      }
    }
    let assignFailure: string | null = null;
    try {
      const result = await assignJob(swapJob, techId, assignDeps);
      if (!result.ok) {
        assignFailure = result.reason;
      } else if (result.job) {
        swapJob = result.job;
      }
    } catch (error) {
      // `assignJob` returns a reason for the failures it anticipates, but a
      // repository or state-machine throw would otherwise escape as an
      // unhandled rejection and surface only as a red error overlay.
      assignFailure = friendlyAssignError(error);
    }
    if (rememberedPremTechId) {
      // Try the re-link even if assignJob failed, so the Prem tech isn't lost.
      try {
        const relinked = await assignInvestigator(swapJob, rememberedPremTechId, {
          assignments: ports.jobAssignments,
          ctx: assignDeps.ctx,
        });
        if (!relinked.ok) {
          throw new Error(relinked.reason);
        }
      } catch (error) {
        if (assignFailure === null) {
          const message =
            "The new Service tech is assigned, but the Prem tech couldn't be re-added: " +
            friendlyAssignError(error);
          Alert.alert('Prem re-link failed', message);
          setBoardError(message);
        }
      }
    }
    if (assignFailure !== null) {
      Alert.alert('Assignment failed', assignFailure);
      setBoardError(friendlyAssignError(new Error(assignFailure)));
      if (isServiceSwap) {
        refreshJobs();
      }
      refreshInvestigatorTechIds();
      return;
    }
    // The board renders from `loadState.jobs`. Without this refresh the
    // just-assigned job keeps showing under "Unassigned", which reads as a
    // failed assign and invites a second Confirm press against a stale
    // in-memory status.
    refreshJobs();
    refreshInvestigatorTechIds();
  }

  async function handleUnassign(job: Job) {
    if (!session) {
      return;
    }
    setBoardError(null);
    // unassignJob calls removeForJob, which deletes every assignment row for
    // the job (Prem included), so Prem-only jobs unassign through the same path.
    try {
      const result = await unassignJob(job, {
        jobs: jobRepository,
        assignments: ports.jobAssignments,
        calendarEvents: ports.calendarEvents,
        ctx: { role: session.role, now: () => new Date().toISOString() },
      });
      if (!result.ok) {
        Alert.alert('Unassign failed', result.reason);
        setBoardError(friendlyAssignError(new Error(result.reason)));
        return;
      }
      refreshJobs();
      refreshInvestigatorTechIds();
    } catch (err) {
      Alert.alert('Unassign failed', err instanceof Error ? err.message : String(err));
      setBoardError(friendlyAssignError(err));
      refreshInvestigatorTechIds();
    }
  }

  async function handleToggleTestJobsOnly(techId: string, next: boolean) {
    try {
      await employeeRepository.updateEmployee(techId, { testJobsOnly: next });
      refreshEmployees();
    } catch (err) {
      Alert.alert('Update failed', err instanceof Error ? err.message : String(err));
    }
  }

  async function handleAssignInvestigator(job: Job, techId: string) {
    if (!session) {
      return;
    }
    setBoardError(null);
    const premDeps = {
      assignments: ports.jobAssignments,
      ctx: { role: session.role, now: () => new Date().toISOString() },
    };
    // Fresh read: the board's Prem map can be stale.
    let oldPremTechId: string | null = null;
    try {
      oldPremTechId = await ports.jobAssignments.getInvestigatorTechId(job.id);
    } catch (error) {
      const message = friendlyAssignError(error);
      Alert.alert('Prem assignment failed', message);
      setBoardError(message);
      return;
    }
    if (oldPremTechId && oldPremTechId !== techId) {
      try {
        await ports.jobAssignments.removeInvestigator(job.id);
      } catch {
        // Checked by the re-read below.
      }
      let stillLinked: string | null = oldPremTechId;
      try {
        stillLinked = await ports.jobAssignments.getInvestigatorTechId(job.id);
      } catch {
        stillLinked = oldPremTechId;
      }
      if (stillLinked) {
        const message =
          "The current Prem tech couldn't be removed, so nothing was changed. Refresh and try again.";
        Alert.alert('Prem assignment failed', message);
        setBoardError(message);
        refreshInvestigatorTechIds();
        return;
      }
    }
    let failure: string | null = null;
    try {
      const result = await assignInvestigator(job, techId, premDeps);
      if (!result.ok) {
        failure = friendlyAssignError(new Error(result.reason));
      }
    } catch (error) {
      failure = friendlyAssignError(error);
    }
    if (failure !== null) {
      Alert.alert('Prem assignment failed', failure);
      setBoardError(failure);
      if (oldPremTechId && oldPremTechId !== techId) {
        // One best-effort re-link of the old Prem tech; its error is ignored.
        try {
          await assignInvestigator(job, oldPremTechId, premDeps);
        } catch {
          // ignored
        }
      }
      refreshInvestigatorTechIds();
      return;
    }
    refreshJobs();
    refreshInvestigatorTechIds();
  }

  useEffect(() => {
    if (!selectedCloseOutJob) {
      setCloseOutPhotos([]);
      setCloseOutNotes('');
      return undefined;
    }
    let cancelled = false;
    Promise.all([
      ports.closeOutPhotos.listForJob(selectedCloseOutJob.id),
      ports.closeOutNotes.getForJob(selectedCloseOutJob.id),
    ]).then(([photos, notes]) => {
      if (!cancelled) {
        setCloseOutPhotos(photos);
        setCloseOutNotes(notes);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedCloseOutJob, ports.closeOutPhotos, ports.closeOutNotes]);

  useEffect(() => {
    if (subView !== 'employee-detail' || !selectedEmployee) {
      return undefined;
    }
    let cancelled = false;
    getModulePorts()
      .timeEntries.listForEmployee(selectedEmployee.id)
      .then((entries) => {
        if (cancelled) return;
        const totalHours = entries.reduce((sum, entry) => {
          if (!entry.clockOutAt) return sum;
          const durationMs = new Date(entry.clockOutAt).getTime() - new Date(entry.clockInAt).getTime();
          return sum + (durationMs > 0 ? durationMs / 3600000 : 0);
        }, 0);
        setEmployeeHoursWorked(totalHours);
      })
      .catch(() => {
        if (!cancelled) setEmployeeHoursWorked(null);
      });
    return () => {
      cancelled = true;
    };
  }, [subView, selectedEmployee]);

  function handleSelectLead(lead: Lead) {
    setSelectedLead(lead);
    setSubView('leadEdit');
  }

  function handleQualifySubmit(selection: QualifyAxisSelection) {
    if (!session || !selectedLead) {
      return;
    }
    if (qualifying) {
      return;
    }
    setQualifying(true);
    const qualifiedLead: Lead = { ...selectedLead, ...selection };
    setQualifyError(null);
    void qualifyLead(qualifiedLead, selection.serviceAreaId, {
      jobs: jobRepository,
      leads: ports.leads,
      customers: ports.customers,
      calendarEvents: ports.calendarEvents,
      ctx: { role: session.role, now: () => new Date().toISOString() },
    }).then(async (result) => {
      if (!result.ok) {
        setQualifyError(result.reason);
        return;
      }
      await refreshJobs();
      setSelectedLead(null);
      setSubView('leadInbox');
    }).finally(() => {
      setQualifying(false);
    });
  }

  function handleQualifyCancel() {
    setQualifyError(null);
    setSubView('leadEdit');
  }

  function handleSelectCloseOutJob(job: Job) {
    setSelectedCloseOutJob(job);
    setSubView('closeOutReview');
  }

  function handleRemovePhoto(photoId: string) {
    void ports.closeOutPhotos.remove(photoId).then(() => {
      setCloseOutPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    });
  }

  function handleChangeNotes(notes: string) {
    setCloseOutNotes(notes);
    if (selectedCloseOutJob) {
      void ports.closeOutNotes.upsert(selectedCloseOutJob.id, notes);
    }
  }

  function handleCloseOut(job: Job) {
    if (!session) {
      return;
    }
    void closeOutJob(job, {
      ctx: { role: session.role, now: () => new Date().toISOString() },
      jobs: jobRepository,
      calendarEvents: ports.calendarEvents,
      priceSheetRepository: ports.priceSheets,
      // TODO(forward contract): no per-actor CompensationPolicy repository/field
      // exists yet on ModuleSession or ModulePorts — placeholder zero-policy
      // used until one is wired up.
      compensationPolicy: { id: '', organizationId: session.org.id, commissionBasisPercent: 0, hourlyRate: 0 },
      rates: [],
      commissionRepository: commissionRepository,
      closedByUserId: session.userId,
    }).then((result) => {
      if (result.ok) {
        setSelectedCloseOutJob(null);
        setSubView('closeOutQueue');
      }
    });
  }

  function handleSelectPriceSheet(sheetId: string) {
    setSelectedPriceSheetId(sheetId);
    setSubView('priceSheetEditor');
  }

  function handleCreatePriceSheet() {
    setSubView('priceSheetCreate');
  }

  function handlePriceSheetCreated(newSheet: { id: string }) {
    setSelectedPriceSheetId(newSheet.id);
    setSubView('priceSheetEditor');
  }

  function handleCancelPriceSheetCreate() {
    setSubView('priceSheetList');
  }

  function handlePublished() {
    setSelectedPriceSheetId(null);
    setSubView('priceSheetList');
  }

  function handleSelectPayoutBatch(batch: PayoutBatch) {
    setSelectedPayoutBatch(batch);
  }

  function handleBackToPayoutBatches() {
    setSelectedPayoutBatch(null);
  }

  function handleSelectEmployee(profile: Profile) {
    setSelectedEmployee(profile);
    setSubView('employee-detail');
  }

  function handleAddEmployee() {
    setSelectedEmployee(null);
    setEditorIsTest(false);
    setEditorPaidTravel(false);
    setSubView('employee-editor');
  }

  function handleEditEmployee() {
    setEditorIsTest(selectedEmployee?.isTest ?? false);
    setEditorPaidTravel(selectedEmployee?.paidTravel ?? false);
    setSubView('employee-editor');
  }

  function handleBackToRoster() {
    setSubView('employee-roster');
  }

  function handleSelectEmployeeJob(job: Job) {
    setSelectedEmployeeJob(job);
    setSubView('employee-job-detail');
  }

  function handleEmployeeEditorSaved() {
    refreshEmployees();
    setSubView(selectedEmployee ? 'employee-detail' : 'employee-roster');
  }

  function handleEmployeeEditorCancel() {
    setSubView(selectedEmployee ? 'employee-detail' : 'employee-roster');
  }

  function handleDeactivateEmployee() {
    if (!selectedEmployee) {
      return;
    }
    void employeeRepository.deactivateEmployee(selectedEmployee.id).then(() => {
      refreshEmployees();
    });
  }

  function handleReactivateEmployee() {
    if (!selectedEmployee) {
      return;
    }
    void employeeRepository.reactivateEmployee(selectedEmployee.id).then(() => {
      refreshEmployees();
    });
  }

  function handleBackToEmployeeDetail() {
    setSubView('employee-detail');
  }

  const [blackoutInitialTechId, setBlackoutInitialTechId] = useState<string | undefined>(undefined);
  const [blackoutReturnView, setBlackoutReturnView] = useState<SubView>('timeOffQueue');

  function handleAddBlackout(initialTechId?: string) {
    setBlackoutInitialTechId(initialTechId);
    setBlackoutReturnView(subView === 'calendar' ? 'calendar' : 'timeOffQueue');
    setSubView('blackout-editor');
  }

  function handleBlackoutEditorSaved() {
    refreshJobs();
    setSubView(blackoutReturnView);
  }

  function handleBlackoutEditorCancel() {
    setSubView(blackoutReturnView);
  }

  function handleCalendarPrev(): void {
    setCalendarAnchorDay((prev) => (calendarMode === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1)));
  }

  function handleCalendarNext(): void {
    setCalendarAnchorDay((prev) => (calendarMode === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1)));
  }

  function handleCalendarToday(): void {
    setCalendarAnchorDay(calendarMode === 'month' ? startOfMonth(new Date()) : new Date());
  }

  function handleCalendarSelectJob(job: Job) {
    if (job.assignedTechId) {
      router.push('/job/' + job.id);
      return;
    }
    if (selectedCalendarTechId) {
      handleAssign(job, selectedCalendarTechId);
      return;
    }
    setSubView('assignmentBoard');
  }

  const currentScreenLabel =
    subView === 'employee-editor'
      ? selectedEmployee
        ? 'Edit Employee'
        : 'Add Employee'
      : subView === 'blackout-editor'
        ? 'Add Blackout'
        : SUBVIEW_LABELS[subView];

  const handleShowBlackoutsChange = (v: boolean) => {
    setShowBlackouts(v);
    void ports.localPrefs.setBool(SHOW_BLACKOUTS_KEY, v);
  };

  const optionsItems: MenuItem[] | undefined =
    subView === 'calendar'
      ? [
          {
            id: 'show-blackouts',
            label: 'Show Blackouts',
            kind: 'toggle',
            checked: showBlackouts,
            onToggle: handleShowBlackoutsChange,
          },
        ]
      : subView === 'employee-editor'
        ? [
            {
              id: 'test-employee',
              label: 'Test Employee',
              kind: 'toggle',
              checked: editorIsTest,
              onToggle: setEditorIsTest,
            },
            {
              id: 'paid-travel',
              label: 'Paid Travel',
              kind: 'toggle',
              checked: editorPaidTravel,
              onToggle: setEditorPaidTravel,
            },
          ]
        : subView === 'employee-roster'
          ? [
              {
                id: 'show-test-employees',
                label: 'Show Test Employees',
                kind: 'toggle',
                checked: showTestEmployeesRoster,
                onToggle: (next: boolean) => {
                  void handleShowTestEmployeesRosterChange(next);
                },
              },
            ]
          : subView === 'assignmentBoard'
            ? [
                {
                  id: 'show-test-jobs',
                  label: 'Show Test Jobs',
                  kind: 'toggle',
                  checked: showTestJobs,
                  onToggle: handleShowTestJobsChange,
                },
                {
                  id: 'show-test-employees',
                  label: 'Show Test Employees',
                  kind: 'toggle',
                  checked: showTestEmployees,
                  onToggle: handleShowTestEmployeesChange,
                },
              ]
            : undefined;

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Admin & Finance"
          message="Sign in to view this organization's jobs, price sheets, and pay periods."
        />
      </View>
    );
  }

  // Navigating to a top-level tab or breadcrumb root intentionally discards any
  // in-progress, unsaved lead edit with no confirmation prompt.
  function goTop(view: SubView) {
    setSelectedLead(null);
    setSelectedPayoutBatch(null);
    setPaymentsScrollTarget(null);
    setSubView(view);
  }

  return (
    <View style={styles.screen}>
      <AppChrome
        showBack={false}
        compactMenu
        fitMenu
        gearTitle="Configuration"
        gearItems={[
          { id: 'gear-logins', label: 'Logins', onPress: () => router.push('/account') },
          { id: 'gear-settings', label: 'Settings', onPress: () => router.push('/config/settings') },
          { id: 'gear-profile', label: 'Profile', onPress: () => router.push('/profile') },
        ]}
        logoMenuItems={[
          {
            id: 'logo-/m/admin-finance',
            label: 'Admin & Finance',
            onPress: () => router.push('/m/admin-finance' as never),
            isActive: true,
          },
          ...moduleSwitcherItems('admin-finance', session.role).map((row) => ({
            id: 'logo-' + row.route,
            label: row.label,
            onPress: () => router.push(row.route as never),
            isActive: false,
          })),
        ]}
        optionsItems={optionsItems}
        helpContext={{ screenKey: 'admin-finance' }}
        breadcrumbSegments={[{ label: 'Admin & Finance' }]}
        titleBar={{ title: 'Admin & Finance', subtitle: currentScreenLabel }}
        menuItems={[
          { id: 'overview', label: 'Overview', onPress: () => goTop('overview'), isActive: (TOP[subView] ?? subView) === 'overview' },
          { id: 'leadInbox', label: 'Leads', onPress: () => goTop('leadInbox'), isActive: (TOP[subView] ?? subView) === 'leadInbox' },
          { id: 'jobs', label: 'Jobs', onPress: () => goTop('jobs'), isActive: (TOP[subView] ?? subView) === 'jobs' },
          { id: 'assignmentBoard', label: 'Assignments', onPress: () => goTop('assignmentBoard'), isActive: (TOP[subView] ?? subView) === 'assignmentBoard' },
          { id: 'closeOutQueue', label: 'Close-Outs', onPress: () => goTop('closeOutQueue'), isActive: (TOP[subView] ?? subView) === 'closeOutQueue' },
          { id: 'priceSheetList', label: 'Price Sheets', onPress: () => goTop('priceSheetList'), isActive: (TOP[subView] ?? subView) === 'priceSheetList' },
          { id: 'payments', label: 'Payments', onPress: () => goTop('payments'), isActive: (TOP[subView] ?? subView) === 'payments' },
          { id: 'paymentReview', label: 'Review', onPress: () => goTop('paymentReview'), isActive: (TOP[subView] ?? subView) === 'paymentReview' },
          { id: 'timeOffQueue', label: 'Time Off', onPress: () => goTop('timeOffQueue'), isActive: (TOP[subView] ?? subView) === 'timeOffQueue' },
          { id: 'calendar', label: 'Calendar', onPress: () => goTop('calendar'), isActive: (TOP[subView] ?? subView) === 'calendar' },
          { id: 'reports', label: 'Reports', onPress: () => goTop('reports'), isActive: (TOP[subView] ?? subView) === 'reports' },
          { id: 'employee-roster', label: 'Employees', onPress: () => goTop('employee-roster'), isActive: (TOP[subView] ?? subView) === 'employee-roster' },
        ]}
      />

      {subView === 'overview' || subView === 'jobs' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : subView === 'overview' ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Card style={styles.card}>
              <ListItem
                title="Leads"
                subtitle="View leads"
                onPress={() => setSubView('leadInbox')}
              />
            </Card>
            <Card style={styles.card}>
              <ListItem
                title="Jobs"
                subtitle={`${loadState.jobs.filter((job) => isBetaVisible(job, showTestJobs) && !BOARD_HIDDEN_STATUSES.has(job.status)).length} on file for this organization`}
                onPress={() => setSubView('jobs')}
              />
            </Card>
            <Card style={styles.card}>
              <ListItem
                title="Assignments"
                subtitle={`${loadState.jobs.filter((job) => job.status === 'qualified' || job.status === 'scheduled').length} qualified or scheduled`}
                onPress={() => setSubView('assignmentBoard')}
              />
            </Card>
            <Card style={styles.card}>
              <ListItem
                title="Close-Outs"
                subtitle={`${loadState.jobs.filter(awaitingCloseOut).length} awaiting close-out`}
                onPress={() => setSubView('closeOutQueue')}
              />
            </Card>
            <Card style={styles.card}>
              <ListItem
                title="Payouts"
                subtitle="View payout batches"
                onPress={() => {
                  setSubView('payments');
                  setPaymentsScrollTarget('payoutBatches');
                }}
              />
            </Card>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Button
              label="Add Job"
              variant="primary"
              size="sm"
              fullWidth
              onPress={() => router.push('/job/new')}
              style={styles.card}
            />
            {(() => {
              const visibleJobs = loadState.jobs.filter(
                (job) => isBetaVisible(job, showTestJobs) && !BOARD_HIDDEN_STATUSES.has(job.status),
              );
              if (visibleJobs.length === 0) {
                return <EmptyState title="No jobs" message="This organization has no jobs on file." />;
              }
              // Unassigned first so jobs still needing a tech stay at the top.
              const orderedJobs = [
                ...visibleJobs.filter((job) => !job.assignedTechId),
                ...visibleJobs.filter((job) => !!job.assignedTechId),
              ];
              return (
                <Card style={styles.card}>
                  {orderedJobs.map((job) => {
                    const techName = job.assignedTechId
                      ? loadState.employees.find((e) => e.id === job.assignedTechId)?.fullName ?? 'Assigned'
                      : null;
                    const jobLabel = job.jobNumber != null ? `Job #${job.jobNumber}` : null;
                    const footer = [jobLabel, techName].filter(Boolean).join(' · ') || undefined;
                    return (
                      <ListItem
                        key={job.id}
                        title={job.address ?? job.description ?? job.id}
                        subtitle={formatDate(job.scheduledStart)}
                        overline={job.customerName ?? undefined}
                        footer={footer}
                        onPress={() => router.push('/job/' + job.id)}
                        right={<Button label="Plan" size="sm" onPress={() => router.push('/job/' + job.id + '?panel=plan')} />}
                      />
                    );
                  })}
                </Card>
              );
            })()}
          </ScrollView>
        )
      ) : subView === 'leadInbox' ? (
        <LeadInboxScreen leads={ports.leads} onSelectLead={handleSelectLead} onCreateLead={() => setSubView('leadCreate')} />
      ) : subView === 'leadCreate' ? (
        <LeadCreateScreen
          onCreated={(lead) => {
            setSelectedLead(lead);
            setSubView('leadEdit');
          }}
          onCancel={() => setSubView('leadInbox')}
        />
      ) : subView === 'leadEdit' ? (
        selectedLead ? (
          <LeadEditScreen
            key={selectedLead.id}
            lead={selectedLead}
            onSaved={setSelectedLead}
            onCreateJob={(saved) => {
              setSelectedLead(saved);
              setSubView('qualify');
            }}
            onBack={() => {
              setSelectedLead(null);
              setSubView('leadInbox');
            }}
          />
        ) : (
          <EmptyState title="No lead selected." />
        )
      ) : subView === 'qualify' ? (
        selectedLead ? (
          <>
            {qualifyError && <ErrorState message={qualifyError} />}
            <QualifyScreen
              lead={selectedLead}
              serviceAreas={loadState.kind === 'loaded' ? loadState.serviceAreas : []}
              onSubmit={handleQualifySubmit}
              onCancel={handleQualifyCancel}
              disabled={qualifying}
            />
          </>
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Qualify lead" message="No lead selected." />
          </View>
        )
      ) : subView === 'planning' ? (
        <PlanningScreen
          jobs={loadState.kind === 'loaded' ? loadState.jobs : []}
          initialSelectedJobId={selectedJob?.id}
          jobPlanTasks={ports.jobPlanTasks}
          onBack={() => setSubView('jobs')}
        />
      ) : subView === 'jobEstimate' ? (
        selectedJob ? (
          <JobEstimateScreen job={selectedJob} onBack={() => setSubView('jobs')} />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Job estimate" message="No job selected." />
          </View>
        )
      ) : subView === 'priceSheetList' ? (
        <PriceSheetListScreen
          priceSheets={ports.priceSheets}
          onSelectSheet={(sheet) => handleSelectPriceSheet(sheet.id)}
          onCreateNew={handleCreatePriceSheet}
        />
      ) : subView === 'priceSheetCreate' ? (
        <PriceSheetCreateScreen
          onCreated={handlePriceSheetCreated}
          onCancel={handleCancelPriceSheetCreate}
        />
      ) : subView === 'priceSheetEditor' ? (
        <PriceSheetEditorScreen
          priceSheets={ports.priceSheets}
          priceSheetId={selectedPriceSheetId ?? undefined}
          publishRepo={ports.priceSheetPublish}
          areaAdjustmentsRepo={ports.priceSheetAreaAdjustments}
          ratesRepo={ports.priceSheetRates}
          serviceTasksRepo={
            // FX-13 gate repair: module-ports.ts's serviceTasks type is out of
            // this wave's scope and has not been extended with listServices,
            // even though the runtime repo (admin-finance-repos.ts) implements
            // it. Widen the type locally rather than edit the out-of-scope file.
            ports.serviceTasks as typeof ports.serviceTasks & {
              listServices(organizationId: string): Promise<Array<{ id: string; name: string }>>;
              save(
                organizationId: string,
                serviceId: string,
                name: string,
                extra?: {
                  estimatedMinutes?: number | null;
                  rate?: number | null;
                  category?: string | null;
                  active?: boolean;
                  priceCents?: number | null;
                  details?: string | null;
                  materials?: string | null;
                }
              ): Promise<CalculationResult<ServiceTask>>;
              updateServiceTask(
                taskId: string,
                patch: {
                  name?: string;
                  estimatedMinutes?: number | null;
                  rate?: number | null;
                  category?: string | null;
                  active?: boolean;
                  priceCents?: number | null;
                  details?: string | null;
                  materials?: string | null;
                }
              ): Promise<CalculationResult<ServiceTask>>;
              remove(taskId: string): Promise<CalculationResult<void>>;
            }
          }
          serviceAreas={loadState.kind === 'loaded' ? loadState.serviceAreas : []}
          onPublished={handlePublished}
        />
      ) : subView === 'closeOutQueue' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : (
          <CloseOutQueueScreen
            jobs={loadState.jobs}
            ctx={{ role: session.role, now: () => new Date().toISOString() }}
            onSelectJob={handleSelectCloseOutJob}
            customerNames={customerNames}
            techNames={techNames}
          />
        )
      ) : subView === 'closeOutReview' ? (
        selectedCloseOutJob ? (
          <CloseOutReviewScreen
            job={selectedCloseOutJob}
            ctx={{ role: session.role, now: () => new Date().toISOString() }}
            photos={closeOutPhotos}
            notes={closeOutNotes}
            onRemovePhoto={handleRemovePhoto}
            onChangeNotes={handleChangeNotes}
            onCloseOut={handleCloseOut}
            // TODO(forward-contract): wire real timeEntries once available
            hoursLogged={undefined}
            // TODO(forward-contract): resolve tech payouts from commissions/payments once wired
            techPayouts={undefined}
            // TODO(forward-contract): resolve contractor payouts from price sheet once wired
            contractorPayouts={undefined}
            // TODO(forward-contract): no locally-resolved customer object (with phone/email) is
            // available for the selected close-out job — only customerNames (id -> name) exists;
            // wire once a customer lookup is available here without adding a new repository call.
            customerContacts={undefined}
          />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Close out" message="No job selected." />
          </View>
        )
      ) : subView === 'timeOffQueue' ? (
        <TimeOffQueueScreen timeOffAdmin={ports.timeOffAdmin} onAddBlackout={handleAddBlackout} />
      ) : subView === 'payments' ? (
        <PaymentsHubScreen
          payments={ports.payments}
          reimbursements={ports.reimbursements}
          payoutBatches={ports.payoutBatches}
          selectedPayoutBatch={selectedPayoutBatch}
          onSelectPayoutBatch={handleSelectPayoutBatch}
          onBackFromPayoutBatch={handleBackToPayoutBatches}
          scrollToSection={paymentsScrollTarget}
          onScrollHandled={() => setPaymentsScrollTarget(null)}
        />
      ) : subView === 'paymentReview' ? (
        (() => {
          const { ReconciliationView, client } = getModulePorts().paymentReview;
          return <ReconciliationView client={client} />;
        })()
      ) : subView === 'assignmentBoard' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : (
          <>
          {boardError ? (
            <Text style={{ color: colors.danger, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              {boardError}
            </Text>
          ) : null}
          <AssignmentBoardScreen
            jobs={boardJobs}
            techs={loadState.employees.map(
              (profile): TechColumnTech => ({
                id: profile.id,
                fullName: profile.fullName,
                phone: profile.phone,
                isTest: profile.isTest,
                testJobsOnly: profile.testJobsOnly ?? false,
                role: profile.role,
                active: profile.active,
              }),
            )}
            resolveServiceAreaId={(job) => job.service_area_id ?? null}
            techServiceAreas={loadState.techServiceAreas}
            onAssign={handleAssign}
            onAssignInvestigator={handleAssignInvestigator}
            investigatorTechIdByJob={investigatorTechIdByJob}
            onUnassign={handleUnassign}
            onToggleTestJobsOnly={handleToggleTestJobsOnly}
            onSelectEmployee={(techId) => {
              const p = loadState.employees.find((e) => e.id === techId);
              if (p) handleSelectEmployee(p);
            }}
            showTestJobs={showTestJobs}
            showTestEmployees={showTestEmployees}
          />
          </>
        )
      ) : subView === 'reports' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : (
          <ReportsScreen jobs={loadState.jobs} commissions={loadState.commissions} showTestJobs={showTestJobs} onSelectJob={(job) => router.push('/job/' + job.id)} onBack={() => goTop('overview')} />
        )
      ) : subView === 'employee-roster' ? (
        <EmployeeRosterScreen
          employees={employeeRepository}
          onSelectEmployee={handleSelectEmployee}
          onAddEmployee={handleAddEmployee}
          onViewInvitations={() => setSubView('employee-invitations')}
          showTest={showTestEmployeesRoster}
        />
      ) : subView === 'employee-invitations' ? (
        <EmployeeInvitationsScreen
          invitations={ports.invitations}
          onBack={handleBackToRoster}
        />
      ) : subView === 'employee-detail' ? (
        selectedEmployee ? (
          <EmployeeDetailScreen
            employee={selectedEmployee}
            jobs={
              loadState.kind === 'loaded'
                ? loadState.jobs.filter((job) => job.assignedTechId === selectedEmployee.id)
                : []
            }
            skills={
              loadState.kind === 'loaded'
                ? loadState.techSkills.filter((s) => s.techId === selectedEmployee.id).map((s) => s.skill)
                : []
            }
            serviceAreas={
              loadState.kind === 'loaded'
                ? loadState.techServiceAreas
                    .filter((tsa) => tsa.techId === selectedEmployee.id)
                    .map((tsa) => loadState.serviceAreas.find((a) => a.id === tsa.serviceAreaId)?.name)
                    .filter((n): n is string => Boolean(n))
                    .sort((x, y) => x.localeCompare(y))
                : []
            }
            hoursWorked={employeeHoursWorked ?? undefined}
            onEdit={handleEditEmployee}
            onBack={handleBackToRoster}
            onSelectJob={handleSelectEmployeeJob}
            onDeactivate={handleDeactivateEmployee}
            onReactivate={handleReactivateEmployee}
          />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Employee" message="No employee selected." />
          </View>
        )
      ) : subView === 'employee-editor' ? (
        <EmployeeEditorScreen
          employees={employeeRepository}
          invitations={ports.invitations}
          serviceAreas={ports.serviceAreas}
          techServiceAreas={ports.techServiceAreas}
          techSkills={ports.techSkills}
          profile={selectedEmployee ?? undefined}
          onSaved={handleEmployeeEditorSaved}
          onCancel={handleEmployeeEditorCancel}
          isTest={editorIsTest}
          onIsTestChange={setEditorIsTest}
          paidTravel={editorPaidTravel}
          onPaidTravelChange={setEditorPaidTravel}
        />
      ) : subView === 'blackout-editor' ? (
        <BlackoutEditorScreen
          techs={
            loadState.kind === 'loaded'
              ? loadState.employees.filter((e) => e.role === 'tech' && e.active)
              : []
          }
          timeOffAdmin={ports.timeOffAdmin}
          initialTechId={blackoutInitialTechId}
          onSaved={handleBlackoutEditorSaved}
          onCancel={handleBlackoutEditorCancel}
        />
      ) : subView === 'employee-job-detail' ? (
        selectedEmployeeJob ? (
          <EmployeeJobDetailScreen
            job={selectedEmployeeJob}
            techName={
              loadState.kind === 'loaded'
                ? new Map(loadState.employees.map((t) => [t.id, t.fullName])).get(selectedEmployeeJob.assignedTechId ?? '')
                : undefined
            }
            onBack={handleBackToEmployeeDetail}
          />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Job" message="No job selected." />
          </View>
        )
      ) : subView === 'calendar' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : (
          (() => {
            const techs = loadState.employees.filter((e) => e.role === 'tech' && e.active);
            const techNameById = new Map(techs.map((t) => [t.id, t.fullName]));
            const calendarJobs = loadState.jobs
              .filter(
                (job) =>
                  job.scheduledStart &&
                  isBetaVisible(job, showTestJobs) &&
                  (!selectedCalendarTechId || job.assignedTechId === selectedCalendarTechId),
              )
              .map((job) =>
                !selectedCalendarTechId
                  ? { ...job, address: `${techNameById.get(job.assignedTechId ?? '') ?? 'Unassigned'}: ${job.address ?? 'No address'}` }
                  : job,
              );
            const calendarTimeOffEvents = toCalendarTimeOffEvents(
              loadState.timeOffRequests.filter((r) => showBlackouts || r.createdByAdminId === null),
              techNameById,
            ).filter(
              (e) => !selectedCalendarTechId || e.techId === selectedCalendarTechId,
            );
            const label =
              calendarMode === 'month'
                ? format(calendarAnchorDay, 'MMMM yyyy')
                : `${format(startOfWeek(calendarAnchorDay, { weekStartsOn: 0 }), 'MMM d')} – ${format(
                    endOfWeek(calendarAnchorDay, { weekStartsOn: 0 }),
                    'MMM d, yyyy'
                  )}`;
            return (
              <View style={styles.screen}>
                <View style={styles.content}>
                  <View style={styles.calendarToolbar}>
                    <CalendarHeader
                      mode={calendarMode}
                      onModeChange={setCalendarMode}
                      label={label}
                      onPrev={handleCalendarPrev}
                      onNext={handleCalendarNext}
                      onToday={handleCalendarToday}
                    />
                    <Select
                      label="Technicians"
                      value={selectedCalendarTechId}
                      onChange={(v) => setSelectedCalendarTechId(v === '' ? null : v)}
                      placeholder="All Techs"
                      options={[{ label: 'All Techs', value: '' }, ...techs.map((t) => ({ label: t.fullName, value: t.id }))]}
                      style={styles.calendarTechSelect}
                    />
                    <Button
                      label="Add Blackout"
                      size="sm"
                      onPress={() => handleAddBlackout(selectedCalendarTechId ?? undefined)}
                    />
                  </View>
                </View>
                {calendarMode === 'week' ? (
                  <WeekView
                    jobs={calendarJobs}
                    anchorDay={calendarAnchorDay}
                    timeOffEvents={calendarTimeOffEvents}
                    onSelectJob={handleCalendarSelectJob}
                  />
                ) : (
                  <MonthView
                    variant="list"
                    jobs={calendarJobs}
                    anchorDay={calendarAnchorDay}
                    timeOffEvents={calendarTimeOffEvents}
                    onSelectJob={handleCalendarSelectJob}
                  />
                )}
              </View>
            );
          })()
        )
      ) : (
        <View style={styles.screen}>
          <EmptyState title="Coming soon" message="This tab is not wired up yet." />
        </View>
      )}
    </View>
  );
}

const SUBVIEW_LABELS: Record<Exclude<SubView, 'employee-editor' | 'blackout-editor'>, string> = {
  overview: 'Overview',
  jobs: 'Jobs',
  leadInbox: 'Leads',
  leadCreate: 'New Lead',
  qualify: 'Qualify Lead',
  leadEdit: 'Edit Lead',
  planning: 'Planning',
  jobEstimate: 'Job Estimate',
  assignmentBoard: 'Assignments',
  closeOutQueue: 'Close-Outs',
  closeOutReview: 'Close-Out Review',
  priceSheetList: 'Price Sheets',
  priceSheetEditor: 'Price Sheet Editor',
  priceSheetCreate: 'New Price Sheet',
  timeOffQueue: 'Time Off',
  reports: 'Reports',
  payments: 'Payments',
  paymentReview: 'Review',
  'employee-roster': 'Employees',
  'employee-detail': 'Employee Detail',
  'employee-job-detail': 'Employee Job Detail',
  'employee-invitations': 'Pending Invitations',
  calendar: 'Calendar',
};

export default AdminFinanceRoot;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.md },
  card: { marginBottom: spacing.md },
  calendarToolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  calendarTechSelect: { width: 180 },
});
