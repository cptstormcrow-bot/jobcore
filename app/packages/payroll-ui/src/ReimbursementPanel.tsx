import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import type { PayrollReimbursement, PayrollSelfPort } from './port';
import { ReceiptCapture } from './ReceiptCapture';

export interface ReimbursementPanelProps {
  port: PayrollSelfPort;
  userId: string;
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

export function ReimbursementPanel({ port, userId }: ReimbursementPanelProps) {
  const [amountText, setAmountText] = useState('');
  const [description, setDescription] = useState('');
  const [jobId, setJobId] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [history, setHistory] = useState<PayrollReimbursement[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const list = await port.listMyReimbursements();
        if (!cancelled) setHistory(list.filter((r) => r.userId === userId));
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, userId, reloadTick]);

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
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, receiptUri, jobId, port, amountCents, description]);

  return (
    <View style={{ padding: 12, gap: 8 }}>
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
      {formError ? <Text style={{ color: '#b00020' }}>{formError}</Text> : null}
      <Pressable
        onPress={() => void onSubmit()}
        disabled={!canSubmit}
        style={{
          padding: 12,
          borderRadius: 6,
          alignItems: 'center',
          backgroundColor: canSubmit ? '#1a73e8' : '#bbb',
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '600' }}>Submit</Text>
        )}
      </Pressable>

      <Text style={{ fontWeight: '600', marginTop: 12 }}>My reimbursements</Text>
      {loadError ? <Text style={{ color: '#b00020' }}>{loadError}</Text> : null}
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
            <Text style={{ color: '#b00020' }}>Rejected: {r.rejectionReason}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
