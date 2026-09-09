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
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { addDays, addMonths, subMonths, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, format } from 'date-fns';
import { Card, ListItem, Button, Select, TabBar, EmptyState, LoadingState, ErrorState, Breadcrumb, WeekView, MonthView, CalendarHeader, colors, spacing, radius } from '@jobcore/ui';
import type { TimeOffEvent, CalendarMode } from '@jobcore/ui';
import type { Commission, Job, Profile } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
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
import { ReportsJobDetailScreen } from '../screens/ReportsJobDetailScreen';
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
import type { CloseOutPhoto, TechServiceArea, ServiceArea, TechSkill } from '../data/ports';
import type { Lead } from '../domain/lead';
import { assignJob } from '../flows/assign-job';
import { qualifyLead } from '../flows/qualify-lead';
import { transitionJob } from '../domain/transition';
import type { TechColumnTech } from '../components/TechColumn';

type SubView =
  | 'overview' | 'jobs'
  | 'leadInbox' | 'leadCreate' | 'qualify' | 'leadEdit'
  | 'planning' | 'jobEstimate'
  | 'assignmentBoard'
  | 'closeOutQueue' | 'closeOutReview'
  | 'priceSheetList' | 'priceSheetEditor' | 'priceSheetCreate'
  | 'timeOffQueue'
  | 'reports' | 'reports-job-detail'
  | 'payments'
  | 'employee-roster' | 'employee-detail' | 'employee-editor' | 'employee-job-detail'
  | 'employee-invitations'
  | 'blackout-editor'
  | 'calendar';

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

export function AdminFinanceRoot() {
  const router = useRouter();
  const [subView, setSubView] = useState<SubView>('overview');
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [showTestJobs, setShowTestJobs] = useState(false);
  const [showTestEmployees, setShowTestEmployees] = useState(false);
  const [showTestEmployeesRoster, setShowTestEmployeesRoster] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [qualifying, setQualifying] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCloseOutJob, setSelectedCloseOutJob] = useState<Job | null>(null);
  const [selectedPriceSheetId, setSelectedPriceSheetId] = useState<string | null>(null);
  const [closeOutPhotos, setCloseOutPhotos] = useState<CloseOutPhoto[]>([]);
  const [closeOutNotes, setCloseOutNotes] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [selectedPayoutBatch, setSelectedPayoutBatch] = useState<PayoutBatch | null>(null);
  const [paymentsScrollTarget, setPaymentsScrollTarget] = useState<'payoutBatches' | null>(null);
  const [selectedEmployeeJob, setSelectedEmployeeJob] = useState<Job | null>(null);
  const [selectedReportsJob, setSelectedReportsJob] = useState<Job | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [calendarAnchorDay, setCalendarAnchorDay] = useState(() => new Date());
  const [selectedCalendarTechId, setSelectedCalendarTechId] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month');

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
    let cancelled = false;
    void (async () => {
      const [jobs, employees, employeesRoster] = await Promise.all([
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_JOBS, false),
        ports.localPrefs.getBool(PREF_KEY_SHOW_TEST_EMPLOYEES, false),
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
    try {
      const result = await assignJob(job, techId, {
        jobs: jobRepository,
        assignments: ports.jobAssignments,
        calendarEvents: ports.calendarEvents,
        ctx: { role: session.role, now: () => new Date().toISOString() },
      });
      if (!result.ok) {
        Alert.alert('Assignment failed', result.reason);
        return;
      }
    } catch (error) {
      // `assignJob` returns a reason for the failures it anticipates, but a
      // repository or state-machine throw would otherwise escape as an
      // unhandled rejection and surface only as a red error overlay.
      Alert.alert('Assignment failed', error instanceof Error ? error.message : 'Unexpected error.');
      return;
    }
    // The board renders from `loadState.jobs`. Without this refresh the
    // just-assigned job keeps showing under "Unassigned", which reads as a
    // failed assign and invites a second Confirm press against a stale
    // in-memory status.
    refreshJobs();
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
    void transitionJob(job, 'paid', { role: session.role, now: () => new Date().toISOString() }).then(() => {
      setSelectedCloseOutJob(null);
      setSubView('closeOutQueue');
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
    setSubView('employee-editor');
  }

  function handleEditEmployee() {
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

  function handleSelectReportsJob(job: Job) {
    setSelectedReportsJob(job);
    setSubView('reports-job-detail');
  }

  function handleBackFromReportsJobDetail() {
    setSelectedReportsJob(null);
    setSubView('reports');
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
      {subView === 'employee-detail' && selectedEmployee ? (
        <Breadcrumb
          segments={[
            { label: 'Admin & Finance', onPress: () => goTop('overview') },
            { label: `${currentScreenLabel} > ${selectedEmployee.fullName}` },
          ]}
        />
      ) : (
        <Breadcrumb
          segments={[
            { label: 'Admin & Finance', onPress: () => goTop('overview') },
            { label: currentScreenLabel },
          ]}
        />
      )}
      <TabBar items={TOP_LEVEL_TABS} activeKey={subView} onSelect={goTop} />

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
                subtitle={`${loadState.jobs.length} on file for this organization`}
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
              const unassignedJobs = loadState.jobs.filter(
                (job) => !job.assignedTechId && isBetaVisible(job, showTestJobs),
              );
              return unassignedJobs.length === 0 ? (
                <EmptyState title="No jobs" message="This organization has no unassigned jobs on file." />
              ) : (
                <Card style={styles.card}>
                  {unassignedJobs.map((job) => (
                    <ListItem
                      key={job.id}
                      title={job.address ?? job.description ?? job.id}
                      subtitle={formatDate(job.scheduledStart)}
                      onPress={() => router.push('/job/' + job.id)}
                      right={<Button label="Plan" size="sm" onPress={() => router.push('/job/' + job.id + '?panel=plan')} />}
                    />
                  ))}
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
          serviceTasksRepo={ports.serviceTasks}
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
      ) : subView === 'assignmentBoard' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : (
          <AssignmentBoardScreen
            jobs={loadState.jobs.filter((j) => j.status === 'qualified' || j.status === 'scheduled')}
            techs={loadState.employees.map(
              (profile): TechColumnTech => ({
                id: profile.id,
                fullName: profile.fullName,
                isTest: profile.isTest,
              }),
            )}
            resolveServiceAreaId={(job) => job.service_area_id ?? null}
            techServiceAreas={loadState.techServiceAreas}
            onAssign={handleAssign}
            showTestJobs={showTestJobs}
            onShowTestJobsChange={handleShowTestJobsChange}
            showTestEmployees={showTestEmployees}
            onShowTestEmployeesChange={handleShowTestEmployeesChange}
          />
        )
      ) : subView === 'reports' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : (
          <ReportsScreen jobs={loadState.jobs} commissions={loadState.commissions} onSelectJob={handleSelectReportsJob} />
        )
      ) : subView === 'reports-job-detail' ? (
        selectedReportsJob && loadState.kind === 'loaded' && orgId ? (
          <ReportsJobDetailScreen
            job={selectedReportsJob}
            commissions={loadState.commissions}
            organizationId={orgId}
            techName={
              loadState.kind === 'loaded'
                ? new Map(loadState.employees.map((t) => [t.id, t.fullName])).get(selectedReportsJob.assignedTechId ?? '')
                : undefined
            }
            onBack={handleBackFromReportsJobDetail}
          />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Job" message="No job selected." />
          </View>
        )
      ) : subView === 'employee-roster' ? (
        <EmployeeRosterScreen
          employees={employeeRepository}
          onSelectEmployee={handleSelectEmployee}
          onAddEmployee={handleAddEmployee}
          onViewInvitations={() => setSubView('employee-invitations')}
          showTest={showTestEmployeesRoster}
          onShowTestChange={handleShowTestEmployeesRosterChange}
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
            const calendarTimeOffEvents = toCalendarTimeOffEvents(loadState.timeOffRequests, techNameById).filter(
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
  'reports-job-detail': 'Job Detail',
  payments: 'Payments',
  'employee-roster': 'Employees',
  'employee-detail': 'Employee Detail',
  'employee-job-detail': 'Employee Job Detail',
  'employee-invitations': 'Pending Invitations',
  calendar: 'Calendar',
};

const TOP_LEVEL_TABS: Array<{ key: SubView; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'leadInbox', label: 'Leads' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'assignmentBoard', label: 'Assignments' },
  { key: 'closeOutQueue', label: 'Close-Outs' },
  { key: 'priceSheetList', label: 'Price Sheets' },
  { key: 'payments', label: 'Payments' },
  { key: 'timeOffQueue', label: 'Time Off' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'reports', label: 'Reports' },
  { key: 'employee-roster', label: 'Employees' },
];

export default AdminFinanceRoot;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.md },
  card: { marginBottom: spacing.md },
  calendarToolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  calendarTechSelect: { width: 180 },
});
