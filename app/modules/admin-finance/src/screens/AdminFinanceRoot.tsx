// JobCore screen #0010 - admin-finance - Admin & Finance
// JobCore screen #0011 - af-calendar - Calendar
// JobCore screen #0012 - af-jobs - Jobs
// JobCore screen #0013 - af-overview - Overview
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
import { View, ScrollView, StyleSheet, Alert, Text, BackHandler, Platform, Pressable } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Card, ListItem, PayrollButton, EmptyState, LoadingState, ErrorState, AppChrome, confirmAsync, notifyAsync, useScreenNumber, colors, spacing, radius, typography } from '@jobcore/ui';
import type { MenuItem } from '@jobcore/ui';
import { buildAdminFinanceMenuItems, isAdminFinanceView } from '../menu';
import type { Job, JobStatus, Profile } from '@jobcore/core';
import { summarizeWorkDescription, isBetaVisible, isTestVisible, wageEngine } from '@jobcore/core';
import { moduleSwitcherItems } from '@jobcore/module-sdk';
import type { PayoutBatch } from '../money/payout-batch';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import { awaitingCloseOut } from '../domain/closeout';
import { buildOverviewCards } from '../domain/overview-cards';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';
import { mergeCommissionRecords, type CommissionAmountSource } from '../reporting/revenue';
import { LeadInboxScreen } from './LeadInboxScreen';
import { PriceSheetListScreen } from './PriceSheetListScreen';
import { PaymentsHubScreen } from './PaymentsHubScreen';
import { AssignmentBoardScreen } from './AssignmentBoardScreen';
import { ReportsScreen } from './ReportsScreen';
import { PayrollScreen } from './PayrollScreen';
import { CompensationPolicyScreen } from './CompensationPolicyScreen';
import { UniversalCalendar } from './UniversalCalendar';
import { QualifyScreen, type QualifyAxisSelection } from './QualifyScreen';
import { LeadCreateScreen } from './LeadCreateScreen';
import { LeadEditScreen } from './LeadEditScreen';
import { ArchivedJobsScreen } from './ArchivedJobsScreen';
import { PlanningScreen } from './PlanningScreen';
import { JobEstimateScreen } from './JobEstimateScreen';
import { PriceSheetEditorScreen } from './PriceSheetEditorScreen';
import { PriceSheetCreateScreen } from './PriceSheetCreateScreen';
import { EmployeeRosterScreen } from './EmployeeRosterScreen';
import { EmployeeEditorScreen } from './EmployeeEditorScreen';
import { EmployeeDetailScreen } from './EmployeeDetailScreen';
import { EmployeeJobDetailScreen } from './EmployeeJobDetailScreen';
import { BlackoutEditorScreen } from './BlackoutEditorScreen';
import { EmployeeInvitationsScreen } from './EmployeeInvitationsScreen';
import type { TechServiceArea, ServiceArea, TechSkill } from '../data/ports';
import type { Lead } from '../domain/lead';
import { assignJob } from '../flows/assign-job';
import { unassignJob } from '../flows/unassign-job';
import { assignInvestigator } from '../flows/assign-investigator';
import { qualifyLead } from '../flows/qualify-lead';
import type { TechColumnTech } from '../components/TechColumn';

type SubView =
  | 'overview' | 'jobs'
  | 'leadInbox' | 'leadCreate' | 'qualify' | 'leadEdit'
  | 'planning' | 'jobEstimate' | 'archivedJobs' | 'closedJobs'
  | 'assignmentBoard'
  | 'priceSheetList' | 'priceSheetEditor' | 'priceSheetCreate'
  | 'reports'
  | 'payments' | 'paymentReview'
  | 'employee-roster' | 'employee-detail' | 'employee-editor' | 'employee-job-detail'
  | 'employee-invitations'
  | 'blackout-editor'
  | 'payroll' | 'payrollRun' | 'payrollSettings' | 'compensationPolicy'
  | 'calendar';

const TOP: Partial<Record<SubView, SubView>> = {
  leadCreate: 'leadInbox', qualify: 'leadInbox', leadEdit: 'leadInbox',
  planning: 'jobs', jobEstimate: 'jobs', archivedJobs: 'jobs', closedJobs: 'jobs',
  priceSheetEditor: 'priceSheetList', priceSheetCreate: 'priceSheetList',
  'employee-detail': 'employee-roster', 'employee-editor': 'employee-roster',
  'employee-job-detail': 'employee-detail', 'employee-invitations': 'employee-roster',
  'blackout-editor': 'calendar',
  payrollRun: 'payroll', payrollSettings: 'payroll', compensationPolicy: 'payroll',
};

type HelpScreenKey = NonNullable<React.ComponentProps<typeof AppChrome>['helpContext']>['screenKey'];

const HELP_SCREEN_KEY: Record<SubView, HelpScreenKey> = {
  overview: 'af-overview', jobs: 'af-jobs', planning: 'af-jobs', jobEstimate: 'af-jobs', archivedJobs: 'af-jobs', closedJobs: 'af-jobs',
  leadInbox: 'af-leads', leadCreate: 'af-leads', leadEdit: 'af-leads',
  qualify: 'qualify-lead',
  assignmentBoard: 'af-assignments',
  priceSheetList: 'af-price-sheets', priceSheetEditor: 'af-price-sheets', priceSheetCreate: 'af-price-sheets',
  'blackout-editor': 'af-time-off',
  reports: 'af-reports',
  payments: 'af-payments', paymentReview: 'af-review',
  'employee-roster': 'af-employees', 'employee-detail': 'af-employees', 'employee-editor': 'af-employees',
  'employee-job-detail': 'af-employees', 'employee-invitations': 'af-employees',
  calendar: 'af-calendar',
  payroll: 'af-payments', payrollRun: 'af-payments', payrollSettings: 'af-payments', compensationPolicy: 'af-payments',
};

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; jobs: Job[]; employees: Profile[]; commissions: CommissionAmountSource[]; techServiceAreas: TechServiceArea[]; serviceAreas: ServiceArea[]; techSkills: TechSkill[]; timeOffRequests: TimeOffRequestAdmin[] }
  | { kind: 'failed'; message: string };

const BOARD_HIDDEN_STATUSES = new Set<JobStatus>(['closed', 'cancelled', 'archived']);
const PREF_KEY_SHOW_TEST_JOBS = 'admin-finance.assignment-board.show-test-jobs';
const PREF_KEY_SHOW_TEST_EMPLOYEES = 'admin-finance.assignment-board.show-test-employees';
const PREF_KEY_SHOW_TEST_EMPLOYEES_ROSTER = 'admin-finance.employee-roster.show-test-employees';

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return parsed.toLocaleDateString();
}

// Maps an archive/unarchive failure to a short, plain message.
function mapArchiveError(e: unknown, verb: 'archive' | 'unarchive'): string {
  const parts: string[] = [];
  if (e instanceof Error) parts.push(e.message);
  else if (typeof e === 'string') parts.push(e);
  if (e && typeof e === 'object') {
    const extra = e as { code?: unknown; details?: unknown; message?: unknown };
    if (typeof extra.message === 'string') parts.push(extra.message);
    if (extra.code != null) parts.push(String(extra.code));
    if (extra.details != null) parts.push(String(extra.details));
  }
  const text = parts.join(' ').toLowerCase();
  if (text.includes('customer_has_open_job')) return 'This customer already has an open job - close or archive it first.';
  if (text.includes('42501') || text.includes('permission') || text.includes('not authorized')) return 'Only an owner or admin can archive or unarchive jobs.';
  if (text.includes('online') || text.includes('connection') || text.includes('offline') || text.includes('network')) return 'Needs a connection.';
  if (/pgrst202|could not find the function|schema cache/.test(text)) return "Archive isn't available yet - the database update hasn't been applied.";
  return `Could not ${verb} the job. Try again.`;
}

// Registry keys are case-sensitive, so lowercase host sub-views fall back to #10 without this map.
const SCREEN_NUMBER_KEY: Record<string, string> = { payroll: 'Payroll', payrollRun: 'PayrollRun', payrollSettings: 'PayrollSettings', compensationPolicy: 'compensationPolicy' };

export function AdminFinanceRoot() {
  const router = useRouter();
  const [subView, setSubView] = useState<SubView>('overview');
  // Deep-link seam: the app's "Jobs" entries (module tab bar, #0009 redirect) push
  // /m/admin-finance?view=jobs&ts=<nonce>. The nonce changes the params on every tap,
  // so this re-fires even when the screen is already mounted. #0012 is the 'jobs' sub-view.
  const { view, ts } = useLocalSearchParams<{ view?: string; ts?: string }>();
  useEffect(() => {
    if (isAdminFinanceView(view)) setSubView(view);
    if (view === 'compensationPolicy') setSubView('compensationPolicy');
    if (view === 'archivedJobs') setSubView('archivedJobs');
    if (view === 'closedJobs') setSubView('closedJobs');
  }, [view, ts]);
  useScreenNumber({ subView: SCREEN_NUMBER_KEY[subView] ?? subView });
  // Android back returns to the view you came from; every view change is recorded here.
  const viewHistory = useRef<SubView[]>([]);
  const prevView = useRef<SubView>(subView);
  const poppingBack = useRef(false);
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [cardExtras, setCardExtras] = useState<{ flags: Record<string, { estimateApproved: boolean; premCompleted: boolean }>; titles: Record<string, string[]> }>({ flags: {}, titles: {} });
  const cardExtrasReq = useRef(0);
  const jobNumbers = useMemo<Record<string, number | null | undefined>>(() => {
    const map: Record<string, number | null | undefined> = {};
    for (const job of loadState.kind === 'loaded' ? loadState.jobs : []) map[job.id] = job.jobNumber;
    return map;
  }, [loadState]);
  const employeeNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const employee of loadState.kind === 'loaded' ? loadState.employees : []) map[employee.id] = employee.fullName;
    return map;
  }, [loadState]);
  const onOpenJob = (jobId: string) => router.push({ pathname: '/job/[jobId]', params: { jobId, panel: 'plan' } });
  const [showTestJobs, setShowTestJobs] = useState(false);
  const [showTestEmployees, setShowTestEmployees] = useState(true);
  const [editorIsTest, setEditorIsTest] = useState(false);
  const [editorPaidTravel, setEditorPaidTravel] = useState(false);
  const [showTestEmployeesRoster, setShowTestEmployeesRoster] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [qualifying, setQualifying] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedPriceSheetId, setSelectedPriceSheetId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [employeeHoursWorked, setEmployeeHoursWorked] = useState<{ week: number; month: number; year: number } | null>(null);
  const [selectedPayoutBatch, setSelectedPayoutBatch] = useState<PayoutBatch | null>(null);
  const [paymentsScrollTarget, setPaymentsScrollTarget] = useState<'payoutBatches' | null>(null);
  const [needsAttentionCount, setNeedsAttentionCount] = useState<number | null>(null);
  const [selectedEmployeeJob, setSelectedEmployeeJob] = useState<Job | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [techNames, setTechNames] = useState<Record<string, string>>({});
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [archivedMessage, setArchivedMessage] = useState<string | null>(null);

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

  // Deliberately outside the loader's Promise.all so a failure here cannot blank the job list.
  async function loadCardExtras(jobs: ReadonlyArray<Job>) {
    if (!orgId) {
      return;
    }
    const ids = jobs.filter((job) => !BOARD_HIDDEN_STATUSES.has(job.status)).map((job) => job.id);
    cardExtrasReq.current += 1;
    const req = cardExtrasReq.current;
    if (ids.length === 0) {
      setCardExtras({ flags: {}, titles: {} });
      return;
    }
    try {
      const [flags, titles] = await Promise.all([
        ports.jobCardExtras.listCardFlags(orgId, ids),
        ports.jobCardExtras.listWorkTitles(orgId, ids),
      ]);
      if (req === cardExtrasReq.current) {
        setCardExtras({ flags, titles });
      }
    } catch (error: unknown) {
      console.warn('Could not load job card extras.', error);
    }
  }

  const canArchive = session?.role === 'owner' || session?.role === 'admin';

  async function archiveJob(job: Job) {
    const label = job.jobNumber != null ? `Job #${job.jobNumber}` : 'this job';
    const ok = await confirmAsync('Are You Sure?', `Archive ${label}? It will be hidden from the Jobs list. You can restore it from Archived.`, 'Yes, Archive');
    if (!ok) return;
    setArchiveBusyId(job.id);
    try {
      await jobRepository.archive(job.id);
      refreshJobs();
    } catch (e) {
      await notifyAsync('Archive failed', mapArchiveError(e, 'archive'));
    } finally {
      setArchiveBusyId(null);
    }
  }

  async function unarchiveJob(jobId: string) {
    setArchivedMessage(null);
    setArchiveBusyId(jobId);
    try {
      await jobRepository.unarchive(jobId);
      refreshJobs();
    } catch (e) {
      setArchivedMessage(mapArchiveError(e, 'unarchive'));
    } finally {
      setArchiveBusyId(null);
    }
  }

  function refreshJobs() {
    if (!orgId) {
      return;
    }
    void jobRepository.listForOrganization(orgId).then((jobs) => {
      setLoadState((prev) => (prev.kind === 'loaded' ? { ...prev, jobs } : prev));
      void loadCardExtras(jobs);
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
      // Per-technician commission lines feed Reports > Commission Totals; a failed read must never block the job list.
      ports.jobPayoutLines.listCommissionLinesForOrganization(orgId).catch(() => []),
    ])
      .then(([jobs, employees, commissions, techServiceAreas, serviceAreas, techSkills, timeOffRequests, commissionLines]) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', jobs, employees, commissions: mergeCommissionRecords(commissions, commissionLines), techServiceAreas, serviceAreas, techSkills, timeOffRequests });
          void loadCardExtras(jobs);
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
    if (subView !== 'overview' || !orgId) return undefined;
    let cancelled = false;
    ports.payments.listNeedingAttention(orgId).then((rows) => { if (!cancelled) setNeedsAttentionCount(rows.length); }).catch(() => { if (!cancelled) setNeedsAttentionCount(null); });
    return () => { cancelled = true; };
  }, [subView, orgId]);

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

  const [boardTaskTitles, setBoardTaskTitles] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const repo = getModulePorts().jobPlanTasks;
    if (!repo.listTitlesForJobs || boardJobs.length === 0) return;
    let cancelled = false;
    repo
      .listTitlesForJobs(boardJobs.map((j) => j.id))
      .then((m) => {
        if (!cancelled) setBoardTaskTitles(m);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [boardJobs]);

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
      const [jobs, employees, employeesRoster] = await Promise.all([
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_JOBS, false),
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_EMPLOYEES, true),
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_EMPLOYEES_ROSTER, false),
      ]);
      if (cancelled) return;
      setShowTestJobs(jobs);
      setShowTestEmployees(employees);
      setShowTestEmployeesRoster(employeesRoster);
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
    // unassignJob calls removeForJob with kind 'installer', which deletes only
    // the installer-kind assignment rows; the investigator (Prem) row is untouched.
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
    if (subView !== 'employee-detail' || !selectedEmployee) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const payroll = getModulePorts().payroll;
        if (!payroll || !payroll.listTeamEntries) {
          if (!cancelled) setEmployeeHoursWorked(null);
          return;
        }
        const settings = await payroll.getSettings();
        const payWeek = settings.payWeek;
        const today = wageEngine.formatIsoDate(Date.now());
        const from = wageEngine.weekStartOf(wageEngine.addDays(today, -366), payWeek);
        const weeks = await payroll.listTeamEntries({ from, to: today });
        const mine = weeks.flatMap((w) => w.entries).filter((e) => e.userId === selectedEmployee.id);
        const { weekMin, monthMin, yearMin } = wageEngine.currentPeriodMinutes(mine, today, payWeek);
        if (cancelled) return;
        setEmployeeHoursWorked({ week: weekMin / 60, month: monthMin / 60, year: yearMin / 60 });
      } catch {
        if (!cancelled) setEmployeeHoursWorked(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subView, selectedEmployee]);

  useEffect(() => {
    const prev = prevView.current;
    prevView.current = subView;
    if (prev === subView) return;
    if (poppingBack.current) {
      poppingBack.current = false;
      return;
    }
    const stack = viewHistory.current;
    // An in-app return to the previous view counts as going back, so it doesn't loop.
    if (stack[stack.length - 1] === subView) stack.pop();
    else stack.push(prev);
  }, [subView]);

  /** Steps back to the previous view; false when there is nowhere left to go in this module. */
  function goBack(): boolean {
    const prev = viewHistory.current.pop();
    if (!prev) return false;
    poppingBack.current = true;
    setSubView(prev);
    return true;
  }

  // Android hardware back returns to wherever you came from; Reports owns its own handler (drill first).
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subView === 'reports') return false;
      return goBack();
    });
    return () => subscription.remove();
  }, [subView]);

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
  const [blackoutReturnView, setBlackoutReturnView] = useState<SubView>('calendar');

  const activeTechs =
    loadState.kind === 'loaded'
      ? loadState.employees.filter((e) => e.role === 'tech' && e.active)
      : [];

  function handleAddBlackout(initialTechId?: string) {
    setBlackoutInitialTechId(initialTechId);
    setBlackoutReturnView('calendar');
    setSubView('blackout-editor');
  }

  function handleBlackoutEditorSaved() {
    refreshJobs();
    setSubView(blackoutReturnView);
  }

  function handleBlackoutEditorCancel() {
    setSubView(blackoutReturnView);
  }

  function handleCalendarSelectJob(job: Job) {
    if (job.assignedTechId) {
      router.push({ pathname: '/job/[jobId]', params: { jobId: job.id, panel: 'plan' } });
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

  const optionsItems: MenuItem[] | undefined =
    subView === 'employee-editor'
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
          { id: 'gear-test-jobs', label: 'Test Jobs', onPress: () => router.push('/config/test-jobs') },
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
        helpContext={{ screenKey: HELP_SCREEN_KEY[subView] ?? 'admin-finance' }}
        breadcrumbSegments={[{ label: 'Admin & Finance' }]}
        titleBar={{ title: 'Admin & Finance', subtitle: currentScreenLabel }}
        menuItems={buildAdminFinanceMenuItems((v) => goTop(v)).map((item) => ({
          ...item,
          ...(item.id === 'leadInbox' ? { helpId: 'create' } : item.id === 'payments' ? { helpId: 'payroll_rollup' } : {}),
          isActive: (TOP[subView] ?? subView) === item.id,
        }))}
      />

      {subView === 'overview' || subView === 'jobs' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : subView === 'overview' ? (
          <ScrollView contentContainerStyle={[styles.content, styles.overviewContent]}>
            {buildOverviewCards({
              jobsOnFile: loadState.jobs.filter((job) => isBetaVisible(job, showTestJobs) && !BOARD_HIDDEN_STATUSES.has(job.status)).length,
              qualifiedOrScheduled: loadState.jobs.filter((job) => job.status === 'qualified' || job.status === 'scheduled').length,
              awaitingCloseOut: loadState.jobs.filter(awaitingCloseOut).length,
              employees: loadState.employees.filter((profile) => isTestVisible(profile, showTestEmployeesRoster) && profile.role !== 'owner').length,
              needsAttentionPayments: needsAttentionCount,
            }).map((card) => (
              <Pressable
                key={card.id}
                testID={`overview-card-${card.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${card.title}, ${card.subtitle}`}
                onPress={() => goTop(card.id)}
                style={styles.overviewCard}
              >
                <Text style={styles.overviewCardTitle}>{card.title}</Text>
                <Text style={styles.overviewCardSubtitle}>{card.subtitle}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.jobsContent}>
            <View style={styles.jobsTitleRow}>
              <Text style={styles.jobsTitle}>Jobs</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <PayrollButton label="Closed" testID="jobs-closed-btn" onPress={() => setSubView('closedJobs')} />
                <PayrollButton label="Archived" testID="jobs-archived-btn" onPress={() => { setArchivedMessage(null); setSubView('archivedJobs'); }} />
                <PayrollButton label="Add Job" onPress={() => router.push('/job/new')} />
              </View>
            </View>
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
                <Card style={[styles.card, styles.jobsCard]}>
                  {orderedJobs.map((job) => {
                    const techName = job.assignedTechId
                      ? loadState.employees.find((e) => e.id === job.assignedTechId)?.fullName ?? 'Assigned'
                      : null;
                    const jobLabel = job.jobNumber != null ? `Job #${job.jobNumber}` : null;
                    const workDescription = summarizeWorkDescription(cardExtras.titles[job.id] ?? [], job.description, { maxChars: 60 });
                    const footer = [jobLabel, workDescription || null, techName].filter(Boolean).join(' · ') || undefined;
                    const cardFlags = cardExtras.flags[job.id];
                    const dots = cardFlags?.premCompleted || cardFlags?.estimateApproved ? (
                      <>
                        {cardFlags?.premCompleted ? <View style={[styles.flagDot, { backgroundColor: colors.warning }]} accessibilityLabel="Prem done" testID={`job-flag-prem-${job.id}`} /> : null}
                        {cardFlags?.estimateApproved ? <View style={[styles.flagDot, { backgroundColor: colors.success }]} accessibilityLabel="Estimate approved" testID={`job-flag-estimate-${job.id}`} /> : null}
                      </>
                    ) : undefined;
                    return (
                      <ListItem
                        key={job.id}
                        title={job.address ?? job.description ?? job.id}
                        subtitle={formatDate(job.scheduledStart)}
                        overline={job.customerName ?? undefined}
                        footer={footer}
                        footerLines={2}
                        onPress={() => router.push({ pathname: '/job/[jobId]', params: { jobId: job.id, panel: 'plan' } })}
                        style={{ paddingVertical: spacing.xs }}
                        right={(
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            {dots}
                            {canArchive ? <PayrollButton label="Archive" testID={`job-archive-${job.id}`} disabled={archiveBusyId !== null} onPress={() => { void archiveJob(job); }} /> : null}
                            <PayrollButton label="Detail" onPress={() => router.push({ pathname: '/job/[jobId]', params: { jobId: job.id, panel: 'plan' } })} />
                          </View>
                        )}
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
      ) : subView === 'archivedJobs' ? (
        <ArchivedJobsScreen
          rows={(loadState.kind === 'loaded' ? loadState.jobs : [])
            .filter((j) => j.status === 'archived')
            .map((j) => ({ id: j.id, title: j.jobNumber != null ? `Job #${j.jobNumber}` : 'Job', subtitle: j.address ?? null }))}
          busyJobId={archiveBusyId}
          message={archivedMessage}
          onUnarchive={(id) => { void unarchiveJob(id); }} onOpenJob={onOpenJob}
          onBack={() => setSubView('jobs')}
        />
      ) : subView === 'closedJobs' ? (
        <ArchivedJobsScreen
          variant="closed"
          rows={(loadState.kind === 'loaded' ? loadState.jobs : [])
            .filter((j) => j.status === 'closed')
            .map((j) => ({ id: j.id, title: j.jobNumber != null ? `Job #${j.jobNumber}` : 'Job', subtitle: j.address ?? null }))}
          busyJobId={null}
          message={null}
          onUnarchive={() => {}} onOpenJob={onOpenJob}
          onBack={() => setSubView('jobs')}
        />
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
          serviceTasksRepo={ports.serviceTasks}
          serviceAreas={loadState.kind === 'loaded' ? loadState.serviceAreas : []}
          onPublished={handlePublished}
        />
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
          jobNumbers={jobNumbers}
          employeeNames={employeeNames}
          onOpenJob={onOpenJob}
        />
      ) : subView === 'paymentReview' ? (
        (() => {
          const { ReconciliationView, client } = getModulePorts().paymentReview;
          return <ReconciliationView client={client} jobNumbers={jobNumbers} employeeNames={employeeNames} onOpenJob={onOpenJob} />;
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
            taskTitlesByJobId={boardTaskTitles}
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
      ) : subView === 'payroll' ? (
        <PayrollScreen onBack={() => goTop('overview')} onOpenCompensationPolicy={() => setSubView('compensationPolicy')} />
      ) : subView === 'payrollRun' || subView === 'payrollSettings' ? (
        <PayrollScreen onBack={() => goTop('overview')} initialTab={subView === 'payrollRun' ? 'run' : 'settings'} onOpenCompensationPolicy={() => setSubView('compensationPolicy')} />
      ) : subView === 'compensationPolicy' ? (
        <CompensationPolicyScreen onBack={() => setSubView('payrollSettings')} />
      ) : subView === 'reports' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : (
          <ReportsScreen jobs={loadState.jobs} commissions={loadState.commissions} showTestJobs={showTestJobs} onSelectJob={(job) => { router.setParams({ view: 'reports' }); router.push({ pathname: '/job/[jobId]', params: { jobId: job.id, panel: 'plan' } }); }} onBack={goBack} />
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
            jobs={
              loadState.kind === 'loaded'
                ? loadState.jobs
                    .filter((j) => j.assignedTechId === selectedEmployee.id)
                    .sort((a, b) => (b.scheduledStart ?? '').localeCompare(a.scheduledStart ?? ''))
                : []
            }
            onSelectJob={handleSelectEmployeeJob}
            onEdit={handleEditEmployee}
            onBack={handleBackToRoster}
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
          onSetRate={async ({ userId, hourlyRateCents, effectiveFrom }) => {
            const payroll = ports.payroll;
            if (!payroll?.setRate) {
              throw new Error('Rate changes are unavailable: the payroll port is not wired.');
            }
            await payroll.setRate(
              userId,
              hourlyRateCents,
              effectiveFrom as Parameters<NonNullable<typeof payroll.setRate>>[2],
            );
          }}
        />
      ) : subView === 'blackout-editor' ? (
        <BlackoutEditorScreen
          techs={activeTechs}
          timeOffAdmin={ports.timeOffAdmin}
          initialTechId={blackoutInitialTechId}
          onSaved={handleBlackoutEditorSaved}
          onChanged={refreshJobs}
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
        <UniversalCalendar
          role="admin"
          viewerId={session.userId ?? null}
          jobs={loadState.jobs.filter((job) => isBetaVisible(job, showTestJobs))}
          employees={loadState.employees}
          timeOffRequests={loadState.timeOffRequests}
          onSelectJob={handleCalendarSelectJob}
          onSubmitTimeOff={async (draft, techId) => {
            await ports.timeOffAdmin.createBlackout(orgId!, techId, draft);
            refreshJobs();
          }}
          onCancelTimeOff={async (requestId) => {
            await ports.timeOffAdmin.cancel(requestId);
            refreshJobs();
          }}
          onSaveBlackouts={async (isoDays, techId) => {
            for (const day of isoDays) {
              await ports.timeOffAdmin.createBlackout(orgId!, techId, { startDate: day, endDate: day, reason: null });
            }
            refreshJobs();
          }}
        />
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
  archivedJobs: 'Archived Jobs',
  closedJobs: 'Closed Jobs',
  assignmentBoard: 'Assignments',
  priceSheetList: 'Price Sheets',
  priceSheetEditor: 'Price Sheet Editor',
  priceSheetCreate: 'New Price Sheet',
  reports: 'Reports',
  payments: 'Payments',
  paymentReview: 'Review',
  'employee-roster': 'Employees',
  'employee-detail': 'Employee Detail',
  'employee-job-detail': 'Employee Job Detail',
  'employee-invitations': 'Pending Invitations',
  calendar: 'Calendar',
  payroll: 'Payroll',
  payrollRun: 'Payroll Run',
  payrollSettings: 'Payroll Settings',
  compensationPolicy: 'Compensation Policy',
};

export default AdminFinanceRoot;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.md },
  card: { marginBottom: spacing.md },
  jobsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: spacing.xs,
  },
  jobsTitle: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
  },
  // #0012 Jobs: tight spacing + flag dots (Jeff 2026-10-30).
  jobsContent: { paddingHorizontal: spacing.xs, paddingTop: 2 },
  jobsCard: { paddingHorizontal: spacing.xs, paddingVertical: 0 },
  flagDot: { width: 12, height: 12, borderRadius: 6 },
  overviewContent: { paddingTop: spacing.xs },
  overviewCard: {
    minHeight: 32,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 6,
    justifyContent: 'center',
  },
  overviewCardTitle: { fontSize: typography.size.label, lineHeight: 18, fontWeight: '600', color: colors.text },
  overviewCardSubtitle: { fontSize: 12, lineHeight: 14, color: colors.textMuted },
});
