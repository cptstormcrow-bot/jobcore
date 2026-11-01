import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { Ctx, Job } from '@jobcore/core';
import { EmptyState, PayrollButton, colors, radius, selectedStyle, spacing, typography } from '@jobcore/ui';
import type { JobEstimate, Payment, PaymentMethod } from '../../../../modules/admin-finance/src/data/ports';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_PICK_ORDER } from '../../../../modules/admin-finance/src/data/ports';
import { formatWorkDuration, workDurationMs } from '../../../../modules/admin-finance/src/domain/work-duration';
import { balanceCents, canRecordPayment, invoiceTotalCents, settledTotalCents } from '../../../../modules/admin-finance/src/domain/payments';
import { computeTotals } from '../../../../modules/admin-finance/src/domain/estimate-layout';
import { transitionJob } from '../../../../modules/admin-finance/src/domain/transition';
import { recordJobPayment } from '../../../../modules/admin-finance/src/flows/record-job-payment';
import { buildAdminFinancePorts, createJobRepository } from '../lib/admin-finance-repos';
import { useSession } from '../lib/session';

export type JobPaymentRegionProps = {
  job: Job;
  role: string;
  /** Called with the updated job after it moves to 'paid' so the parent refreshes. */
  onJobUpdated?: (job: Job) => void;
};

type CompanyInfo = { name?: string | null; address?: string | null; licenseNumber?: string | null; phone?: string | null };
const BARCODE_METHODS: readonly PaymentMethod[] = ['zelle', 'paypal', 'venmo'];

const OVER_BALANCE_MSG = 'Amount is more than the balance. Use Adjust price to add an item or fee.';
const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

// Cash is deliberately last, right of Credit card, and always rendered.
const METHOD_CHIP_ORDER: readonly PaymentMethod[] = [...PAYMENT_METHOD_PICK_ORDER.filter((m) => m !== 'cash'), 'cash'];

// Parses a typed cash amount into cents; blank or invalid input returns null.
function parseCashCents(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) {
    return null;
  }
  const cents = Math.round(Number(s) * 100);
  return cents > 0 ? cents : null;
}

export function JobPaymentRegion({ job, role, onJobUpdated }: JobPaymentRegionProps) {
  const session = useSession();
  const ports = useMemo(() => buildAdminFinancePorts(), []);
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('zelle');
  const [busy, setBusy] = useState(false);
  // Sync guard: a fast double-tap fires twice before `busy` re-renders.
  const recordingRef = useRef(false);
  const [cashReceived, setCashReceived] = useState('');
  const [workTotal, setWorkTotal] = useState<number | null>(null);
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [cardHolder, setCardHolder] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjDesc, setAdjDesc] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [, setTick] = useState(0);
  const canConfirm = role === 'admin' || role === 'owner';

  const load = useCallback(async () => {
    try {
      const [est, rows, items] = await Promise.all([
        ports.estimates.getForJob(job.id),
        ports.payments.listForJob(job.id),
        ports.estimates.listLineItems(job.id),
      ]);
      setEstimate(est);
      const loadedWork = items.length > 0 ? Math.round(computeTotals(items, []).total * 100) : null;
      setWorkTotal(loadedWork);
      setPayments(rows);
      // Smart-fill: Total Paid defaults to the balance after every load/adjustment.
      const loadedBalance = est ? balanceCents(loadedWork ?? invoiceTotalCents(est), rows) : 0;
      setCashReceived(loadedBalance > 0 ? (loadedBalance / 100).toFixed(2) : '');
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

  // Re-render Time on site while the job is in progress.
  useEffect(() => {
    if (job.status !== 'in_progress') {
      return undefined;
    }
    const id = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [job.status]);

  const orgId = session.status === 'authenticated' ? session.organization.id : null;
  useEffect(() => {
    if (!orgId) {
      return;
    }
    void ports.companyInfo.get(orgId).then(setCompany).catch(() => setCompany(null));
  }, [ports, orgId]);

  const record = useCallback((useMethod: PaymentMethod) => {
    if (session.status !== 'authenticated' || !estimate || recordingRef.current) {
      return;
    }
    const workCents = workTotal ?? invoiceTotalCents(estimate);
    const balanceNow = balanceCents(workCents, payments);
    let amountCents = balanceNow;
    if (cashReceived.trim() !== '') {
      const cents = parseCashCents(cashReceived);
      if (cents === null || cents <= 0 || cents > balanceNow) {
        setError(cents !== null && cents > balanceNow ? OVER_BALANCE_MSG : 'Enter a paid amount between $0.01 and the balance.');
        return;
      }
      amountCents = cents;
    } else if (amountCents <= 0) {
      setError('Enter the cash amount');
      return;
    }
    setError(null);
    recordingRef.current = true;
    setBusy(true);
    void (async () => {
      try {
        const result = await recordJobPayment(
          role,
          session.organization.id,
          job,
          estimate,
          payments,
          { amountDollars: amountCents / 100, method: useMethod, workTotalCents: workCents },
          { payments: ports.payments },
        );
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        // Payments are allowed while in progress; the job only moves to Paid once it is completed (paid-in-full jobs are flipped when completed).
        if (result.balanceCents <= 0 && job.status === 'completed') {
          const ctx: Ctx = { role: role as Ctx['role'], now: () => new Date().toISOString(), hasPaymentRecord: () => true };
          const updated = await transitionJob(job, 'paid', ctx);
          await createJobRepository().updateStatus(job.id, 'paid');
          onJobUpdated?.({ ...updated, status: 'paid' as Job['status'] });
        }
        await load();
        setCardHolder('');
        setCardLast4('');
        setCardRef('');
      } catch (err) {
        setError(`Could not record payment: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        recordingRef.current = false;
        setBusy(false);
      }
    })();
  }, [session, estimate, role, job, payments, ports.payments, load, cashReceived, workTotal, onJobUpdated]);

  const saveAdjustment = () => {
    const amt = parseCashCents(adjAmount);
    if (adjDesc.trim() === '' || amt === null) {
      setError('Enter a description and an amount greater than $0.');
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        const dollars = amt / 100;
        await ports.estimates.addLineItem(job.id, {
          kind: 'other',
          description: adjDesc.trim(),
          quantity: 1,
          unitCost: dollars,
          lineTotal: dollars,
        });
        setAdjDesc('');
        setAdjAmount('');
        setAdjustOpen(false);
        await load();
      } catch (err) {
        setError(`Could not adjust price: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading) {
    return <EmptyState title="Payments" message="Loading..." />;
  }
  if (!estimate) {
    return <EmptyState title="Payments" message={error ?? 'No estimate yet. Payments open once an estimate is approved.'} />;
  }

  const invoice = workTotal ?? invoiceTotalCents(estimate);
  const paid = settledTotalCents(payments);
  const balance = balanceCents(invoice, payments);
  const allowed = canRecordPayment(job, estimate);
  const summary = estimate.summary?.trim() || job.description?.trim() || null;
  const isCash = method === 'cash';
  const cancelled = job.status === 'cancelled';
  const enabled = isCash ? !cancelled && !busy : canConfirm && allowed && !busy;
  const cashCents = parseCashCents(cashReceived);
  const cashInvalid =
    cashReceived.trim() !== '' && (cashCents === null || cashCents <= 0 || cashCents > balance);
  const isPaidState = balance <= 0 && settledTotalCents(payments) > 0;
  const inputStyle = { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.size.body, color: colors.text, backgroundColor: colors.surface } as const;

  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      <Text style={{ fontWeight: '700', fontSize: typography.size.h5 }}>Payments</Text>
      {summary ? <Text style={{ fontSize: typography.size.h4, fontWeight: '700' }}>{summary}</Text> : null}
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

      {!allowed && !isCash ? (
        <Text>Payments cannot be recorded: the estimate must be approved and the job must not be cancelled.</Text>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {METHOD_CHIP_ORDER.map((m) => (
            <PayrollButton
              key={m}
              label={PAYMENT_METHOD_LABELS[m]}
              onPress={() => setMethod(m)}
              style={selectedStyle(method === m)}
            />
          ))}
        </View>
        {BARCODE_METHODS.includes(method) ? (
          <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, gap: spacing.xs }}>
            <Text style={{ fontWeight: '700' }}>Company Info</Text>
            <Text>{company?.name ?? ''}</Text>
            <Text>{company?.address ?? ''}</Text>
            <Text>License #: {company?.licenseNumber ?? ''}</Text>
            <Text>Phone: {company?.phone ?? ''}</Text>
            <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.textMuted }}>{PAYMENT_METHOD_LABELS[method]} barcode</Text>
            </View>
          </View>
        ) : null}
        {method === 'check' || method === 'cash' ? (
          <Text style={{ fontSize: typography.size.small, color: colors.textMuted }}>Tech manages {method}</Text>
        ) : null}
        {method === 'debit' || method === 'credit' ? (
          <View style={{ gap: spacing.xs }}>
            <Text style={{ fontWeight: '700' }}>Enter card details</Text>
            {([['Cardholder', cardHolder, setCardHolder], ['Last 4 digits', cardLast4, setCardLast4], ['Reference', cardRef, setCardRef]] as const).map(([label, val, set]) => (
              <TextInput
                key={label}
                value={val}
                onChangeText={(t) => set(label === 'Last 4 digits' ? t.replace(/\D/g, '').slice(0, 4) : t)}
                placeholder={label}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={label}
                style={inputStyle}
              />
            ))}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ fontSize: typography.size.small, color: colors.textMuted }}>Total Paid (for anything selected above)</Text>
            <TextInput
              value={cashReceived}
              onChangeText={setCashReceived}
              keyboardType="decimal-pad"
              placeholder={(balance / 100).toFixed(2)}
              placeholderTextColor={colors.textMuted}
              editable={enabled}
              accessibilityLabel="Total Paid"
              style={{
                ...inputStyle,
                borderColor: cashInvalid ? colors.danger : colors.border,
                opacity: enabled ? 1 : 0.5,
              }}
            />
          </View>
          {isPaidState ? (
            <View
              accessibilityRole="text"
              accessibilityLabel="Paid"
              style={{ height: 28, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: typography.size.small, fontWeight: '700' }}>{'✓ Paid'}</Text>
            </View>
          ) : (
            <PayrollButton
              label={`Paid ${money(cashReceived.trim() !== '' && !cashInvalid ? (cashCents ?? balance) : balance)}`}
              disabled={!enabled || balance <= 0 || cashInvalid}
              textStyle={{ fontWeight: '700' }}
              onPress={() => record(method)}
            />
          )}
        </View>
        {cashInvalid ? (
          <Text style={{ color: colors.danger }}>
            {cashCents !== null && cashCents > balance ? OVER_BALANCE_MSG : 'Enter an amount between $0.01 and the balance.'}
          </Text>
        ) : null}
        {!cancelled ? (
          <View style={{ gap: spacing.sm }}>
            <PayrollButton label="Adjust price" disabled={busy} onPress={() => setAdjustOpen((o) => !o)} />
            {adjustOpen ? (
              <View style={{ gap: spacing.xs }}>
                <TextInput
                  value={adjDesc}
                  onChangeText={setAdjDesc}
                  placeholder="Description"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Description"
                  style={inputStyle}
                />
                <TextInput
                  value={adjAmount}
                  onChangeText={setAdjAmount}
                  keyboardType="decimal-pad"
                  placeholder="Amount ($)"
                  placeholderTextColor={colors.textMuted}
                  accessibilityLabel="Amount"
                  style={inputStyle}
                />
                <PayrollButton label="Save" disabled={busy} onPress={saveAdjustment} />
              </View>
            ) : null}
          </View>
        ) : null}
        {!canConfirm && !isCash ? <Text>Admin/owner only</Text> : null}
      </View>
    </View>
  );
}

export default JobPaymentRegion;
