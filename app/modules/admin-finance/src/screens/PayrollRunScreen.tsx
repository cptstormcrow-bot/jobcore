// JobCore screen #0087 - af-PayrollRun - Payroll Run
/**
 * Payroll run screen — build and close a weekly payroll run, pick an export
 * formatter, and export. Uses the admin members of the payroll port
 * (`closeRun`, `exportRun`); renders a short message when they are absent.
 */

import React, { useEffect, useState } from 'react';
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
  { key: 'iif_journal', label: 'IIF journal' },
  { key: 'iif_timeact', label: 'IIF hours' },
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

interface AvailableRow {
  userId: string;
  name: string;
  approvedMin: number;
  waitingMin: number;
  reimbCents: number;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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
  const [format, setFormat] = useState<PayrollExportFormat>('qbo_journal_csv');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [hours, setHours] = useState<HoursCheckRow[] | null>(null);
  const [available, setAvailable] = useState<AvailableRow[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [runs, setRuns] = useState<Array<{ batchId: string; from: string; to: string; createdAt: string; employees: number }> | null>(null);

  const dateOk = DATE_RE.test(weekStart) && !Number.isNaN(Date.parse(weekStart));
  // What can go into this week's run: approved hours and approved reimbursements per employee.
  const loadAvailable = async () => {
    if (!payroll || !payroll.listTeamEntries || !dateOk) return;
    const range: PayrollDateRange = { from: weekStart as IsoDate, to: addDays(weekStart, 6) as IsoDate };
    try {
      const [weeks, reimbs, covered] = await Promise.all([
        payroll.listTeamEntries(range),
        payroll.listAllReimbursements ? payroll.listAllReimbursements() : Promise.resolve([]),
        payroll.listPaidCoverage ? payroll.listPaidCoverage() : Promise.resolve([]),
      ]);
      const map = new Map<string, AvailableRow>();
      const row = (userId: string, name: string) => {
        let r = map.get(userId);
        if (!r) {
          r = { userId, name, approvedMin: 0, waitingMin: 0, reimbCents: 0 };
          map.set(userId, r);
        }
        return r;
      };
      for (const w of weeks) {
        for (const e of w.entries) {
          if (e.workDate < range.from || e.workDate > range.to || e.status === 'rejected') continue;
          // Already paid in an earlier run: do not show or count it again.
          if (covered.some((c) => c.userId === w.userId && e.workDate >= c.from && e.workDate <= c.to)) continue;
          const r = row(w.userId, w.employeeName);
          if (e.status === 'approved') r.approvedMin += e.minutes;
          else r.waitingMin += e.minutes;
        }
      }
      for (const m of reimbs) {
        if (m.status !== 'approved') continue;
        row(m.userId, m.employeeName).reimbCents += m.amountCents;
      }
      const rows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
      setAvailable(rows);
      setPicked(new Set(rows.filter((r) => r.approvedMin > 0 || r.reimbCents > 0).map((r) => r.userId)));
    } catch (e) {
      setStatus(`Could not list what is available: ${errorText(e)}`);
    }
  };

  // Closed runs, newest first, so an earlier run can be exported again.
  const loadRuns = async () => {
    if (!payroll || !payroll.listRuns) return;
    try {
      setRuns(await payroll.listRuns());
    } catch (e) {
      setStatus(`Could not list past runs: ${errorText(e)}`);
    }
  };

  useEffect(() => {
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAvailable(null);
    setBatchId(null);
    if (dateOk) void loadAvailable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

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
      const res = await closeRun.call(payroll, range, available ? { userIds: [...picked] } : undefined);
      setBatchId(res.batchId);
      setStatus(`Run closed for ${available ? picked.size : 'everyone'} (batch ${res.batchId}).`);
      void loadAvailable();
      void loadRuns();
    } catch (e) {
      setStatus(`Close failed: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onExport = () => (batchId ? onExportRun(batchId) : Promise.resolve());

  // Export any closed run (this visit's or an earlier one) in the selected format.
  const onExportRun = async (id: string) => {
    if (!exportRun) return;
    setBusy(true);
    setStatus('Exporting...');
    try {
      const doc = await exportRun.call(payroll, id, format);
      setStatus(`Exported ${doc.lines.length} line(s) for ${doc.periodStart} to ${doc.periodEnd}. The file was saved or shared for QuickBooks.`);
    } catch (e) {
      setStatus(`Export failed: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Text>Weekly payroll run</Text>
      <TextField inline
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
          disabled={busy || !validDate || !closeRun || (available !== null && picked.size === 0)}
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
      {available ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ fontWeight: '600' }} numberOfLines={1}>Available for this run</Text>
          {available.length === 0 ? (
            <Text>Nothing approved for this week yet</Text>
          ) : (
            available.map((r) => {
              const ready = r.approvedMin > 0 || r.reimbCents > 0;
              const on = picked.has(r.userId);
              return (
                <View key={r.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1}>{r.name || 'Unknown'}</Text>
                    <Text numberOfLines={1}>
                      {`Approved ${formatHm(r.approvedMin)}`}
                      {r.reimbCents > 0 ? ` + ${money(r.reimbCents)} reimb.` : ''}
                      {r.waitingMin > 0 ? ` (${formatHm(r.waitingMin)} not approved)` : ''}
                    </Text>
                  </View>
                  {ready ? (
                    <PayrollButton
                      label={on ? 'In run' : 'Left out'}
                      style={selectedStyle(on)}
                      onPress={() => {
                        const next = new Set(picked);
                        if (on) next.delete(r.userId);
                        else next.add(r.userId);
                        setPicked(next);
                      }}
                    />
                  ) : (
                    <Text numberOfLines={1}>Not ready</Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : null}
      {runs && runs.length > 0 ? (
        <View style={{ marginTop: spacing.md }}>
          <Text style={{ fontWeight: '600' }} numberOfLines={1}>Past runs</Text>
          {runs.map((r) => (
            <View key={r.batchId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1}>{`${r.from} to ${r.to}`}</Text>
                <Text numberOfLines={1}>{`${r.employees} employee(s) - closed ${r.createdAt.slice(0, 10)}`}</Text>
              </View>
              <PayrollButton
                label="Export"
                onPress={() => void onExportRun(r.batchId)}
                disabled={busy || !exportRun}
              />
            </View>
          ))}
        </View>
      ) : null}
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
