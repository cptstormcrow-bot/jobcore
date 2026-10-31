// JobCore screen #0081 - job-region-overview - Job Overview
// Compact collapsible overview region: contact, location, tasks, Prem photos, customer projects, save/cancel.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { PayrollButton, colors, spacing, Text, TextField, typography } from '@jobcore/ui';
import type { CustomerJobPlanTaskRow, JobPlanningPhoto } from '../../../../modules/admin-finance/src/data/ports';
import { createJobPlanningPhotoRepository, createJobPlanTasksRepository } from '../lib/admin-finance-repos';
import { JobDetailsForm, type JobFormValues } from './JobDetailsForm';
import { JobTaskList } from './JobTaskList';

export type JobOverviewRegionProps = {
  jobId: string;
  jobNumber: string | number | null;
  customerId: string | null;
  /** Current job status string (jobs.status). */
  jobStatus: string | null;
  /** True while the current job is open (not completed/cancelled). */
  jobIsOpen: boolean;
  isAdmin: boolean;
  value: JobFormValues;
  onChange: (patch: Partial<JobFormValues>) => void;
  serviceAreas: { id: string; name: string }[];
  hasInvestigation?: boolean;
  createdAt?: string | null;
  error?: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  /** Parent's existing confirmResetTime. Admin only. */
  onReset?: () => void;
  onOpenJob: (jobId: string) => void;
};

const CLOSED = new Set(['completed', 'complete', 'closed', 'cancelled', 'canceled', 'invoiced', 'paid', 'archived']);

function Section({ title, children, open: initial = true }: { title?: string; children: ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  const isOpen = title === undefined ? true : open;
  return (
    <View style={styles.section}>
      {title === undefined ? null : (
        <Pressable onPress={() => setOpen((o) => !o)} style={styles.header}>
          <Text style={styles.headerText}>{(open ? '- ' : '+ ') + title}</Text>
        </Pressable>
      )}
      {isOpen ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

export function JobOverviewRegion(props: JobOverviewRegionProps) {
  const { jobId, jobNumber, customerId, jobIsOpen, isAdmin, onOpenJob } = props;
  const taskRepo = useMemo(() => createJobPlanTasksRepository(), []);
  const photoRepo = useMemo(() => createJobPlanningPhotoRepository(), []);
  const [photos, setPhotos] = useState<JobPlanningPhoto[]>([]);
  const [customerTasks, setCustomerTasks] = useState<CustomerJobPlanTaskRow[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blockedJob, setBlockedJob] = useState<{ id: string; number: string | number | null } | null>(null);

  const loadCustomer = useCallback(() => {
    if (!customerId) return;
    taskRepo.listForCustomer(customerId).then(setCustomerTasks).catch(() => setCustomerTasks([]));
  }, [customerId, taskRepo]);

  useEffect(() => {
    photoRepo.listForJob(jobId).then(setPhotos).catch(() => setPhotos([]));
  }, [jobId, photoRepo]);
  useEffect(() => {
    loadCustomer();
  }, [loadCustomer]);

  const otherJobs = useMemo(() => {
    const m = new Map<string, { id: string; number: string | number | null; status: string | null }>();
    for (const t of customerTasks) if (t.jobId !== jobId && !m.has(t.jobId)) m.set(t.jobId, { id: t.jobId, number: t.jobNumber, status: t.jobStatus });
    return [...m.values()];
  }, [customerTasks, jobId]);
  const openOther = otherJobs.find((j) => !CLOSED.has((j.status ?? '').toLowerCase()));
  const deferred = customerTasks.filter((t) => t.status === 'deferred');
  const pickedIds = deferred.filter((t) => picked[t.id]).map((t) => t.id);

  const startProject = async () => {
    setMsg(null);
    setBlockedJob(null);
    if (openOther) {
      setBlockedJob({ id: openOther.id, number: openOther.number });
      setMsg(`Open Job #${openOther.number ?? ''} first.`);
      return;
    }
    if (pickedIds.length === 0) {
      setMsg('Pick at least one deferred task.');
      return;
    }
    if (jobIsOpen) {
      try {
        for (const id of pickedIds) await taskRepo.deferTask(id);
        setMsg(`Becomes a new project when Job #${jobNumber ?? ''} completes.`);
        loadCustomer();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Could not save.');
      }
      return;
    }
    setBusy(true);
    try {
      const created = await taskRepo.spawnJob(jobId, pickedIds, title.trim() || 'New project');
      onOpenJob(created.id);
    } catch {
      setMsg('Needs connection');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Section>
        <JobDetailsForm
          compact
          mode="edit"
          value={props.value}
          onChange={props.onChange}
          serviceAreas={props.serviceAreas}
          hasInvestigation={props.hasInvestigation}
          createdAt={props.createdAt}
          error={props.error}
        />
      </Section>
      <Section title="Tasks">
        <JobTaskList jobId={jobId} mode="edit" allowCatalog={isAdmin} />
      </Section>
      <Section title="Prem photos" open={false}>
        {photos.length === 0 ? (
          <Text style={styles.hint}>No Prem photos.</Text>
        ) : (
          photos.map((p) => (
            <Text key={p.id} style={styles.row}>
              {p.caption ?? p.storagePath}
            </Text>
          ))
        )}
      </Section>
      <Section title="Customer projects" open={false}>
        {otherJobs.length === 0 ? <Text style={styles.hint}>No other jobs for this customer.</Text> : null}
        {otherJobs.map((j) => (
          <Pressable key={j.id} onPress={() => onOpenJob(j.id)}>
            <Text style={styles.row}>{`Job #${j.number ?? ''} - ${j.status ?? ''}`}</Text>
          </Pressable>
        ))}
        {deferred.map((t) => (
          <Pressable key={t.id} onPress={() => setPicked((p) => ({ ...p, [t.id]: !p[t.id] }))}>
            <Text style={styles.row}>{`${picked[t.id] ? '[x]' : '[ ]'} ${t.title} (Job #${t.jobNumber ?? ''})`}</Text>
          </Pressable>
        ))}
        <TextField dense label="Project title" value={title} onChangeText={setTitle} />
        {msg ? <Text style={styles.hint}>{msg}</Text> : null}
        {blockedJob ? <PayrollButton label={`Open Job #${blockedJob.number ?? ''}`} onPress={() => onOpenJob(blockedJob.id)} /> : null}
        <PayrollButton label={busy ? 'Starting...' : 'Start project'} disabled={busy} onPress={() => void startProject()} />
      </Section>
      <View style={styles.actions}>
        <PayrollButton label="Cancel" onPress={props.onCancel} disabled={props.saving} />
        <PayrollButton label={props.saving ? 'Saving...' : 'Save'} onPress={props.onSave} disabled={props.saving} />
        {isAdmin && props.onReset ? <PayrollButton label="Reset" onPress={props.onReset} /> : null}
      </View>
    </View>
  );
}

export default JobOverviewRegion;

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xs },
  header: { paddingVertical: spacing.xs },
  headerText: { fontSize: typography.size.body, fontWeight: '600', color: colors.text },
  body: { gap: spacing.xs },
  row: { fontSize: typography.size.label, color: colors.text, paddingVertical: spacing.xs },
  hint: { fontSize: typography.size.label, color: colors.textMutedDark },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
