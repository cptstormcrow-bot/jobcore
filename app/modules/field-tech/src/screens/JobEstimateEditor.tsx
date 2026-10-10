// JobCore screen #0059 - job-region-estimate - Estimate
/**
 * JobEstimateEditor — module-local, tech-facing estimate screen.
 *
 * RLS-constrained per the confirmed migration asymmetry: line items render
 * read-only (no edit/delete affordance) with an add-only form (RLS grants
 * tech INSERT on `job_estimate_line_items`, not UPDATE/DELETE). The header
 * supports one tech action — "Submit" — which is the only status write RLS
 * authorizes for a tech (UPDATE on the header only). No Approve/Reject
 * (admin-only). Mirrors `FieldJobDetail.tsx`'s component/styling
 * conventions exactly.
 */

import * as React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { Job } from '@jobcore/core';
import { allowedEstimateMoves } from '@jobcore/core';
import { ScreenTitle, Button, TextField, colors, typography, Text, EstimateStatusControl } from '@jobcore/ui';
import type { JobEstimate, JobEstimateLineItem, EstimateLineItemKind, JobInvestigation, JobPlanningPhoto } from '../data/ports';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

/** Props for `JobEstimateEditor`. `jobId` selects the job; the rest is resolved via ports. */
export interface JobEstimateEditorProps {
  jobId: string;
  onBack?: () => void;
  /**
   * When true, this screen is inlined inside a host screen (e.g. Job Detail):
   * the Back button and the screen-level title/subtitle are hidden since the
   * host already provides that navigation/context.
   */
  embedded?: boolean;
  /** Submitted prem form answers, shown read-only for reference while estimating. */
  investigation?: JobInvestigation | null;
  /** Called with the saved estimate after every successful estimate change. */
  onEstimateChange?: (estimate: JobEstimate) => void;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

const DAY_CHIPS = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: '+2 days', days: 2 },
  { label: '+7 days', days: 7 },
];
const TIME_CHIPS = [8, 10, 12, 14, 16];

/** Sum line-item totals by kind; `totalCost` is the grand total. */
function sumLineItems(items: JobEstimateLineItem[]): {
  materialsCost: number;
  laborCost: number;
  otherCost: number;
  totalCost: number;
} {
  const sums = { materialsCost: 0, laborCost: 0, otherCost: 0, totalCost: 0 };
  for (const item of items) {
    if (item.kind === 'material') sums.materialsCost += item.lineTotal;
    else if (item.kind === 'labor') sums.laborCost += item.lineTotal;
    else sums.otherCost += item.lineTotal;
    sums.totalCost += item.lineTotal;
  }
  return sums;
}

/**
 * Tech-facing estimate editor. Shows job header, materials planning
 * (read-only list + add-only form), completion schedule / payment outlay
 * (read-only derived display), a single "Submit" status action, and a
 * Share Link action.
 */
export function JobEstimateEditor({ jobId, onBack, embedded = false, investigation, onEstimateChange }: JobEstimateEditorProps): React.ReactElement {
  const session = getModuleSession();

  const [job, setJob] = React.useState<Job | null>(null);
  const [estimate, setEstimate] = React.useState<JobEstimate | null>(null);
  const [lineItems, setLineItems] = React.useState<JobEstimateLineItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [kind, setKind] = React.useState<EstimateLineItemKind>('material');
  const [description, setDescription] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [unitCost, setUnitCost] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [shareError, setShareError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [photos, setPhotos] = React.useState<JobPlanningPhoto[]>([]);

  const load = React.useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const ports = getModulePorts();
      const [loadedJob, loadedEstimate, loadedLineItems] = await Promise.all([
        ports.jobs.getById(jobId, session.userId),
        ports.estimates.getForJob(jobId),
        ports.estimates.listLineItems(jobId),
      ]);
      setJob(loadedJob);
      setEstimate(loadedEstimate);
      setLineItems(loadedLineItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load estimate.');
    } finally {
      setLoading(false);
    }
  }, [jobId, session]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Planning photos for the Prem reference section (text + small thumbnails only).
  React.useEffect(() => {
    let cancelled = false;
    getModulePorts()
      .planningPhotos.list(jobId)
      .then((rows) => {
        if (!cancelled) setPhotos(rows);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const totals = React.useMemo(() => sumLineItems(lineItems), [lineItems]);

  const handleAddLineItem = React.useCallback(async () => {
    const qty = Number.parseFloat(quantity);
    const cost = Number.parseFloat(unitCost);
    if (!description || Number.isNaN(qty) || Number.isNaN(cost)) return;
    setSaving(true);
    try {
      const ports = getModulePorts();
      const lineTotal = qty * cost;
      const item = await ports.estimates.addLineItem(jobId, {
        kind,
        description,
        quantity: qty,
        unitCost: cost,
        lineTotal,
      });
      const nextItems = [...lineItems, item];
      setLineItems(nextItems);
      // Persist the client-side sums so the saved header matches the displayed outlay.
      const saved = await ports.estimates.upsertForJob(jobId, sumLineItems(nextItems));
      setEstimate(saved);
      onEstimateChange?.(saved);
      setDescription('');
      setQuantity('');
      setUnitCost('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line item.');
    } finally {
      setSaving(false);
    }
  }, [jobId, kind, description, quantity, unitCost, lineItems, onEstimateChange]);

  /** Chip picker: a day chip keeps the chosen time (default 8:00); a time chip keeps the chosen day (default today). */
  const pickSchedule = React.useCallback(
    async (which: 'start' | 'end', part: 'day' | 'time', value: number) => {
      const current = which === 'start' ? estimate?.scheduledStart : estimate?.scheduledEnd;
      const base = current ? new Date(current) : new Date();
      const next = Number.isNaN(base.getTime()) ? new Date() : base;
      if (part === 'day') {
        const target = new Date();
        target.setDate(target.getDate() + value);
        next.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
        if (!current) next.setHours(8, 0, 0, 0);
      } else {
        next.setHours(value, 0, 0, 0);
      }
      setSaving(true);
      try {
        const ports = getModulePorts();
        const iso = next.toISOString();
        const updated = await ports.estimates.upsertForJob(
          jobId,
          which === 'start' ? { scheduledStart: iso } : { scheduledEnd: iso },
        );
        setEstimate(updated);
        onEstimateChange?.(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save schedule.');
      } finally {
        setSaving(false);
      }
    },
    [jobId, estimate, onEstimateChange],
  );

  const handleSubmit = React.useCallback(async () => {
    const complete =
      lineItems.length > 0 &&
      Boolean(estimate?.scheduledStart) &&
      Boolean(estimate?.scheduledEnd) &&
      totals.totalCost > 0;
    if (!complete) {
      setSubmitError('Please complete all fields marked *.');
      return;
    }
    setSubmitError(null);
    setSaving(true);
    try {
      const ports = getModulePorts();
      const updated = await ports.estimates.upsertForJob(jobId, { status: 'submitted' });
      setEstimate(updated);
      onEstimateChange?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit estimate.');
    } finally {
      setSaving(false);
    }
  }, [jobId, lineItems, estimate, totals, onEstimateChange]);

  const handleStatusSelect = React.useCallback(
    async (next: 'draft' | 'submitted' | 'approved') => {
      if (next === 'submitted') {
        await handleSubmit();
        return;
      }
      if (next !== 'draft') return;
      setSubmitError(null);
      setSaving(true);
      try {
        const ports = getModulePorts();
        const updated = await ports.estimates.upsertForJob(jobId, { status: 'draft' });
        setEstimate(updated);
        onEstimateChange?.(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to move estimate to draft.');
      } finally {
        setSaving(false);
      }
    },
    [jobId, handleSubmit, onEstimateChange],
  );

  const handleShare = React.useCallback(async () => {
    setShareError(null);
    try {
      const ports = getModulePorts();
      const { url } = await ports.estimates.issueShareLink(jobId);
      try {
        const { Share } = await import('react-native');
        await Share.share({ message: url });
      } catch (shareErr) {
        await Clipboard.setStringAsync(url);
        setShareError(`Link copied to clipboard: ${url}`);
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to share estimate.');
    }
  }, [jobId]);

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
        <Text>Loading estimate…</Text>
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
      {!embedded && <ScreenTitle title="Job Estimate" subtitle={job.address ?? undefined} />}
      {!embedded && <Text style={styles.title}>Job {job.id}</Text>}
      <Text style={styles.status}>Estimate status:</Text>
      <EstimateStatusControl
        status={estimate?.status ?? 'draft'}
        allowed={allowedEstimateMoves('tech', estimate?.status ?? 'draft')}
        busy={saving}
        onSelect={handleStatusSelect}
        testID="estimate-status-control"
      />

      {investigation ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prem form (for reference when estimating)</Text>
          <Text style={styles.label}>Ingress notes</Text>
          <Text style={styles.value}>{investigation.ingressNotes ?? ''}</Text>
          <Text style={styles.label}>Logistics notes</Text>
          <Text style={styles.value}>{investigation.logisticsNotes ?? ''}</Text>
          <Text style={styles.label}>Parking notes</Text>
          <Text style={styles.value}>{investigation.parkingNotes ?? ''}</Text>
          <Text style={styles.label}>State assessment</Text>
          <Text style={styles.value}>{investigation.stateAssessment ?? ''}</Text>
          <Text style={styles.label}>Rooms and work</Text>
          {(investigation.roomWork ?? []).length === 0 ? (
            <Text style={styles.value}>None</Text>
          ) : (
            (investigation.roomWork ?? []).map((card, idx) => (
              <Text key={`${card.room}-${idx}`} style={styles.value}>
                {card.room}: {card.work}
              </Text>
            ))
          )}
          <Text style={styles.label}>Measurements</Text>
          <Text style={styles.value}>{investigation.measurements ?? ''}</Text>
          <Text style={styles.label}>Tech instructions</Text>
          <Text style={styles.value}>{investigation.techInstructions ?? ''}</Text>
          <Text style={styles.label}>Materials arrived</Text>
          <Text style={styles.value}>
            {investigation.materialsArrived === null || investigation.materialsArrived === undefined
              ? 'Not answered'
              : investigation.materialsArrived
                ? 'Yes'
                : 'No'}
          </Text>
          <Text style={styles.label}>Planning photos</Text>
          {photos.length === 0 ? (
            <Text style={styles.value}>None</Text>
          ) : (
            <View style={styles.chipRow}>
              {photos.map((photo) =>
                photo.url ? (
                  <Image key={photo.id} source={{ uri: photo.url }} style={styles.thumb} />
                ) : (
                  <Text key={photo.id} style={styles.value}>
                    {photo.caption ?? 'Photo'}
                  </Text>
                ),
              )}
            </View>
          )}
          {investigation.submittedAt ? (
            <Text style={styles.label}>Submitted {formatDateTime(investigation.submittedAt)}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Materials planning *</Text>
        {lineItems.length === 0 ? (
          <Text style={styles.value}>No line items yet.</Text>
        ) : (
          lineItems.map((item) => (
            <View key={item.id} style={styles.lineRow}>
              <Text style={styles.value}>
                [{item.kind}] {item.description} — qty {item.quantity} × ${item.unitCost.toFixed(2)} = $
                {item.lineTotal.toFixed(2)}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.label}>Add line item</Text>
        <TextField label="Kind (material/labor/other)" value={kind} onChangeText={(v) => setKind(v as EstimateLineItemKind)} />
        <TextField label="Description" value={description} onChangeText={setDescription} />
        <TextField label="Quantity" value={quantity} onChangeText={setQuantity} />
        <TextField label="Unit cost" value={unitCost} onChangeText={setUnitCost} />
        <Button label="Add Line Item" onPress={handleAddLineItem} variant="primary" size="sm" disabled={saving} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Completion schedule *</Text>
        <Text style={styles.label}>Scheduled start</Text>
        <Text style={styles.value}>{formatDateTime(estimate?.scheduledStart ?? null)}</Text>
        <View style={styles.chipRow}>
          {DAY_CHIPS.map((chip) => (
            <Button key={`s-d-${chip.label}`} label={chip.label} onPress={() => pickSchedule('start', 'day', chip.days)} variant="primary" size="sm" disabled={saving} />
          ))}
        </View>
        <View style={styles.chipRow}>
          {TIME_CHIPS.map((hour) => (
            <Button key={`s-t-${hour}`} label={`${hour}:00`} onPress={() => pickSchedule('start', 'time', hour)} variant="primary" size="sm" disabled={saving} />
          ))}
        </View>
        <Text style={styles.label}>Scheduled end</Text>
        <Text style={styles.value}>{formatDateTime(estimate?.scheduledEnd ?? null)}</Text>
        <View style={styles.chipRow}>
          {DAY_CHIPS.map((chip) => (
            <Button key={`e-d-${chip.label}`} label={chip.label} onPress={() => pickSchedule('end', 'day', chip.days)} variant="primary" size="sm" disabled={saving} />
          ))}
        </View>
        <View style={styles.chipRow}>
          {TIME_CHIPS.map((hour) => (
            <Button key={`e-t-${hour}`} label={`${hour}:00`} onPress={() => pickSchedule('end', 'time', hour)} variant="primary" size="sm" disabled={saving} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment outlay *</Text>
        <Text style={styles.value}>Materials: ${totals.materialsCost.toFixed(2)}</Text>
        <Text style={styles.value}>Labor: ${totals.laborCost.toFixed(2)}</Text>
        <Text style={styles.value}>Other: ${totals.otherCost.toFixed(2)}</Text>
        <Text style={styles.value}>Total: ${totals.totalCost.toFixed(2)}</Text>
      </View>

      <View style={styles.section}>
        <Button label="Submit" onPress={handleSubmit} variant="primary" size="sm" disabled={saving} />
        <Button label="Share Link" onPress={handleShare} variant="primary" size="sm" />
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        {shareError ? <Text style={styles.value}>{shareError}</Text> : null}
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 4,
  },
  lineRow: {
    marginBottom: 8,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily.body,
  },
});
