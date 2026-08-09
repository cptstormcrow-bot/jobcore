/**
 * Payout batch records screen — read-only batch/line viewer (P3k.4).
 *
 * Consumes `PayoutBatchRepo` (`../data/payout-batch-repo.ts`, P3k.2b):
 * `listForOrganization` only — this screen has no write action at all, since
 * `PayoutBatch` lines are already frozen (`buildPayoutBatch`,
 * `../money/payout-batch.ts`, P3k.1) and `persist` is invoked elsewhere, not
 * from this screen. Mirrors `ReimbursementQueueScreen.tsx`'s optional-props
 * pattern, `getModuleSession` session gate, and idle/loading/loaded/failed
 * state machine exactly, so all three admin-finance screens stay consistent.
 *
 * This app never executes any payout — it only displays batch records that
 * were frozen and persisted elsewhere. The banner below states that
 * explicitly and verbatim, per this slice's requirement.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Card, ListItem, EmptyState, LoadingState, ErrorState, colors, spacing, typography } from '@jobcore/ui';
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

/** Local, honest formatter for cents — this screen has no shared money formatter to reuse. */
function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function PayoutBatchScreen(props: PayoutBatchScreenProps = {}) {
  const { payoutBatches: payoutBatchRepository } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });

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
          return (
            <Card key={`${batch.organizationId}-${batch.periodStart}-${batchIndex}`} style={styles.card}>
              <ListItem
                title={`${batch.periodStart} to ${batch.periodEnd}`}
                subtitle={`${batch.lines.length} line(s) - ${formatAmount(batchTotal)} total`}
              />
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
