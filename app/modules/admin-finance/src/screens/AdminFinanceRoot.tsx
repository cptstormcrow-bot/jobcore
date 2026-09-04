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
import { addDays } from 'date-fns';
import { Card, ListItem, Button, Select, TabBar, EmptyState, LoadingState, ErrorState, Breadcrumb, WeekView, colors, spacing, radius } from '@jobcore/ui';
import type { TimeOffEvent } from '@jobcore/ui';
import type { Commission, Job, Profile } from '@jobcore/core';
import { isBetaVisible } from '@jobcore/core';
import type { PayoutBatch } from '../money/payout-batch';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import { awaitingCloseOut } from '../domain/closeout';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';
import { LeadInboxScreen } from './LeadInboxScreen';
import { PriceSheetListScreen } from './PriceSheetListScreen';
import { ReimbursementQueueScreen } from './ReimbursementQueueScreen';
import { TimeOffQueueScreen } from './TimeOffQueueScreen';
import { PayoutBatchScreen } from './PayoutBatchScreen';
import { PayoutBatchDetailScreen } from './PayoutBatchDetailScreen';
import { AuditLogScreen } from './AuditLogScreen';
import { PaymentsScreen } from './PaymentsScreen';
import { AssignmentBoardScreen } from './AssignmentBoardScreen';
import { ReportsScreen } from './ReportsScreen';
import { QualifyScreen, type QualifyAxisSelection } from './QualifyScreen';
import { LeadCreateScreen } from './LeadCreateScreen';
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
  | 'leadInbox' | 'leadCreate' | 'qualify'
  | 'planning' | 'jobEstimate'
  | 'assignmentBoard'
  | 'closeOutQueue' | 'closeOutReview'
  | 'priceSheetList' | 'priceSheetEditor' | 'priceSheetCreate'
  | 'reimbursementQueue'
  | 'timeOffQueue'
  | 'payoutBatch'
  | 'payoutBatch-detail'
  | 'reports'
  | 'auditLog'
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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCloseOutJob, setSelectedCloseOutJob] = useState<Job | null>(null);
  const [selectedPriceSheetId, setSelectedPriceSheetId] = useState<string | null>(null);
  const [closeOutPhotos, setCloseOutPhotos] = useState<CloseOutPhoto[]>([]);
  const [closeOutNotes, setCloseOutNotes] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [selectedPayoutBatch, setSelectedPayoutBatch] = useState<PayoutBatch | null>(null);
  const [selectedEmployeeJob, setSelectedEmployeeJob] = useState<Job | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  const [calendarAnchorDay, setCalendarAnchorDay] = useState(() => new Date());
  const [selectedCalendarTechId, setSelectedCalendarTechId] = useState<string | null>(null);

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
    setSubView('qualify');
  }

  function handleQualifySubmit(selection: QualifyAxisSelection) {
    if (!session || !selectedLead) {
      return;
    }
    const qualifiedLead: Lead = { ...selectedLead, ...selection };
    setQualifyError(null);
    void qualifyLead(qualifiedLead, selection.serviceAreaId, {
      jobs: jobRepository,
      leads: ports.leads,
      customers: ports.customers,
      calendarEvents: ports.calendarEvents,
      ctx: { role: session.role, now: () => new Date().toISOString() },
    }).then((result) => {
      if (!result.ok) {
        setQualifyError(result.reason);
        return;
      }
      setSelectedLead(null);
      setSubView('leadInbox');
    });
  }

  function handleQualifyCancel() {
    setSelectedLead(null);
    setQualifyError(null);
    setSubView('leadInbox');
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
    setSubView('payoutBatch-detail');
  }

  function handleBackToPayoutBatches() {
    setSubView('payoutBatch');
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

  return (
    <View style={styles.screen}>
      {subView === 'employee-detail' && selectedEmployee ? (
        <Breadcrumb
          segments={[
            { label: 'Admin & Finance', onPress: () => setSubView('overview') },
            { label: `${currentScreenLabel} > ${selectedEmployee.fullName}` },
          ]}
        />
      ) : (
        <Breadcrumb
          segments={[
            { label: 'Admin & Finance', onPress: () => setSubView('overview') },
            { label: currentScreenLabel },
          ]}
        />
      )}
      <TabBar items={TOP_LEVEL_TABS} activeKey={subView} onSelect={setSubView} />

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
              <ListItem
                title="New Lead"
                subtitle="Capture a new lead"
                onPress={() => setSubView('leadCreate')}
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
                onPress={() => setSubView('payoutBatch')}
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
        <LeadInboxScreen leads={ports.leads} onSelectLead={handleSelectLead} />
      ) : subView === 'leadCreate' ? (
        <LeadCreateScreen
          onCreated={(lead) => {
            setSelectedLead(lead);
            setSubView('qualify');
          }}
          onCancel={() => setSubView('leadInbox')}
        />
      ) : subView === 'qualify' ? (
        selectedLead ? (
          <>
            {qualifyError && <ErrorState message={qualifyError} />}
            <QualifyScreen
              lead={selectedLead}
              serviceAreas={loadState.kind === 'loaded' ? loadState.serviceAreas : []}
              onSubmit={handleQualifySubmit}
              onCancel={handleQualifyCancel}
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
      ) : subView === 'reimbursementQueue' ? (
        <ReimbursementQueueScreen reimbursements={ports.reimbursements} />
      ) : subView === 'timeOffQueue' ? (
        <TimeOffQueueScreen timeOffAdmin={ports.timeOffAdmin} onAddBlackout={handleAddBlackout} />
      ) : subView === 'payoutBatch' ? (
        <PayoutBatchScreen payoutBatches={ports.payoutBatches} onSelectBatch={handleSelectPayoutBatch} />
      ) : subView === 'payoutBatch-detail' ? (
        selectedPayoutBatch ? (
          <PayoutBatchDetailScreen batch={selectedPayoutBatch} onBack={handleBackToPayoutBatches} />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Payout Batch" message="No payout batch selected." />
          </View>
        )
      ) : subView === 'auditLog' ? (
        <AuditLogScreen auditLog={ports.auditLog} />
      ) : subView === 'payments' ? (
        <PaymentsScreen payments={ports.payments} />
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
          <ReportsScreen jobs={loadState.jobs} commissions={loadState.commissions} />
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
          <EmployeeJobDetailScreen job={selectedEmployeeJob} onBack={handleBackToEmployeeDetail} />
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
            return (
              <View style={styles.screen}>
                <View style={styles.content}>
                  <View style={styles.calendarToolbar}>
                    <Button label="Prev" size="sm" onPress={() => setCalendarAnchorDay((d) => addDays(d, -7))} />
                    <Button label="Next" size="sm" onPress={() => setCalendarAnchorDay((d) => addDays(d, 7))} />
                    <Select
                      value={selectedCalendarTechId}
                      onChange={setSelectedCalendarTechId}
                      placeholder="All Techs"
                      options={techs.map((t) => ({ label: t.fullName, value: t.id }))}
                      style={styles.calendarTechSelect}
                    />
                    <Button
                      label="Add Blackout"
                      size="sm"
                      onPress={() => handleAddBlackout(selectedCalendarTechId ?? undefined)}
                    />
                  </View>
                </View>
                <WeekView
                  jobs={calendarJobs}
                  anchorDay={calendarAnchorDay}
                  timeOffEvents={calendarTimeOffEvents}
                  onSelectJob={handleCalendarSelectJob}
                />
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
  planning: 'Planning',
  jobEstimate: 'Job Estimate',
  assignmentBoard: 'Assignments',
  closeOutQueue: 'Close-Outs',
  closeOutReview: 'Close-Out Review',
  priceSheetList: 'Price Sheets',
  priceSheetEditor: 'Price Sheet Editor',
  priceSheetCreate: 'New Price Sheet',
  reimbursementQueue: 'Reimbursements',
  timeOffQueue: 'Time Off',
  payoutBatch: 'Payout Batches',
  'payoutBatch-detail': 'Payout Batch Detail',
  reports: 'Reports',
  auditLog: 'Audit Log',
  payments: 'Payment & Review',
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
  { key: 'reimbursementQueue', label: 'Reimbursements' },
  { key: 'timeOffQueue', label: 'Time Off' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'payoutBatch', label: 'Payout Batches' },
  { key: 'reports', label: 'Reports' },
  { key: 'auditLog', label: 'Audit Log' },
  { key: 'payments', label: 'Payment & Review' },
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
