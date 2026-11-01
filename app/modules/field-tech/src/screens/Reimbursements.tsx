// JobCore screen #0029 - ft-Reimbursements - Reimbursements
/**
 * Reimbursements screen for the field-tech module.
 *
 * Reimbursement request form + read-only "my requests" list. Time off now
 * lives on the #0011 calendar. Structure: session/ports resolved via
 * `lib/module-session.ts` and `lib/module-ports.ts`, never constructed
 * locally. Uses this module's `ReimbursementRequestRepository` port
 * (`../data/ports.ts`, already-declared `ReimbursementRequest` /
 * `ReimbursementRequestDraft` / `ReimbursementRequestRepository`).
 *
 * Receipt-photo capture is explicitly deferred — `receiptPhotoPath` is
 * nullable and not required at creation.
 */

import * as React from 'react';
import { View, TextInput, FlatList, StyleSheet } from 'react-native';

import type { ReimbursementRequest } from '../data/ports';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { PayrollButton, colors, Text, spacing, radius, typography } from '@jobcore/ui';

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

/**
 * Reimbursements screen: a request form (amount, description, optional job
 * id) plus a read-only list of the signed-in tech's own prior requests. No
 * approve/deny affordance here — that is an org-admin concern enforced
 * elsewhere via RLS, per `ReimbursementRequestRepository`'s deliberately
 * narrow shape.
 */
export function Reimbursements(): React.ReactElement {
  const session = getModuleSession();

  const [requests, setRequests] = React.useState<ReimbursementRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [amountCents, setAmountCents] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [jobId, setJobId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const loadRequests = React.useCallback(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const { reimbursements } = getModulePorts();

    reimbursements
      .listForTech(session.userId)
      .then((result) => {
        if (!cancelled) {
          setRequests(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load reimbursement requests.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  React.useEffect(() => {
    const cleanup = loadRequests();
    return cleanup;
  }, [loadRequests]);

  const parsedAmountCents = Number.parseInt(amountCents.trim(), 10);
  const canSubmit =
    amountCents.trim().length > 0 && Number.isFinite(parsedAmountCents) && parsedAmountCents > 0 && !submitting;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) {
      return;
    }

    if (session === null) {
      setSubmitError('No active session — cannot submit request.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { reimbursements } = getModulePorts();
      const trimmedDescription = description.trim();
      const trimmedJobId = jobId.trim();

      await reimbursements.create(session.org.id, session.userId, {
        amountCents: parsedAmountCents,
        description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
        jobId: trimmedJobId.length > 0 ? trimmedJobId : null,
      });

      setAmountCents('');
      setDescription('');
      setJobId('');
      loadRequests();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit reimbursement request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (session === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Sign in to request a reimbursement.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Request reimbursement</Text>
        <Text style={styles.label}>Amount (cents)</Text>
        <TextInput
          style={styles.input}
          value={amountCents}
          onChangeText={setAmountCents}
          placeholder="e.g. 1250"
          keyboardType="numeric"
          editable={!submitting}
        />
        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="What was this for?"
          editable={!submitting}
          multiline
        />
        <Text style={styles.label}>Job ID (optional)</Text>
        <TextInput
          style={styles.input}
          value={jobId}
          onChangeText={setJobId}
          placeholder="Linked job id"
          editable={!submitting}
        />
        {submitError !== null ? <Text style={styles.errorText}>{submitError}</Text> : null}
        <PayrollButton
          label={submitting ? 'Submitting…' : 'Submit request'}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={styles.submitButton}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My requests</Text>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : loadError !== null ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : requests.length === 0 ? (
          <Text style={styles.emptyText}>No reimbursement requests yet.</Text>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(request) => request.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.requestRow}>
                <Text style={styles.requestAmount}>${(item.amountCents / 100).toFixed(2)}</Text>
                {item.description !== null ? (
                  <Text style={styles.requestDescription}>{item.description}</Text>
                ) : null}
                <Text style={styles.requestStatus}>{item.status}</Text>
                <Text style={styles.requestDate}>{formatDate(item.createdAt)}</Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.size.body,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  descriptionInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: spacing.md,
  },
  requestRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  requestAmount: {
    fontSize: typography.size.label,
    fontWeight: '600',
  },
  requestDescription: {
    fontSize: typography.size.small,
    marginTop: 2,
  },
  requestStatus: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: 2,
  },
  requestDate: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
});
