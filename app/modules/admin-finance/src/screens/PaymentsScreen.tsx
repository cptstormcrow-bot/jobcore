// JobCore screen #0046 - af-payments-PaymentsScreen - Payments
/**
 * Payments screen (Workstream D — folded in from the retired `payment-review`
 * module's `ReconciliationView.tsx`).
 *
 * Props-in / callbacks-out against `../data/ports.ts`'s `PaymentsRepository`
 * — the host app injects the concrete repository as a prop; this screen
 * never imports Supabase directly. Mirrors `AuditLogScreen.tsx`'s session
 * seam (`getModuleSession`) and `LoadState` discriminated-union pattern.
 *
 * Shows two sections, ported from `ReconciliationView.tsx`:
 *  - Needs attention: payments whose `status` is `'pending'` or `'failed'`.
 *  - Manually confirmed: `'manual_confirmed'` payments grouped by the tech
 *    who confirmed them (`confirmedBy`).
 *
 * Read-only: this screen issues no writes against `payments`. Marking a
 * payment paid is a job action (see `modules/admin-finance/src/index.ts`),
 * not a control on this screen.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, StyleSheet } from 'react-native';
import { Card, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing, Text } from '@jobcore/ui';
import type { Payment, PaymentsRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface PaymentsScreenProps {
  payments?: PaymentsRepository;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; needsAttention: Payment[]; manuallyConfirmed: Payment[] }
  | { kind: 'failed'; message: string };

const UNKNOWN_CONFIRMER_LABEL = 'Unknown tech';

/** Groups `manual_confirmed` payments by `confirmedBy`, falling back to `UNKNOWN_CONFIRMER_LABEL` for a null confirmer. */
function groupByConfirmedBy(payments: Payment[]): Map<string, Payment[]> {
  const groups = new Map<string, Payment[]>();
  for (const payment of payments) {
    const key = payment.confirmedBy ?? UNKNOWN_CONFIRMER_LABEL;
    const existing = groups.get(key);
    if (existing) {
      existing.push(payment);
    } else {
      groups.set(key, [payment]);
    }
  }
  return groups;
}

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function PaymentsScreen({ payments: paymentsRepository }: PaymentsScreenProps = {}) {
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!session || !paymentsRepository) {
      return;
    }
    let cancelled = false;
    if (!hasLoadedRef.current) setLoadState({ kind: 'loading' });
    Promise.all([
      paymentsRepository.listNeedingAttention(session.org.id),
      paymentsRepository.listManuallyConfirmed(session.org.id),
    ])
      .then(([needsAttention, manuallyConfirmed]) => {
        if (!cancelled) { hasLoadedRef.current = true; setLoadState({ kind: 'loaded', needsAttention, manuallyConfirmed }); }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load payments.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, paymentsRepository, rev]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Payments" message="Sign in to view this organization's payments." />
      </View>
    );
  }

  if (!paymentsRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Payments" message="No data source is connected for this module yet." />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading payments..." />
      </View>
    );
  }

  if (loadState.kind === 'failed') {
    return (
      <View style={styles.screen}>
        <ErrorState message={loadState.message} />
      </View>
    );
  }

  const confirmedGroups = groupByConfirmedBy(loadState.manuallyConfirmed);

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <ScreenTitle title="Payments" />
        <Text style={styles.heading}>Needs attention</Text>
        {loadState.needsAttention.length === 0 ? (
          <EmptyState title="Nothing pending" message="No pending or failed payments." />
        ) : (
          <Card style={styles.card}>
            {loadState.needsAttention.map((payment) => (
              <View key={payment.id} style={styles.row}>
                <Text style={styles.action}>Job {payment.jobId}</Text>
                <Text style={styles.detail}>
                  {payment.status} — {formatAmount(payment.amount)}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Text style={styles.heading}>Manually confirmed</Text>
        {confirmedGroups.size === 0 ? (
          <EmptyState title="No manual confirmations" message="No manually confirmed payments yet." />
        ) : (
          Array.from(confirmedGroups.entries()).map(([techId, groupedPayments]) => (
            <Card key={techId} style={styles.card}>
              <Text style={styles.groupTitle}>{techId}</Text>
              {groupedPayments.map((payment) => (
                <View key={payment.id} style={styles.row}>
                  <Text style={styles.action}>Job {payment.jobId}</Text>
                  <Text style={styles.detail}>
                    {formatAmount(payment.amount)}
                    {payment.confirmedAt ? ` — ${payment.confirmedAt}` : ''}
                  </Text>
                </View>
              ))}
            </Card>
          ))
        )}
      </View>
    </View>
  );
}

export default PaymentsScreen;

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  action: {
    fontWeight: '600',
  },
  detail: {
    color: colors.textLight,
  },
  groupTitle: {
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
});
