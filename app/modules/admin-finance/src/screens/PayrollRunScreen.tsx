// JobCore screen #0087 - af-PayrollRun - Payroll Run
/**
 * Payroll run screen — build and close a weekly payroll run, pick an export
 * formatter, and export. Uses the admin members of the payroll port
 * (`closeRun`, `exportRun`); renders a short message when they are absent.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { Button, EmptyState, Text, TextField } from '@jobcore/ui';
import type { PayrollDateRange, PayrollExportFormat } from '@jobcore/payroll-ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';

export interface PayrollRunScreenProps {
  onBack?: () => void;
}

type IsoDate = PayrollDateRange['from'];

const FORMATS: { key: PayrollExportFormat; label: string }[] = [
  { key: 'generic_csv', label: 'Generic CSV' },
  { key: 'qbo_journal_csv', label: 'QBO journal CSV' },
  { key: 'iif_journal', label: 'IIF' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PayrollRunScreen(props: PayrollRunScreenProps = {}) {
  const { onBack } = props;
  const session = useModuleSession();
  const payroll = getModulePorts().payroll;
  const [weekStart, setWeekStart] = useState('');
  const [format, setFormat] = useState<PayrollExportFormat>('generic_csv');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  if (!payroll || !session) {
    return (
      <View>
        <EmptyState title="Payroll is not available yet" />
        {onBack ? <Button label="Back" onPress={onBack} /> : null}
      </View>
    );
  }

  const validDate = DATE_RE.test(weekStart) && !Number.isNaN(Date.parse(weekStart));
  const closeRun = payroll.closeRun;
  const exportRun = payroll.exportRun;

  const onClose = async () => {
    if (!closeRun || !validDate) return;
    setBusy(true);
    setStatus('Closing run...');
    try {
      const range: PayrollDateRange = {
        from: weekStart as IsoDate,
        to: addDays(weekStart, 6) as IsoDate,
      };
      const res = await closeRun.call(payroll, range);
      setBatchId(res.batchId);
      setStatus(`Run closed (batch ${res.batchId}).`);
    } catch (e) {
      setStatus(`Close failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onExport = async () => {
    if (!exportRun || !batchId) return;
    setBusy(true);
    setStatus('Exporting...');
    try {
      const doc = await exportRun.call(payroll, batchId, format);
      setStatus(`Exported ${doc.lines.length} line(s) for ${doc.periodStart} to ${doc.periodEnd}.`);
    } catch (e) {
      setStatus(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {onBack ? <Button label="Back" onPress={onBack} /> : null}
      <Text>Weekly payroll run</Text>
      <TextField
        label="Week start (YYYY-MM-DD)"
        value={weekStart}
        onChangeText={setWeekStart}
        placeholder="2026-10-05"
        error={weekStart && !validDate ? 'Use YYYY-MM-DD' : undefined}
      />
      <Button
        label="Close run"
        onPress={onClose}
        disabled={busy || !validDate || !closeRun}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {FORMATS.map((f) => (
          <Button
            key={f.key}
            label={f.label}
            size="sm"
            variant={format === f.key ? 'accent' : 'outline'}
            onPress={() => setFormat(f.key)}
          />
        ))}
      </View>
      <Button
        label="Export"
        onPress={onExport}
        disabled={busy || !batchId || !exportRun}
      />
      {status ? <Text>{status}</Text> : null}
    </View>
  );
}
