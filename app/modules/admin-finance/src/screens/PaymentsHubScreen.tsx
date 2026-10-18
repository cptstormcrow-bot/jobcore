// JobCore screen #0063 - af-payments - Payments
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

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, DefaultTabBar } from '@jobcore/ui';
import type { PaymentsRepository } from '../data/ports';
import type { ReimbursementRepo } from '../data/reimbursement-repo';
import type { PayoutBatch } from '../money/payout-batch';
import type { PayoutBatchRepo } from '../data/payout-batch-repo';
import { PaymentsScreen } from './PaymentsScreen';
import { ReimbursementQueueScreen } from './ReimbursementQueueScreen';
import { PayoutBatchScreen } from './PayoutBatchScreen';
import { PayoutBatchDetailScreen } from './PayoutBatchDetailScreen';

type HubTab = 'payments' | 'reimbursements' | 'payoutBatches';
const HUB_TABS: Array<{ id: HubTab; label: string }> = [
  { id: 'payments', label: 'Payments' },
  { id: 'reimbursements', label: 'Reimbursements' },
  { id: 'payoutBatches', label: 'Payout Batches' },
];

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

  const [activeKey, setActiveKey] = useState<HubTab>('payments');

  useEffect(() => {
    if (scrollToSection !== 'payoutBatches') {
      return;
    }
    setActiveKey('payoutBatches');
    onScrollHandled?.();
  }, [scrollToSection, onScrollHandled]);

  return (
    <View style={styles.screen}>
      <DefaultTabBar tabs={HUB_TABS} activeId={activeKey} onChange={setActiveKey} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {activeKey === 'payments' ? <PaymentsScreen payments={payments} /> : null}
        {activeKey === 'reimbursements' ? <ReimbursementQueueScreen reimbursements={reimbursements} /> : null}
        {activeKey === 'payoutBatches' ? (
          selectedPayoutBatch ? (
            <PayoutBatchDetailScreen batch={selectedPayoutBatch} onBack={onBackFromPayoutBatch} />
          ) : (
            <PayoutBatchScreen payoutBatches={payoutBatches} onSelectBatch={onSelectPayoutBatch} />
          )
        ) : null}
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
    padding: spacing.xs,
  },
});
