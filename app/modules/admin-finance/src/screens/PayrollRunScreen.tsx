// JobCore screen #0087 - af-PayrollRun - Payroll Run
/**
 * Payroll run screen — build and close a weekly payroll run, pick an export
 * formatter, and export. Uses the admin members of the payroll port
 * (`closeRun`, `exportRun`); renders a short message when they are absent.
 */

import React, { useState } from 'react';
import { Pressable, Text as RNText, View } from 'react-native';
import { EmptyState, Text, TextField } from '@jobcore/ui';
import type { PayrollDateRange, PayrollExportFormat } from '@jobcore/payroll-ui';
import { errorText } from '@jobcore/payroll-ui';
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

const sandButton = {
  backgroundColor: '#D9C7A0',
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 6,
} as const;
const sandButtonLabel = { color: '#000', fontWeight: '700' } as const;

function SandButton(props: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  selected?: boolean;
}) {
  const { label, onPress, disabled, selected } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        sandButton,
        selected ? { borderWidth: 2, borderColor: '#000' } : null,
        disabled ? { opacity: 0.5 } : null,
      ]}
    >
      <RNText style={sandButtonLabel}>{label}</RNText>
    </Pressable>
  );
}

const DATE_RE =/^\d{4}-\d{2}-\d{2}$/;

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
        {onBack ? <SandButton label="Back" onPress={onBack} /> : null}
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
      setStatus(`Close failed: ${errorText(e)}`);
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
      setStatus(`Export failed: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Text>Weekly payroll run</Text>
      <TextField
        label="Week start (YYYY-MM-DD)"
        value={weekStart}
        onChangeText={setWeekStart}
        placeholder="2026-10-05"
        error={weekStart && !validDate ? 'Use YYYY-MM-DD' : undefined}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {onBack ? <SandButton label="Back" onPress={onBack} /> : null}
        <SandButton
          label="Close run"
          onPress={onClose}
          disabled={busy || !validDate || !closeRun}
        />
        {FORMATS.map((f) => (
          <SandButton
            key={f.key}
            label={f.label}
            selected={format === f.key}
            onPress={() => setFormat(f.key)}
          />
        ))}
        <SandButton
          label="Export"
          onPress={onExport}
          disabled={busy || !batchId || !exportRun}
        />
      </View>
      {status ? <Text>{status}</Text> : null}
    </View>
  );
}
