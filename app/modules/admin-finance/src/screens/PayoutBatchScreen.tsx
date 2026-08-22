/**
 * Payout batch records screen — batch/line viewer with approve/mark-paid
 * actions (P3k.4).
 *
 * Consumes `PayoutBatchRepo` (`../data/payout-batch-repo.ts`, P3k.2b):
 * `listForOrganization`, `approve`, and `markPaid` — `PayoutBatch` lines are
 * already frozen (`buildPayoutBatch`, `../money/payout-batch.ts`, P3k.1) and
 * `persist` is invoked elsewhere, not from this screen. Mirrors
 * `ReimbursementQueueScreen.tsx`'s optional-props pattern, `getModuleSession`
 * session gate, and idle/loading/loaded/failed state machine exactly, so all
 * three admin-finance screens stay consistent.
 *
 * This app never executes any payout — it only displays batch records that
 * were frozen and persisted elsewhere. The banner below states that
 * explicitly and verbatim, per this slice's requirement.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, Button, EmptyState, LoadingState, ErrorState, colors, spacing, typography } from '@jobcore/ui';
import type { PayoutBatch, FrozenPayoutLine } from '../money/payout-batch';
import type { PayoutBatchRepo } from '../data/payout-batch-repo';
import { getModuleSession } from '../lib/module-session';

export interface PayoutBatchScreenProps {
  payoutBatches?: PayoutBatchRepo;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; batches: PayoutBatch[] }
  | { kind: 'failed'; message: string };

/** Per-batch approve-action state, keyed by batch id. Absent = idle. */
type ApproveActionState =
  | { kind: 'submitting' }
  | { kind: 'failed'; message: string };

/** Local, honest formatter for cents — this screen has no shared money formatter to reuse. */
function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function PayoutBatchScreen(props: PayoutBatchScreenProps = {}) {
  const { payoutBatches: payoutBatchRepository } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [approveActions, setApproveActions] = useState<Record<string, ApproveActionState>>({});

  const session = getModuleSession();

  useEffect(() => {
    if (!session || !payoutBatchRepository) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    payoutBatchRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', batches: result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load payout batches.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, payoutBatchRepository]);

  function handleMarkPaid(batch: PayoutBatch) {
    if (!payoutBatchRepository || !batch.id) {
      return;
    }
    const batchId = batch.id;
    setApproveActions((prev) => ({ ...prev, [batchId]: { kind: 'submitting' } }));
    payoutBatchRepository
      .markPaid(batchId)
      .then((result) => {
        if (!result.ok) {
          setApproveActions((prev) => ({ ...prev, [batchId]: { kind: 'failed', message: result.reason } }));
          return;
        }
        setLoadState((prev) => {
          if (prev.kind !== 'loaded') {
            return prev;
          }
          return {
            kind: 'loaded',
            batches: prev.batches.map((existing) => (existing.id === batchId ? result.value : existing)),
          };
        });
        setApproveActions((prev) => {
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not mark this payout batch paid.';
        setApproveActions((prev) => ({ ...prev, [batchId]: { kind: 'failed', message } }));
      });
  }

  function handleApprove(batch: PayoutBatch) {
    if (!payoutBatchRepository || !batch.id) {
      return;
    }
    const batchId = batch.id;
    setApproveActions((prev) => ({ ...prev, [batchId]: { kind: 'submitting' } }));
    payoutBatchRepository
      .approve(batchId)
      .then((result) => {
        if (!result.ok) {
          setApproveActions((prev) => ({ ...prev, [batchId]: { kind: 'failed', message: result.reason } }));
          return;
        }
        setLoadState((prev) => {
          if (prev.kind !== 'loaded') {
            return prev;
          }
          return {
            kind: 'loaded',
            batches: prev.batches.map((existing) => (existing.id === batchId ? result.value : existing)),
          };
        });
        setApproveActions((prev) => {
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not approve this payout batch.';
        setApproveActions((prev) => ({ ...prev, [batchId]: { kind: 'failed', message } }));
      });
  }

  const banner = (
    <Text style={styles.banner}>Records only - this app does not move money</Text>
  );

  if (!session) {
    return (
      <View style={styles.screen}>
        {banner}
        <EmptyState
          title="Payout Batches"
          message="Sign in to view this organization's payout batch records."
        />
      </View>
    );
  }

  if (!payoutBatchRepository) {
    return (
      <View style={styles.screen}>
        {banner}
        <EmptyState
          title="Payout Batches"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        {banner}
        <LoadingState label="Loading payout batches..." />
      </View>
    );
  }

  if (loadState.kind === 'failed') {
    return (
      <View style={styles.screen}>
        {banner}
        <ErrorState message={loadState.message} />
      </View>
    );
  }

  if (loadState.batches.length === 0) {
    return (
      <View style={styles.screen}>
        {banner}
        <EmptyState title="Payout Batches" message="No payout batches have been recorded yet." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {banner}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.groupHeading}>Payout Batches</Text>
        {loadState.batches.map((batch, batchIndex) => {
          const batchTotal = batch.lines.reduce((sum, line) => sum + line.totalAmount, 0);
          const approveState = batch.id ? approveActions[batch.id] : undefined;
          const isSubmitting = approveState?.kind === 'submitting';
          const canApprove = !!batch.id && batch.status !== 'approved';
          const canMarkPaid = !!batch.id && batch.status === 'approved';
          return (
            <Card key={`${batch.organizationId}-${batch.periodStart}-${batchIndex}`} style={styles.card}>
              <ListItem
                title={`${batch.periodStart} to ${batch.periodEnd}`}
                subtitle={`${batch.lines.length} line(s) - ${formatAmount(batchTotal)} total`}
              />
              {approveState?.kind === 'failed' && <Text style={styles.rowError}>{approveState.message}</Text>}
              {canApprove && (
                <Button
                  label="Approve"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  onPress={() => handleApprove(batch)}
                  style={styles.actionButton}
                />
              )}
              {canMarkPaid && (
                <Button
                  label="Mark Paid"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  onPress={() => handleMarkPaid(batch)}
                  style={styles.actionButton}
                />
              )}
              {batch.lines.map((line: FrozenPayoutLine) => (
                <View key={`${line.userId}-${line.frozenAt}`} style={styles.lineRow}>
                  <Text style={styles.lineText}>
                    {line.userId} - {formatAmount(line.totalAmount)}
                  </Text>
                  <Text style={styles.lineSubtext}>Frozen {line.frozenAt}</Text>
                </View>
              ))}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default PayoutBatchScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  banner: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    backgroundColor: colors.border,
    padding: spacing.xs,
    textAlign: 'center',
  },
  content: {
    padding: spacing.md,
  },
  groupHeading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  rowError: {
    color: colors.danger,
    fontSize: typography.size.label,
    marginBottom: spacing.xs,
  },
  actionButton: {
    marginBottom: spacing.xs,
  },
  lineRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineText: {
    color: colors.text,
    fontSize: typography.size.body,
  },
  lineSubtext: {
    color: colors.textMuted,
    fontSize: typography.size.label,
  },
});
