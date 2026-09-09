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
import { View, Text, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import type { Job } from '@jobcore/core';
import { ScreenTitle, Button, TextField, colors, typography } from '@jobcore/ui';
import type { JobEstimate, JobEstimateLineItem, EstimateLineItemKind } from '../data/ports';
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
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

/**
 * Tech-facing estimate editor. Shows job header, materials planning
 * (read-only list + add-only form), completion schedule / payment outlay
 * (read-only derived display), a single "Submit" status action, and a
 * Share Link action.
 */
export function JobEstimateEditor({ jobId, onBack, embedded = false }: JobEstimateEditorProps): React.ReactElement {
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
      setLineItems((prev) => [...prev, item]);
      setDescription('');
      setQuantity('');
      setUnitCost('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line item.');
    } finally {
      setSaving(false);
    }
  }, [jobId, kind, description, quantity, unitCost]);

  const handleSubmit = React.useCallback(async () => {
    setSaving(true);
    try {
      const ports = getModulePorts();
      const updated = await ports.estimates.upsertForJob(jobId, { status: 'submitted' });
      setEstimate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit estimate.');
    } finally {
      setSaving(false);
    }
  }, [jobId]);

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
      <Text style={styles.status}>Estimate status: {estimate?.status ?? 'draft'}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Materials planning</Text>
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
        <Text style={styles.sectionTitle}>Completion schedule</Text>
        <Text style={styles.label}>Scheduled start</Text>
        <Text style={styles.value}>{formatDateTime(estimate?.scheduledStart ?? null)}</Text>
        <Text style={styles.label}>Scheduled end</Text>
        <Text style={styles.value}>{formatDateTime(estimate?.scheduledEnd ?? null)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment outlay</Text>
        <Text style={styles.value}>Materials: ${(estimate?.materialsCost ?? 0).toFixed(2)}</Text>
        <Text style={styles.value}>Labor: ${(estimate?.laborCost ?? 0).toFixed(2)}</Text>
        <Text style={styles.value}>Other: ${(estimate?.otherCost ?? 0).toFixed(2)}</Text>
        <Text style={styles.value}>Total: ${(estimate?.totalCost ?? 0).toFixed(2)}</Text>
      </View>

      <View style={styles.section}>
        <Button label="Submit" onPress={handleSubmit} variant="primary" size="sm" disabled={saving} />
        <Button label="Share Link" onPress={handleShare} variant="primary" size="sm" />
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
  lineRow: {
    marginBottom: 8,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily.body,
  },
});
