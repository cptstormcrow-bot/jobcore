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

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, ListItem, Button, EmptyState, LoadingState, ErrorState, colors, spacing, radius } from '@jobcore/ui';
import type { Commission, Job, Profile } from '@jobcore/core';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';
import { LeadInboxScreen } from './LeadInboxScreen';
import { PriceSheetListScreen } from './PriceSheetListScreen';
import { ReimbursementQueueScreen } from './ReimbursementQueueScreen';
import { TimeOffQueueScreen } from './TimeOffQueueScreen';
import { PayoutBatchScreen } from './PayoutBatchScreen';
import { AuditLogScreen } from './AuditLogScreen';
import { PaymentsScreen } from './PaymentsScreen';
import { AssignmentBoardScreen } from './AssignmentBoardScreen';
import { ReportsScreen } from './ReportsScreen';
import { QualifyScreen, type QualifyAxisSelection } from './QualifyScreen';
import { CloseOutQueueScreen } from './CloseOutQueueScreen';
import { CloseOutReviewScreen } from './CloseOutReviewScreen';
import { PriceSheetEditorScreen } from './PriceSheetEditorScreen';
import { EmployeeRosterScreen } from './EmployeeRosterScreen';
import { EmployeeEditorScreen } from './EmployeeEditorScreen';
import { EmployeeDetailScreen } from './EmployeeDetailScreen';
import { EmployeeJobDetailScreen } from './EmployeeJobDetailScreen';
import type { CloseOutPhoto, TechServiceArea } from '../data/ports';
import type { Lead } from '../domain/lead';
import { assignJob } from '../flows/assign-job';
import { qualifyLead } from '../flows/qualify-lead';
import { transitionJob } from '../domain/transition';
import type { TechColumnTech } from '../components/TechColumn';

type SubView =
  | 'overview' | 'jobs'
  | 'leadInbox' | 'qualify'
  | 'assignmentBoard'
  | 'closeOutQueue' | 'closeOutReview'
  | 'priceSheetList' | 'priceSheetEditor'
  | 'reimbursementQueue'
  | 'timeOffQueue'
  | 'payoutBatch'
  | 'reports'
  | 'auditLog'
  | 'payments'
  | 'employee-roster' | 'employee-detail' | 'employee-editor' | 'employee-job-detail';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; jobs: Job[]; employees: Profile[]; commissions: Commission[]; techServiceAreas: TechServiceArea[] }
  | { kind: 'failed'; message: string };

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
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedCloseOutJob, setSelectedCloseOutJob] = useState<Job | null>(null);
  const [selectedPriceSheetId, setSelectedPriceSheetId] = useState<string | null>(null);
  const [closeOutPhotos, setCloseOutPhotos] = useState<CloseOutPhoto[]>([]);
  const [closeOutNotes, setCloseOutNotes] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [selectedEmployeeJob, setSelectedEmployeeJob] = useState<Job | null>(null);

  const session = useModuleSession();
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

  useEffect(() => {
    if (!session) {
      return undefined;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    Promise.all([
      jobRepository.listForOrganization(session.org.id),
      employeeRepository.listEmployees(session.org.id),
      commissionRepository.listForOrganization(session.org.id),
      techServiceAreaRepository.listForOrganization(session.org.id),
    ])
      .then(([jobs, employees, commissions, techServiceAreas]) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', jobs, employees, commissions, techServiceAreas });
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
  }, [session, jobRepository, employeeRepository, commissionRepository, techServiceAreaRepository]);

  function handleAssign(job: Job, techId: string) {
    if (!session) {
      return;
    }
    void assignJob(job, techId, {
      jobs: jobRepository,
      assignments: ports.jobAssignments,
      calendarEvents: ports.calendarEvents,
      ctx: { role: session.role, now: () => new Date().toISOString() },
    });
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
    void qualifyLead(qualifiedLead, null, {
      jobs: jobRepository,
      leads: ports.leads,
      calendarEvents: ports.calendarEvents,
      ctx: { role: session.role, now: () => new Date().toISOString() },
    }).then(() => {
      setSelectedLead(null);
      setSubView('leadInbox');
    });
  }

  function handleQualifyCancel() {
    setSelectedLead(null);
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

  function handlePublished() {
    setSelectedPriceSheetId(null);
    setSubView('priceSheetList');
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TOP_LEVEL_TABS.map(({ key, label }) => (
          <Button
            key={key}
            label={label}
            variant={subView === key ? 'primary' : 'outline'}
            size="tab"
            onPress={() => setSubView(key)}
            style={styles.tabButton}
          />
        ))}
      </ScrollView>

      {subView === 'overview' || subView === 'jobs' ? (
        loadState.kind === 'loading' || loadState.kind === 'idle' ? (
          <LoadingState label="Loading jobs..." />
        ) : loadState.kind === 'failed' ? (
          <ErrorState message={loadState.message} />
        ) : subView === 'overview' ? (
          <ScrollView contentContainerStyle={styles.content}>
            <Card style={styles.card}>
              <ListItem
                title="Jobs"
                subtitle={`${loadState.jobs.length} on file for this organization`}
                onPress={() => setSubView('jobs')}
              />
            </Card>
            <Button
              label="Add Job"
              variant="primary"
              size="sm"
              onPress={() => router.push('/job/new')}
            />
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Button
              label="Add Job"
              variant="primary"
              size="sm"
              onPress={() => router.push('/job/new')}
              style={styles.card}
            />
            {loadState.jobs.length === 0 ? (
              <EmptyState title="No jobs" message="This organization has no jobs on file." />
            ) : (
              <Card style={styles.card}>
                {loadState.jobs.map((job) => (
                  <ListItem
                    key={job.id}
                    title={job.address ?? job.description ?? job.id}
                    subtitle={formatDate(job.scheduledStart)}
                    onPress={() => router.push('/job/' + job.id)}
                  />
                ))}
              </Card>
            )}
          </ScrollView>
        )
      ) : subView === 'leadInbox' ? (
        <LeadInboxScreen leads={ports.leads} onSelectLead={handleSelectLead} />
      ) : subView === 'qualify' ? (
        selectedLead ? (
          <QualifyScreen lead={selectedLead} onSubmit={handleQualifySubmit} onCancel={handleQualifyCancel} />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Qualify lead" message="No lead selected." />
          </View>
        )
      ) : subView === 'priceSheetList' ? (
        <PriceSheetListScreen
          priceSheets={ports.priceSheets}
          onSelectSheet={(sheet) => handleSelectPriceSheet(sheet.id)}
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
        <TimeOffQueueScreen timeOffAdmin={ports.timeOffAdmin} />
      ) : subView === 'payoutBatch' ? (
        <PayoutBatchScreen payoutBatches={ports.payoutBatches} />
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
            jobs={loadState.jobs}
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
          profile={selectedEmployee ?? undefined}
          onSaved={handleEmployeeEditorSaved}
          onCancel={handleEmployeeEditorCancel}
        />
      ) : subView === 'employee-job-detail' ? (
        selectedEmployeeJob ? (
          <EmployeeJobDetailScreen job={selectedEmployeeJob} onBack={handleBackToEmployeeDetail} />
        ) : (
          <View style={styles.screen}>
            <EmptyState title="Job" message="No job selected." />
          </View>
        )
      ) : (
        <View style={styles.screen}>
          <EmptyState title="Coming soon" message="This tab is not wired up yet." />
        </View>
      )}
    </View>
  );
}

const TOP_LEVEL_TABS: Array<{ key: SubView; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'leadInbox', label: 'Leads' },
  { key: 'assignmentBoard', label: 'Assignment Board' },
  { key: 'closeOutQueue', label: 'Close-Outs' },
  { key: 'priceSheetList', label: 'Price Sheets' },
  { key: 'reimbursementQueue', label: 'Reimbursements' },
  { key: 'timeOffQueue', label: 'Time Off' },
  { key: 'payoutBatch', label: 'Payout Batches' },
  { key: 'reports', label: 'Reports' },
  { key: 'auditLog', label: 'Audit Log' },
  { key: 'payments', label: 'Payment & Review' },
  { key: 'employee-roster', label: 'Employees' },
];

export default AdminFinanceRoot;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  tabRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.xs },
  tabButton: { borderRadius: radius.md, marginHorizontal: 0 },
  content: { padding: spacing.md },
  card: { marginBottom: spacing.md },
});
