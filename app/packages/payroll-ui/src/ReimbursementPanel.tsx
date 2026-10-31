import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, TextInput, View } from 'react-native';
import { PayrollButton, colors } from '@jobcore/ui';
import type {
  AdminReimbursement,
  PayrollAdminPort,
  PayrollReimbursement,
  PayrollSelfPort,
} from './port';
import { ReceiptCapture } from './ReceiptCapture';
import { errorText } from './errorText';

export type ReimbursementPanelActions = {
  submit: () => void | Promise<void>;
  canSubmit: boolean;
  busy: boolean;
};

export interface ReimbursementPanelProps {
  port: PayrollSelfPort;
  userId: string;
  onRegisterActions?: (a: ReimbursementPanelActions) => void;
}

/** Client-generated uuid (v4 shape). */
function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

/** Dollar text to integer cents; 0 when invalid. */
function dollarsToCents(text: string): number {
  const t = text.trim().replace(/^\$/, '');
  if (!/^\d*\.?\d{0,2}$/.test(t) || t === '' || t === '.') return 0;
  return Math.round(parseFloat(t) * 100);
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

export function ReimbursementPanel({ port, userId, onRegisterActions }: ReimbursementPanelProps) {
  const adminPort = port as PayrollSelfPort & Partial<PayrollAdminPort>;
  const isAdmin = typeof adminPort.listAllReimbursements === 'function';
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [jobId, setJobId] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [history, setHistory] = useState<PayrollReimbursement[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [allList, setAllList] = useState<AdminReimbursement[] | null>(null);
  const [allError, setAllError] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const list = await port.listMyReimbursements();
        if (!cancelled) setHistory(list.filter((r) => r.userId === userId));
      } catch (e) {
        if (!cancelled) setLoadError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, userId, reloadTick]);

  useEffect(() => {
    if (typeof adminPort.listAllReimbursements !== 'function') return;
    let cancelled = false;
    setAllError(null);
    (async () => {
      try {
        const list = await adminPort.listAllReimbursements!();
        if (!cancelled) {
          setAllList(
            [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
          );
        }
      } catch (e) {
        if (!cancelled) setAllError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, reloadTick]);

  const amountCents = dollarsToCents(amountText);
  const canSubmit =
    !submitting && receiptUri !== null && amountCents > 0 && description.trim().length > 0;

  const onSubmit = useCallback(async () => {
    if (!canSubmit || receiptUri === null) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const job = jobId.trim();
      await port.submitReimbursement({
        id: newId(),
        amountCents,
        description: description.trim(),
        jobId: job.length > 0 ? job : null,
        receiptUri,
      });
      setAmountText('');
      setDescription('');
      setJobId('');
      setReceiptUri(null);
      setReloadTick((n) => n + 1);
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, receiptUri, jobId, port, amountCents, description]);

  useEffect(() => {
    onRegisterActions?.({ submit: onSubmit, canSubmit, busy: submitting });
  }, [onRegisterActions, onSubmit, canSubmit, submitting]);

  const onViewReceipt = useCallback(
    async (path: string) => {
      setReceiptError(null);
      if (path.length > 200 || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
        setReceiptError('Receipt not available - this request has no stored receipt file.');
        return;
      }
      try {
        const url = await adminPort.getReceiptUrl?.(path);
        if (!url) {
          setReceiptError('Receipt not available - this request has no stored receipt file.');
          return;
        }
        await Linking.openURL(url);
      } catch (e) {
        setReceiptError(errorText(e));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [port],
  );

  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 16, gap: 8 }}>
      <Text style={{ fontWeight: '600' }}>New reimbursement</Text>
      <TextInput
        value={amountText}
        onChangeText={setAmountText}
        placeholder="Amount (dollars)"
        keyboardType="decimal-pad"
        editable={!submitting}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 }}
      />
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Description (required)"
        editable={!submitting}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 }}
      />
      <TextInput
        value={jobId}
        onChangeText={setJobId}
        placeholder="Job ID (optional)"
        autoCapitalize="none"
        editable={!submitting}
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 }}
      />
      <ReceiptCapture uri={receiptUri} onChange={setReceiptUri} disabled={submitting} />
      {formError ? <Text style={{ color: colors.danger }}>{formError}</Text> : null}
      {onRegisterActions ? null : (
        <PayrollButton label="Submit" onPress={() => void onSubmit()} disabled={!canSubmit} />
      )}

      <Text style={{ fontWeight: '600', marginTop: 12 }}>My reimbursements</Text>
      {loadError ? <Text style={{ color: colors.danger }}>{loadError}</Text> : null}
      {history === null && !loadError ? <ActivityIndicator /> : null}
      {history !== null && history.length === 0 ? <Text>No reimbursements yet.</Text> : null}
      {(history ?? []).map((r) => (
        <View
          key={r.id}
          style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8 }}
        >
          <Text>
            {formatMoney(r.amountCents)} - {r.status}
          </Text>
          <Text>{r.description}</Text>
          {r.status === 'rejected' && r.rejectionReason ? (
            <Text style={{ color: colors.danger }}>Rejected: {r.rejectionReason}</Text>
          ) : null}
        </View>
      ))}

      {isAdmin ? (
        <>
          <Text style={{ fontWeight: '600', marginTop: 12 }}>All reimbursements</Text>
          {allError ? <Text style={{ color: colors.danger }}>{allError}</Text> : null}
          {receiptError ? <Text style={{ color: colors.danger }}>{receiptError}</Text> : null}
          {allList === null && !allError ? <ActivityIndicator /> : null}
          {allList !== null && allList.length === 0 ? <Text>No reimbursements yet.</Text> : null}
          {(allList ?? []).map((r) => (
            <View
              key={r.id}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, gap: 4 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600' }}>{r.employeeName}</Text>
                  <Text>
                    {formatMoney(r.amountCents)} - {r.status}
                  </Text>
                  <Text>{r.description}</Text>
                  <Text>{formatDate(r.createdAt)}</Text>
                </View>
                {r.receiptPhotoPath && typeof adminPort.getReceiptUrl === 'function' ? (
                  <PayrollButton
                    label="View receipt"
                    onPress={() => void onViewReceipt(r.receiptPhotoPath as string)}
                    style={{ alignSelf: 'center' }}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}
