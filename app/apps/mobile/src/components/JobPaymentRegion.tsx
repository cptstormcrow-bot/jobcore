import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Job } from '@jobcore/core';
import { EmptyState, colors } from '@jobcore/ui';
import type { JobEstimate, Payment, PaymentMethod } from '../../../../modules/admin-finance/src/data/ports';
import { PAYMENT_METHODS } from '../../../../modules/admin-finance/src/data/ports';
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
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState('');
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

  const handleConfirm = useCallback(() => {
    if (session.status !== 'authenticated' || !estimate) {
      return;
    }
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
          { amountDollars: Number(amount), method },
          { payments: ports.payments },
        );
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        setAmount('');
        await load();
      } catch (err) {
        setError(`Could not record payment: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(false);
      }
    })();
  }, [session, estimate, role, job, payments, amount, method, ports.payments, load]);

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
  const enabled = canConfirm && allowed && !busy;

  return (
    <View style={{ padding: 12, gap: 8 }}>
      <Text style={{ fontWeight: '700', fontSize: 18 }}>Payments</Text>
      <Text>Invoice total: {money(invoice)}</Text>
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {PAYMENT_METHODS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                style={{ padding: 8, borderWidth: 1, borderRadius: 6, opacity: method === m ? 1 : 0.5 }}
              >
                <Text>{m}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount (dollars)"
            keyboardType="decimal-pad"
            style={{ borderWidth: 1, borderRadius: 6, padding: 8 }}
          />
          <Pressable
            onPress={handleConfirm}
            disabled={!enabled}
            style={{ padding: 10, borderRadius: 6, borderWidth: 1, opacity: enabled ? 1 : 0.4 }}
          >
            <Text>Confirm</Text>
          </Pressable>
          {!canConfirm ? <Text>Admin/owner only</Text> : null}
        </View>
      )}
    </View>
  );
}

export default JobPaymentRegion;
