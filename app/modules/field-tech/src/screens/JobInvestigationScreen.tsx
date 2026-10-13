// JobCore screen #0061 - job-region-evisit - Prelim (Prem)
/**
 * JobInvestigationScreen — module-local, tech-facing Segway investigation
 * form (P1 §2a).
 *
 * A minimal guided form over `job_investigations`' four note fields plus the
 * state assessment, per-room work cards, measurements, tech instructions, a
 * materials-arrived answer and assessment photos, with a "Submit" action that
 * stamps `submitted_at`. Reached from the tech's job-detail view once the tech
 * holds an `investigator` assignment on the job. Mirrors
 * `FieldJobDetail.tsx`'s component/styling conventions exactly (same
 * header/layout pattern, same loading/error state idiom, same navigation
 * prop typing) and `JobEstimateEditor.tsx`'s upsert/submit idiom for the
 * sibling `investigations` port.
 */

import * as React from 'react';
import { View, Image, Pressable, StyleSheet, TextInput } from 'react-native';

import type { Job } from '@jobcore/core';
import { ScreenTitle, Button, colors, typography, Text } from '@jobcore/ui';
import type { JobInvestigation, JobInvestigationInput, JobPlanningPhoto } from '../data/ports';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

/** Props for `JobInvestigationScreen`. `jobId` selects the job; the rest is resolved via ports. */
export interface JobInvestigationScreenProps {
  jobId: string;
  onBack?: () => void;
  /** Inlined inside a host screen (e.g. Job Detail) that already owns navigation/scroll: suppresses the Back row and the duplicate screen title. */
  embedded?: boolean;
  /** Parent-supplied job (e.g. admin view); skips the tech-scoped lookup. */
  job?: Job;
  /** Called after a successful save that stamped submittedAt (not on Save Draft or failure). */
  onSubmitted?: (investigation: JobInvestigation) => void;
  /** Host-supplied shared task list (module cannot import app components). Absent renders nothing. */
  renderTaskList?: (p: { jobId: string; mode: 'edit' | 'read'; source?: string }) => React.ReactNode;
}

/** Horizontal labelled input: label on the left, input on the right. */
function FieldRow({ label, value, onChangeText }: { label: string; value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
      />
    </View>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

/**
 * Tech-facing on-site investigation form. Shows job header, the four guided
 * note fields plus a state assessment, room work cards, measurements,
 * instructions, materials answer, assessment photos, and a single "Submit"
 * action that stamps `submitted_at`. One evolving row per job — the tech can
 * keep refining it across the visit until submitted.
 */
export function JobInvestigationScreen({ jobId, onBack, embedded = false, job: jobProp, onSubmitted, renderTaskList }: JobInvestigationScreenProps): React.ReactElement {
  const session = getModuleSession();

  const [job, setJob] = React.useState<Job | null>(null);
  const [investigation, setInvestigation] = React.useState<JobInvestigation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [ingressNotes, setIngressNotes] = React.useState('');
  const [logisticsNotes, setLogisticsNotes] = React.useState('');
  const [parkingNotes, setParkingNotes] = React.useState('');
  const [stateAssessment, setStateAssessment] = React.useState('');
  const [techInstructions, setTechInstructions] = React.useState('');
  const [materialsArrived, setMaterialsArrived] = React.useState(false);
  const [photos, setPhotos] = React.useState<JobPlanningPhoto[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const ports = getModulePorts();
      const [loadedJob, loadedInvestigation, loadedPhotos] = await Promise.all([
        jobProp ? Promise.resolve(jobProp) : ports.jobs.getById(jobId, session.userId),
        ports.investigations.getForJob(jobId),
        ports.planningPhotos.list(jobId),
      ]);
      setJob(loadedJob);
      setInvestigation(loadedInvestigation);
      setIngressNotes(loadedInvestigation?.ingressNotes ?? '');
      setLogisticsNotes(loadedInvestigation?.logisticsNotes ?? '');
      setParkingNotes(loadedInvestigation?.parkingNotes ?? '');
      setStateAssessment(loadedInvestigation?.stateAssessment ?? '');
      setTechInstructions(loadedInvestigation?.techInstructions ?? '');
      setMaterialsArrived(loadedInvestigation?.materialsArrived === true);
      setPhotos(loadedPhotos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investigation.');
    } finally {
      setLoading(false);
    }
  }, [jobId, session, jobProp?.id]);

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
          techInstructions,
          materialsArrived,
          ...patch,
        });
        setInvestigation(updated);
        if (patch.submittedAt) onSubmitted?.(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save investigation.');
      } finally {
        setSaving(false);
      }
    },
    [jobId, ingressNotes, logisticsNotes, parkingNotes, stateAssessment, techInstructions, materialsArrived, onSubmitted],
  );

  const handleSaveDraft = React.useCallback(() => {
    void handleSave({});
  }, [handleSave]);

  const handleSubmit = React.useCallback(() => {
    const missing: string[] = [];
    if (!ingressNotes.trim()) missing.push('Ingress notes');
    if (!logisticsNotes.trim()) missing.push('Logistics notes');
    if (!parkingNotes.trim()) missing.push('Parking notes');
    if (!stateAssessment.trim()) missing.push('State assessment');
    if (!techInstructions.trim()) missing.push('Instructions for tech');
    if (photos.length === 0) missing.push('at least one photo');
    if (missing.length > 0) {
      setSubmitError(`Please complete: ${missing.join(', ')}.`);
      return;
    }
    setSubmitError(null);
    void handleSave({ submittedAt: new Date().toISOString() });
  }, [handleSave, ingressNotes, logisticsNotes, parkingNotes, stateAssessment, techInstructions, photos]);

  const handleAddPhoto = React.useCallback(async () => {
    try {
      const added = await getModulePorts().planningPhotos.add(jobId);
      if (added) setPhotos((prev) => [...prev, added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add photo.');
    }
  }, [jobId]);

  const handleRemovePhoto = React.useCallback(async (photoId: string) => {
    try {
      await getModulePorts().planningPhotos.remove(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo.');
    }
  }, []);

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
      {embedded && <Text style={styles.title}>Prem Checklist</Text>}
      <View style={styles.headerRow}>
        <Text style={[styles.headerSide, { textAlign: 'left' }]}>Date created: {new Date(job.createdAt).toLocaleDateString()}</Text>
        <Text style={[styles.status, styles.headerCenter]}>
          {investigation?.submittedAt ? `Submitted ${formatDateTime(investigation.submittedAt)}` : 'Not yet submitted'}
        </Text>
        <Text style={[styles.headerSide, { textAlign: 'right' }]}>Job #{job.jobNumber ?? '—'}</Text>
      </View>

      <View style={styles.cardActions}>
        <View style={styles.actionCell}>
          <Button label="Add photo" onPress={() => void handleAddPhoto()} variant="primary" size="sm" />
        </View>
        <View style={styles.actionCell}>
          <Button label="Save Draft" onPress={handleSaveDraft} variant="primary" size="sm" disabled={saving} />
        </View>
        <View style={styles.actionCell}>
          <Button
            label="Submit"
            onPress={handleSubmit}
            variant="primary"
            size="sm"
            disabled={saving || Boolean(investigation?.submittedAt)}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setMaterialsArrived((prev) => !prev)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: materialsArrived }}
        >
          <Text style={styles.checkboxBox}>{materialsArrived ? '☑' : '☐'}</Text>
          <Text style={styles.value}>Materials arrived *</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        {renderTaskList?.({ jobId, mode: 'edit', source: 'prem' })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Investigation notes</Text>
        <FieldRow label="Ingress notes *" value={ingressNotes} onChangeText={setIngressNotes} />
        <FieldRow label="Logistics notes *" value={logisticsNotes} onChangeText={setLogisticsNotes} />
        <FieldRow label="Parking notes *" value={parkingNotes} onChangeText={setParkingNotes} />
        <FieldRow label="State assessment *" value={stateAssessment} onChangeText={setStateAssessment} />
      </View>

      <View style={styles.section}>
        <FieldRow label="Instructions for tech *" value={techInstructions} onChangeText={setTechInstructions} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assessment photos *</Text>
        <Text style={styles.label}>Before photos are recommended.</Text>
        {photos.map((photo) => (
          <View key={photo.id} style={styles.card}>
            <Button label="Delete" onPress={() => void handleRemovePhoto(photo.id)} variant="primary" size="sm" />
            {photo.url ? <Image source={{ uri: photo.url }} style={styles.thumb} /> : <Text style={styles.value}>Photo unavailable</Text>}
          </View>
        ))}
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
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
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerSide: {
    flex: 1,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    color: colors.textMuted,
  },
  headerCenter: {
    flex: 2,
    textAlign: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  fieldLabel: {
    width: '38%',
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
  },
  fieldInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    backgroundColor: colors.surface,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: typography.size.h6,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginBottom: 8,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 0,
  },
  actionCell: {
    flex: 1,
  },
  removeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#ffffff',
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxBox: {
    fontSize: typography.size.h4,
  },
  card: {
    marginBottom: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 6,
  },
  thumb: {
    width: 96,
    height: 96,
    marginBottom: 6,
    borderRadius: 4,
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
