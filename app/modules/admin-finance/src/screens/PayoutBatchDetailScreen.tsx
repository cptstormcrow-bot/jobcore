/**
 * Payout batch detail / drilldown screen.
 *
 * Reached via drill-down from a row tap on `PayoutBatchScreen.tsx`'s batch
 * list. Purely prop-driven — no internal fetch/load-state machine here, since
 * the caller (`AdminFinanceRoot.tsx`) already holds the full `PayoutBatch`
 * object in memory and simply hands it down, mirroring
 * `EmployeeDetailScreen.tsx`'s prop-driven data pattern.
 *
 * This app never executes any payout — it only displays batch records that
 * were frozen and persisted elsewhere, per `PayoutBatchScreen.tsx`'s banner.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, ListItem, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { PayoutBatch, FrozenPayoutLine } from '../money/payout-batch';

export interface PayoutBatchDetailScreenProps {
  batch: PayoutBatch;
  onBack: () => void;
}

/** Local, honest formatter for cents — duplicated from `PayoutBatchScreen.tsx` rather than imported across screens. */
function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function PayoutBatchDetailScreen({ batch, onBack }: PayoutBatchDetailScreenProps) {
  const batchTotal = batch.lines.reduce((sum, line) => sum + line.totalAmount, 0);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <ScreenTitle title="Payout Batch Detail" />
        <Button label="Back" variant="outline" size="sm" onPress={onBack} style={styles.action} />

        <Card style={styles.card}>
          <Text style={styles.heading}>Payout Batch</Text>
          <ListItem title="Period" subtitle={`${batch.periodStart} to ${batch.periodEnd}`} />
          <ListItem title="Status" subtitle={batch.status ?? 'unknown'} />
        </Card>

        <Text style={styles.heading}>Lines</Text>
        <Card style={styles.card}>
          {batch.lines.length > 0 ? (
            batch.lines.map((line: FrozenPayoutLine) => (
              <ListItem
                key={`${line.userId}-${line.frozenAt}`}
                title={line.userId}
                subtitle={`Hours ${formatAmount(line.hoursAmount)} · Commission ${formatAmount(
                  line.commissionAmount,
                )} · Bonus ${formatAmount(line.bonusAmount)} · Reimbursement ${formatAmount(
                  line.reimbursementAmount,
                )} · Total ${formatAmount(line.totalAmount)} · Frozen ${line.frozenAt}`}
              />
            ))
          ) : (
            <Text style={styles.note}>No lines</Text>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalText}>Batch total: {formatAmount(batchTotal)}</Text>
          </View>
        </Card>

        <Text style={styles.note}>Records only - this app does not move money</Text>
      </View>
    </View>
  );
}

export default PayoutBatchDetailScreen;

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  action: {
    marginBottom: spacing.sm,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalText: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
});
