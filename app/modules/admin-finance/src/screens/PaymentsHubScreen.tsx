/**
 * Payments hub screen — merges `PaymentsScreen`, `ReimbursementQueueScreen`,
 * and the `PayoutBatchScreen` / `PayoutBatchDetailScreen` pair into one
 * scrollable "Payments" tab, so the three related admin-finance areas no
 * longer require separate tab navigation.
 *
 * Each merged screen is rendered as a plain stacked child inside this
 * screen's own outer `ScrollView` — the child screens' own outer wrappers
 * are `View`s, not `ScrollView`s (see their own files), so there is no
 * nested-scroll conflict.
 *
 * The Payout Batches section supports being scrolled to programmatically
 * (e.g. from a deep link or a cross-section action elsewhere in the host)
 * via `scrollToSection` / `onScrollHandled`, using the section's own
 * `onLayout`-recorded Y offset rather than a hardcoded value.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { colors, spacing, typography, Text } from '@jobcore/ui';
import type { PaymentsRepository } from '../data/ports';
import type { ReimbursementRepo } from '../data/reimbursement-repo';
import type { PayoutBatch } from '../money/payout-batch';
import type { PayoutBatchRepo } from '../data/payout-batch-repo';
import { PaymentsScreen } from './PaymentsScreen';
import { ReimbursementQueueScreen } from './ReimbursementQueueScreen';
import { PayoutBatchScreen } from './PayoutBatchScreen';
import { PayoutBatchDetailScreen } from './PayoutBatchDetailScreen';

export interface PaymentsHubScreenProps {
  payments?: PaymentsRepository;
  reimbursements?: ReimbursementRepo;
  payoutBatches?: PayoutBatchRepo;
  selectedPayoutBatch: PayoutBatch | null;
  onSelectPayoutBatch: (batch: PayoutBatch) => void;
  onBackFromPayoutBatch: () => void;
  scrollToSection?: 'payoutBatches' | null;
  onScrollHandled?: () => void;
}

export function PaymentsHubScreen(props: PaymentsHubScreenProps) {
  const {
    payments,
    reimbursements,
    payoutBatches,
    selectedPayoutBatch,
    onSelectPayoutBatch,
    onBackFromPayoutBatch,
    scrollToSection,
    onScrollHandled,
  } = props;

  const scrollViewRef = useRef<ScrollView>(null);
  const [payoutBatchesOffsetY, setPayoutBatchesOffsetY] = useState<number | null>(null);

  function handlePayoutBatchesLayout(event: LayoutChangeEvent) {
    setPayoutBatchesOffsetY(event.nativeEvent.layout.y);
  }

  useEffect(() => {
    if (scrollToSection !== 'payoutBatches' || payoutBatchesOffsetY === null) {
      return;
    }
    scrollViewRef.current?.scrollTo({ y: payoutBatchesOffsetY, animated: true });
    onScrollHandled?.();
  }, [scrollToSection, payoutBatchesOffsetY, onScrollHandled]);

  return (
    <View style={styles.screen}>
      <ScrollView ref={scrollViewRef} style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeading}>Payment Review</Text>
        <PaymentsScreen payments={payments} />

        <Text style={styles.sectionHeading}>Reimbursements</Text>
        <ReimbursementQueueScreen reimbursements={reimbursements} />

        <View onLayout={handlePayoutBatchesLayout}>
          <Text style={styles.sectionHeading}>Payout Batches</Text>
          {selectedPayoutBatch ? (
            <PayoutBatchDetailScreen batch={selectedPayoutBatch} onBack={onBackFromPayoutBatch} />
          ) : (
            <PayoutBatchScreen payoutBatches={payoutBatches} onSelectBatch={onSelectPayoutBatch} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export default PaymentsHubScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  sectionHeading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
});
