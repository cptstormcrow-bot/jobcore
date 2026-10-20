// JobCore screen #0089 - af-review - Review
/**
 * Reconciliation screen for the payment-review module.
 *
 * Shows two sections:
 *  - Needs attention: payments whose `status` is `'pending'` or `'failed'`
 *    (queried against the `payments` table's `status` column).
 *  - Manually confirmed: `'manual_confirmed'` payments grouped by the tech
 *    who confirmed them (`confirmed_by`).
 *  Both lists show the short job number (`Job #N`) and tap-to-open-job.
 *
 * Data-fetch shape mirrors `data/ports.ts`'s `hasSettledPaymentForJob` /
 * `SupabaseSelectClient` discipline (a narrow `.from().select().in()`
 * surface, not the full `@supabase/supabase-js` client) and this module's
 * own `index.ts` injection style (host supplies the client; no live
 * Supabase construction here). Component-level data loading follows
 * `modules/field-tech/src/screens/DayList.tsx`'s effect/loading/error
 * pattern; the client is passed as a prop rather than pulled from a module
 * session/ports seam, mirroring `Earnings.tsx`'s prop-injection style —
 * payment-review has no `lib/module-ports.ts` of its own yet.
 *
 * Renders exclusively with `packages/ui`'s `Card`/`ListItem`/`EmptyState`/
 * `LoadingState`/`ErrorState` primitives — no new UI primitives are
 * introduced by this screen.
 *
 * Scope: reads the `payments` table only. Never reads or writes
 * `commissions`/`payout_lines`.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, Text, formatJobNumberLabel, formatCreatedDate } from '@jobcore/ui';

import type { PaymentRow, SupabaseSelectClient } from '../data/ports';

export interface ReconciliationViewProps {
  /** Injected query client — the host is the sole source, mirroring `index.ts`'s `setSupabaseClient`. */
  client: SupabaseSelectClient;
  /** Short human job numbers keyed by job id; a missing entry renders as `Job #—`. */
  jobNumbers?: Record<string, number | null | undefined>;
  /** Display names keyed by employee id; an unmatched confirmer renders as `Unknown tech`. */
  employeeNames?: Record<string, string>;
  /** Tapping a job row opens that job. */
  onOpenJob?: (jobId: string) => void;
}

const NEEDS_ATTENTION_STATUSES: readonly string[] = ['pending', 'failed'];
const MANUAL_CONFIRMED_STATUS = 'manual_confirmed';
const UNKNOWN_CONFIRMER_LABEL = 'Unknown tech';

/** Groups `manual_confirmed` rows by `confirmed_by`, falling back to `UNKNOWN_CONFIRMER_LABEL` for a null confirmer. */
function groupByConfirmedBy(rows: PaymentRow[]): Map<string, PaymentRow[]> {
  const groups = new Map<string, PaymentRow[]>();
  for (const row of rows) {
    const key = row.confirmed_by ?? UNKNOWN_CONFIRMER_LABEL;
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }
  return groups;
}

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Reconciliation screen: lists `pending`/`failed` payments needing
 * attention, and `manual_confirmed` payments grouped by confirming tech.
 * Read-only — this screen issues no writes against `payments` or any other
 * table.
 */
export function ReconciliationView({ client, jobNumbers, employeeNames, onOpenJob }: ReconciliationViewProps): React.ReactElement {
  const [needsAttention, setNeedsAttention] = useState<PaymentRow[]>([]);
  const [manualConfirmed, setManualConfirmed] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      client.from('payments').select('*').in('status', NEEDS_ATTENTION_STATUSES),
      client.from('payments').select('*').in('status', [MANUAL_CONFIRMED_STATUS]),
    ])
      .then(([pendingOrFailedResult, manualConfirmedResult]) => {
        if (cancelled) {
          return;
        }
        if (pendingOrFailedResult.error) {
          throw new Error(pendingOrFailedResult.error.message);
        }
        if (manualConfirmedResult.error) {
          throw new Error(manualConfirmedResult.error.message);
        }
        setNeedsAttention(pendingOrFailedResult.data ?? []);
        setManualConfirmed(manualConfirmedResult.data ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load payments.');
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
  }, [client]);

  if (loading) {
    return <LoadingState label="Loading payment reconciliation…" />;
  }

  if (error !== null) {
    return <ErrorState title="Couldn't load payments" message={error} />;
  }

  const confirmedGroups = groupByConfirmedBy(manualConfirmed);

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Reconciliation" />
      <Text style={styles.heading}>Needs attention</Text>
      {needsAttention.length === 0 ? (
        <EmptyState title="Nothing pending" message="No pending or failed payments." />
      ) : (
        <Card style={styles.section}>
          {needsAttention.map((row) => (
            <ListItem
              key={row.id}
              title={formatJobNumberLabel(jobNumbers?.[row.job_id])}
              onPress={onOpenJob ? () => onOpenJob(row.job_id) : undefined}
              subtitle={`${row.status} — ${formatAmount(row.amount)}`}
            />
          ))}
        </Card>
      )}

      <Text style={styles.heading}>Manually confirmed</Text>
      {confirmedGroups.size === 0 ? (
        <EmptyState title="No manual confirmations" message="No manually confirmed payments yet." />
      ) : (
        Array.from(confirmedGroups.entries()).map(([techId, rows]) => (
          <Card key={techId} style={styles.section}>
            <Text style={styles.groupTitle}>{employeeNames?.[techId] ?? UNKNOWN_CONFIRMER_LABEL}</Text>
            {rows.map((row) => (
              <ListItem
                key={row.id}
                title={formatJobNumberLabel(jobNumbers?.[row.job_id])}
                onPress={onOpenJob ? () => onOpenJob(row.job_id) : undefined}
                subtitle={`${formatAmount(row.amount)}${row.confirmed_at ? ` — ${formatCreatedDate(row.confirmed_at)}` : ''}`}
              />
            ))}
          </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  section: {
    marginBottom: 12,
  },
  groupTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
});
