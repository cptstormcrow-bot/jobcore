// JobCore screen #0087 - af-PayrollRun - Payroll Run
/**
 * Payroll run screen — build and close a weekly payroll run, pick an export
 * formatter, and export. Uses the admin members of the payroll port
 * (`closeRun`, `exportRun`); renders a short message when they are absent.
 */

import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { EmptyState, PayrollButton, Text, TextField, selectedStyle, useScreenNumber, spacing } from '@jobcore/ui';
import type { PayrollDateRange, PayrollExportFormat } from '@jobcore/payroll-ui';
import { errorText } from '@jobcore/payroll-ui';
import { getModulePorts } from '../lib/module-ports';
import { compareHours } from '../money/hours-check';
import type { HoursCheckRow } from '../money/hours-check';
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

const DATE_RE =/^\d{4}-\d{2}-\d{2}$/;

/** Minutes to H:MM, signed when asked. */
function formatHm(min: number, signed = false): string {
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = min < 0 ? '-' : signed && min > 0 ? '+' : '';
  return `${sign}${h}:${m < 10 ? '0' : ''}${m}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function PayrollRunScreen(props: PayrollRunScreenProps = {}) {
  const { onBack } = props;
  // Run is a Payroll tab, so it claims its own number over the host's #0088.
  useScreenNumber({ subView: 'PayrollRun' });
  const session = useModuleSession();
  const payroll = getModulePorts().payroll;
  const [weekStart, setWeekStart] = useState('');
  const [format, setFormat] = useState<PayrollExportFormat>('generic_csv');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [hours, setHours] = useState<HoursCheckRow[] | null>(null);

  if (!payroll || !session) {
    return (
      <View>
        <EmptyState title="Payroll is not available yet" />
        {onBack ? <PayrollButton label="Back" onPress={onBack} /> : null}
      </View>
    );
  }

  const validDate = DATE_RE.test(weekStart) && !Number.isNaN(Date.parse(weekStart));
  const closeRun = payroll.closeRun;
  const exportRun = payroll.exportRun;
  const canCheckHours = !!payroll.listTeamEntries && !!payroll.listSystemHours;

  // Report only: timesheet hours vs the job clock (job labor + travel). Pays nothing.
  const onCheckHours = async () => {
    if (!canCheckHours || !validDate) return;
    setBusy(true);
    setStatus('Checking hours...');
    try {
      const range: PayrollDateRange = {
        from: weekStart as IsoDate,
        to: addDays(weekStart, 6) as IsoDate,
      };
      const [weeks, system] = await Promise.all([
        payroll.listTeamEntries!.call(payroll, range),
        payroll.listSystemHours!.call(payroll, range),
      ]);
      const names: Record<string, string> = {};
      const entered = weeks.flatMap((w) => {
        names[w.userId] = w.employeeName;
        return w.entries
          .filter((e) => e.status !== 'rejected' && e.workDate >= range.from && e.workDate <= range.to)
          .map((e) => ({ userId: w.userId, name: w.employeeName, minutes: e.minutes }));
      });
      setHours(compareHours(entered, system, names));
      setStatus('');
    } catch (e) {
      setStatus(`Hours check failed: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {onBack ? <PayrollButton label="Back" onPress={onBack} /> : null}
        <PayrollButton
          label="Check hours"
          onPress={onCheckHours}
          disabled={busy || !validDate || !canCheckHours}
        />
        <PayrollButton
          label="Close run"
          onPress={onClose}
          disabled={busy || !validDate || !closeRun}
        />
        {FORMATS.map((f) => (
          <PayrollButton
            key={f.key}
            label={f.label}
            style={selectedStyle(format === f.key)}
            onPress={() => setFormat(f.key)}
          />
        ))}
        <PayrollButton
          label="Export"
          onPress={onExport}
          disabled={busy || !batchId || !exportRun}
        />
      </View>
      {status ? <Text>{status}</Text> : null}
      {hours ? (
        <ScrollView style={{ marginTop: spacing.md }}>
          <Text style={{ fontWeight: '600' }} numberOfLines={1}>Hours check: timesheet vs job clock</Text>
          {hours.length === 0 ? (
            <Text>No hours this week</Text>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
                <Text style={{ flex: 2, fontWeight: '600' }} numberOfLines={1}>Tech</Text>
                <Text style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>Entered</Text>
                <Text style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>System</Text>
                <Text style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>Diff</Text>
              </View>
              {hours.map((r) => (
                <View key={r.userId} style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
                  <Text style={{ flex: 2 }} numberOfLines={1}>{r.name || 'Unknown tech'}</Text>
                  <Text style={{ flex: 1 }} numberOfLines={1}>{formatHm(r.enteredMin)}</Text>
                  <Text style={{ flex: 1 }} numberOfLines={1}>{formatHm(r.systemMin)}</Text>
                  <Text style={{ flex: 1, fontWeight: r.diffMin !== 0 ? '600' : undefined }} numberOfLines={1}>
                    {formatHm(r.diffMin, true)}
                  </Text>
                </View>
              ))}
              <Text numberOfLines={1}>System = job time + travel time from the job clock.</Text>
            </View>
          )}
        </ScrollView>
      ) : null}
    </View>
  );
}
