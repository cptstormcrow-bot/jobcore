/**
 * JobInvestigationScreen — module-local, tech-facing Segway investigation
 * form (P1 §2a).
 *
 * A minimal guided form over `job_investigations`' four note fields plus the
 * state assessment, with a "Submit" action that stamps
 * `submitted_at`. Reached from the tech's job-detail view once the tech
 * holds an `investigator` assignment on the job. Mirrors
 * `FieldJobDetail.tsx`'s component/styling conventions exactly (same
 * header/layout pattern, same loading/error state idiom, same navigation
 * prop typing) and `JobEstimateEditor.tsx`'s upsert/submit idiom for the
 * sibling `investigations` port.
 */

import * as React from 'react';
import { View, StyleSheet } from 'react-native';

import type { Job } from '@jobcore/core';
import { ScreenTitle, Button, TextField, colors, typography, Text } from '@jobcore/ui';
import type { JobInvestigation, JobInvestigationInput } from '../data/ports';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

/** Props for `JobInvestigationScreen`. `jobId` selects the job; the rest is resolved via ports. */
export interface JobInvestigationScreenProps {
  jobId: string;
  onBack?: () => void;
  /** Inlined inside a host screen (e.g. Job Detail) that already owns navigation/scroll: suppresses the Back row and the duplicate screen title. */
  embedded?: boolean;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

/**
 * Tech-facing on-site investigation form. Shows job header, the four guided
 * note fields plus a state assessment, and a single "Submit"
 * action that stamps `submitted_at`. One evolving row per job — the tech can
 * keep refining it across the visit until submitted.
 */
export function JobInvestigationScreen({ jobId, onBack, embedded = false }: JobInvestigationScreenProps): React.ReactElement {
  const session = getModuleSession();

  const [job, setJob] = React.useState<Job | null>(null);
  const [investigation, setInvestigation] = React.useState<JobInvestigation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [ingressNotes, setIngressNotes] = React.useState('');
  const [logisticsNotes, setLogisticsNotes] = React.useState('');
  const [parkingNotes, setParkingNotes] = React.useState('');
  const [stateAssessment, setStateAssessment] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const ports = getModulePorts();
      const [loadedJob, loadedInvestigation] = await Promise.all([
        ports.jobs.getById(jobId, session.userId),
        ports.investigations.getForJob(jobId),
      ]);
      setJob(loadedJob);
      setInvestigation(loadedInvestigation);
      setIngressNotes(loadedInvestigation?.ingressNotes ?? '');
      setLogisticsNotes(loadedInvestigation?.logisticsNotes ?? '');
      setParkingNotes(loadedInvestigation?.parkingNotes ?? '');
      setStateAssessment(loadedInvestigation?.stateAssessment ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investigation.');
    } finally {
      setLoading(false);
    }
  }, [jobId, session]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleSave = React.useCallback(
    async (patch: JobInvestigationInput) => {
      setSaving(true);
      try {
        const ports = getModulePorts();
        const updated = await ports.investigations.upsertForJob(jobId, {
          ingressNotes,
          logisticsNotes,
          parkingNotes,
          stateAssessment,
          ...patch,
        });
        setInvestigation(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save investigation.');
      } finally {
        setSaving(false);
      }
    },
    [jobId, ingressNotes, logisticsNotes, parkingNotes, stateAssessment],
  );

  const handleSaveDraft = React.useCallback(() => {
    void handleSave({});
  }, [handleSave]);

  const handleSubmit = React.useCallback(() => {
    void handleSave({ submittedAt: new Date().toISOString() });
  }, [handleSave]);

  if (!session) {
    return (
      <View style={styles.container}>
        <Text>Signing in…</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading investigation…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <Text>Job not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!embedded && onBack ? <Button label="Back to Job" onPress={onBack} variant="primary" size="sm" /> : null}
      {!embedded && <ScreenTitle title="Job Investigation" subtitle={job.address ?? undefined} />}
      {!embedded && <Text style={styles.title}>Job {job.id}</Text>}
      <Text style={styles.status}>
        {investigation?.submittedAt ? `Submitted ${formatDateTime(investigation.submittedAt)}` : 'Not yet submitted'}
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Investigation notes</Text>
        <TextField label="Ingress notes" value={ingressNotes} onChangeText={setIngressNotes} />
        <TextField label="Logistics notes" value={logisticsNotes} onChangeText={setLogisticsNotes} />
        <TextField label="Parking notes" value={parkingNotes} onChangeText={setParkingNotes} />
        <TextField label="State assessment" value={stateAssessment} onChangeText={setStateAssessment} />
      </View>

      <View style={styles.section}>
        <Button label="Save Draft" onPress={handleSaveDraft} variant="primary" size="sm" disabled={saving} />
        <Button
          label="Submit"
          onPress={handleSubmit}
          variant="primary"
          size="sm"
          disabled={saving || Boolean(investigation?.submittedAt)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
  },
  status: {
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    color: colors.textLight,
    marginBottom: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: typography.size.h6,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginBottom: 8,
  },
  label: {
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    color: colors.textMuted,
    marginTop: 6,
  },
  value: {
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily.body,
  },
});
