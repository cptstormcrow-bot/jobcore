import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { Ctx, Job } from '@jobcore/core';
import { EmptyState, PayrollButton, colors, radius, selectedStyle, spacing, compact, typography } from '@jobcore/ui';
import type { JobEstimate, Payment, PaymentMethod } from '../../../../modules/admin-finance/src/data/ports';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_PICK_ORDER } from '../../../../modules/admin-finance/src/data/ports';
import { formatWorkDuration, workDurationMs } from '../../../../modules/admin-finance/src/domain/work-duration';
import { balanceCents, canRecordPayment, invoiceTotalCents, settledTotalCents } from '../../../../modules/admin-finance/src/domain/payments';
import { computeTotals } from '../../../../modules/admin-finance/src/domain/estimate-layout';
import { transitionJob } from '../../../../modules/admin-finance/src/domain/transition';
import { recordJobPayment } from '../../../../modules/admin-finance/src/flows/record-job-payment';
import { getCardProcessor } from '../../../../modules/payment-review/src/domain/card-processors/registry';
import { buildAdminFinancePorts, createJobRepository } from '../lib/admin-finance-repos';
import { createJobPhotoRepository } from '../lib/field-tech-repos';
import { newClientId } from '../lib/ids';
import { pickJobPhoto, type PickedJobPhoto } from '../lib/job-photo-picker';
import { copyToLocal, storagePathFor } from '../lib/photo-files';
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

// Cash is deliberately last, right of Debit/Credit, and always rendered.
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
  const [cardNumber, setCardNumber] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [cardZip, setCardZip] = useState('');
  const [checkFront, setCheckFront] = useState<PickedJobPhoto | null>(null);
  const [checkBack, setCheckBack] = useState<PickedJobPhoto | null>(null);
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
        if (useMethod === 'card' || useMethod === 'debit' || useMethod === 'credit') {
          // The chosen processor (EXPO_PUBLIC_CARD_PROCESSOR) approves the charge first; 'none' records by hand.
          const charge = await getCardProcessor().charge({
            jobId: job.id,
            amountCents,
            currency: 'USD',
            card: { number: cardNumber, cvc: cardCvc, zip: cardZip, holder: cardHolder || undefined },
          });
          if (charge.status !== 'approved') {
            setError(charge.message);
            return;
          }
        }
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
        // Payments are allowed while in progress; the job status only moves to Paid once it is completed (paid-in-full jobs are flipped when completed). Completion is never automatic.
        if (result.balanceCents <= 0 && job.status === 'completed') {
          const ctx: Ctx = { role: role as Ctx['role'], now: () => new Date().toISOString(), hasPaymentRecord: () => true };
          const updated = await transitionJob(job, 'paid', ctx);
          await createJobRepository().updateStatus(job.id, 'paid');
          onJobUpdated?.({ ...updated, status: 'paid' as Job['status'] });
        } else if (result.balanceCents <= 0) {
          // Paid in full before completion: the job stays in its status, but a fresh object makes the stage bar re-check Paid.
          onJobUpdated?.({ ...job });
        }
        if (useMethod === 'check' && checkFront && checkBack) {
          try {
            await saveCheckPhotos(session.organization.id, session.session.user.id, job.id, [checkFront, checkBack]);
          } catch (err) {
            setError(`Payment recorded, but the check photos did not save: ${err instanceof Error ? err.message : String(err)}`);
          }
          setCheckFront(null);
          setCheckBack(null);
        }
        await load();
        setCardHolder('');
        setCardNumber('');
        setCardRef('');
        setCardCvc('');
        setCardZip('');
      } catch (err) {
        setError(`Could not record payment: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        recordingRef.current = false;
        setBusy(false);
      }
    })();
  }, [session, estimate, role, job, payments, ports.payments, load, cashReceived, workTotal, onJobUpdated, cardNumber, cardCvc, cardZip, cardHolder, checkFront, checkBack]);

  const takeCheckPhoto = (set: (p: PickedJobPhoto) => void) => {
    void pickJobPhoto('camera')
      .then((p) => {
        if (p) {
          set(p);
        }
      })
      .catch((err) => setError(`Could not take photo: ${err instanceof Error ? err.message : String(err)}`));
  };

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
  const isCash = method === 'cash';
  const cancelled = job.status === 'cancelled';
  const enabled = isCash ? !cancelled && !busy : canConfirm && allowed && !busy;
  const cashCents = parseCashCents(cashReceived);
  const isCard = method === 'card' || method === 'debit' || method === 'credit';
  // Card details are checked here and never saved: they are cleared once the payment is recorded.
  const cardProblem = !isCard
    ? null
    : !luhnValid(cardNumber)
      ? 'Enter a valid card number.'
      : !/^\d{3,4}$/.test(cardCvc)
        ? 'Enter the 3 or 4 digit CVC.'
        : !/^\d{5}$/.test(cardZip)
          ? 'Enter the 5 digit zip code.'
          : null;
  const checkPhotosMissing = method === 'check' && (!checkFront || !checkBack);
  const cashInvalid =
    cashReceived.trim() !== '' && (cashCents === null || cashCents <= 0 || cashCents > balance);
  // The Paid timeline dot goes green on job status or a settled balance, so the badge does both too.
  const isPaidState = job.status === 'paid' || job.status === 'closed' || (balance <= 0 && paid > 0);
  const inputStyle = { borderWidth: 1, borderColor: colors.divider, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: compact.field, fontSize: typography.text.input, color: colors.text, backgroundColor: colors.surface } as const;

  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      <Text style={{ fontSize: typography.size.h5 }}>Payments</Text>
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
            <Text>Company Info</Text>
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
        {method === 'check' ? (
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <PayrollButton
                label={checkFront ? '✓ Check front' : 'Check front'}
                disabled={busy}
                onPress={() => takeCheckPhoto(setCheckFront)}
                style={selectedStyle(checkFront !== null)}
              />
              <PayrollButton
                label={checkBack ? '✓ Check back' : 'Check back'}
                disabled={busy}
                onPress={() => takeCheckPhoto(setCheckBack)}
                style={selectedStyle(checkBack !== null)}
              />
            </View>
            {checkPhotosMissing ? (
              <Text style={{ fontSize: typography.size.small, color: colors.textMuted }}>Photograph both sides of the check.</Text>
            ) : null}
          </View>
        ) : null}
        {isCard ? (
          <View style={{ gap: spacing.xs }}>
            <Text>Enter card details</Text>
            {([
              ['Cardholder', cardHolder, setCardHolder, null],
              ['Card number', cardNumber, setCardNumber, 19],
              ['CVC', cardCvc, setCardCvc, 4],
              ['Zip code', cardZip, setCardZip, 5],
              ['Reference', cardRef, setCardRef, null],
            ] as const).map(([label, val, set, digits]) => (
              <TextInput
                key={label}
                value={val}
                onChangeText={(t) => set(digits ? t.replace(/\D/g, '').slice(0, digits) : t)}
                keyboardType={digits ? 'number-pad' : 'default'}
                secureTextEntry={label === 'CVC'}
                autoComplete="off"
                placeholder={label}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={label}
                style={inputStyle}
              />
            ))}
            {cardProblem && (cardNumber || cardCvc || cardZip) ? (
              <Text style={{ color: colors.danger }}>{cardProblem}</Text>
            ) : null}
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
              <Text style={{ color: '#fff', fontSize: typography.size.small }}>{'✓ Paid'}</Text>
            </View>
          ) : (
            <PayrollButton
              label={`Paid ${money(cashReceived.trim() !== '' && !cashInvalid ? (cashCents ?? balance) : balance)}`}
              disabled={!enabled || balance <= 0 || cashInvalid || cardProblem !== null || checkPhotosMissing}
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

/**
 * Saves the check's front and back as receipt photos on the job. Each goes through the
 * offline job_photo.create op, so it uploads once the device is back online.
 */
async function saveCheckPhotos(orgId: string, userId: string, jobId: string, photos: PickedJobPhoto[]): Promise<void> {
  const repo = createJobPhotoRepository();
  for (const photo of photos) {
    const id = newClientId();
    const ext = photo.mimeType === 'image/png' ? 'png' : 'jpg';
    const localUri = await copyToLocal(photo.uri, orgId, jobId, id, ext);
    const occurredAt = new Date().toISOString();
    await repo.create(orgId, {
      id,
      localUri,
      ext,
      jobId,
      techId: userId,
      kind: 'receipt',
      storagePath: storagePathFor(orgId, jobId, id, ext),
      occurredAt,
      lat: null,
      lng: null,
      idempotencyKey: id,
    });
  }
}

/** Luhn checksum: catches mistyped card numbers (13-19 digits). It does not approve the card. */
function luhnValid(num: string): boolean {
  if (!/^\d{13,19}$/.test(num)) {
    return false;
  }
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }
    sum += d;
  }
  return sum % 10 === 0;
}
