import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import type { Job } from '@jobcore/core';
import { Button, EmptyState, colors } from '@jobcore/ui';
import type { JobEstimate, Payment, PaymentMethod } from '../../../../modules/admin-finance/src/data/ports';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_PICK_ORDER } from '../../../../modules/admin-finance/src/data/ports';
import { formatWorkDuration, workDurationMs } from '../../../../modules/admin-finance/src/domain/work-duration';
import { balanceCents, canRecordPayment, invoiceTotalCents, settledTotalCents } from '../../../../modules/admin-finance/src/domain/payments';
import { recordJobPayment } from '../../../../modules/admin-finance/src/flows/record-job-payment';
import { buildAdminFinancePorts } from '../lib/admin-finance-repos';
import { useSession } from '../lib/session';

export type JobPaymentRegionProps = {
  job: Job;
  role: string;
};

const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

export function JobPaymentRegion({ job, role }: JobPaymentRegionProps) {
  const session = useSession();
  const ports = useMemo(() => buildAdminFinancePorts(), []);
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('zelle');
  const [busy, setBusy] = useState(false);
  const canConfirm = role === 'admin' || role === 'owner';

  const load = useCallback(async () => {
    try {
      const [est, rows] = await Promise.all([ports.estimates.getForJob(job.id), ports.payments.listForJob(job.id)]);
      setEstimate(est);
      setPayments(rows);
      setError(null);
    } catch (err) {
      setError(`Could not load payments: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [ports, job.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const record = useCallback((useMethod: PaymentMethod) => {
    if (session.status !== 'authenticated' || !estimate) {
      return;
    }
    const balanceNow = balanceCents(invoiceTotalCents(estimate), payments);
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        const result = await recordJobPayment(
          role,
          session.organization.id,
          job,
          estimate,
          payments,
          { amountDollars: balanceNow / 100, method: useMethod },
          { payments: ports.payments },
        );
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        await load();
      } catch (err) {
        setError(`Could not record payment: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(false);
      }
    })();
  }, [session, estimate, role, job, payments, ports.payments, load]);

  if (loading) {
    return <EmptyState title="Payments" message="Loading..." />;
  }
  if (!estimate) {
    return <EmptyState title="Payments" message="No estimate yet. Payments open once an estimate is approved." />;
  }

  const invoice = invoiceTotalCents(estimate);
  const paid = settledTotalCents(payments);
  const balance = balanceCents(invoice, payments);
  const allowed = canRecordPayment(job, estimate);
  const summary = estimate.summary?.trim() || job.description?.trim() || null;
  const enabled = canConfirm && allowed && !busy;

  return (
    <View style={{ padding: 12, gap: 8 }}>
      <Text style={{ fontWeight: '700', fontSize: 18 }}>Payments</Text>
      {summary ? <Text>{summary}</Text> : null}
      <Text>Time on site: {formatWorkDuration(workDurationMs(job))}</Text>
      <Text>Work total: {money(invoice)}</Text>
      <Text>Paid so far: {money(paid)}</Text>
      <Text>Balance: {money(balance)}</Text>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      {payments.length === 0 ? <Text>No payments recorded.</Text> : null}
      {payments.map((p) => (
        <Text key={p.id}>
          {p.method ?? 'unspecified'} - {money(Math.round(p.amount * 100))} - {String(p.createdAt ?? '').slice(0, 10)}
        </Text>
      ))}

      {!allowed ? (
        <Text>Payments cannot be recorded: the estimate must be approved and the job must not be cancelled.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          <Button
            label="Take cash"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!enabled || balance <= 0}
            onPress={() => record('cash')}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {PAYMENT_METHOD_PICK_ORDER.filter((m) => m !== 'cash').map((m) => (
              <Button
                key={m}
                label={PAYMENT_METHOD_LABELS[m]}
                size="sm"
                variant={method === m ? 'primary' : 'outline'}
                onPress={() => setMethod(m)}
              />
            ))}
          </View>
          <Button
            label={`Confirm ${PAYMENT_METHOD_LABELS[method]} ${money(balance)}`}
            variant="primary"
            disabled={!enabled || balance <= 0 || method === 'cash'}
            onPress={() => record(method)}
          />
          {!canConfirm ? <Text>Admin/owner only</Text> : null}
        </View>
      )}
    </View>
  );
}

export default JobPaymentRegion;
