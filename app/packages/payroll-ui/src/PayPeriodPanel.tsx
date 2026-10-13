import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { wageEngine } from '@jobcore/core';
import type {
  PayrollEntryStatus,
  PayrollSelfPort,
  PayrollSettings,
  PayrollTimeEntry,
} from './port';

export interface PayPeriodPanelProps {
  port: PayrollSelfPort;
  userId: string;
}

interface Loaded {
  settings: PayrollSettings;
  entries: PayrollTimeEntry[];
  rates: wageEngine.RateChange[];
  weekStart: wageEngine.IsoDate;
  weekEnd: wageEngine.IsoDate;
}

/** Minutes to H:MM. */
function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

/** Integer cents to "$1,234.56" using integer math only. */
function formatDollars(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}$${grouped}.${frac < 10 ? '0' : ''}${frac}`;
}

/** Roll the week's entries up to one status. */
function weekStatus(entries: PayrollTimeEntry[]): PayrollEntryStatus {
  if (entries.length === 0) return 'draft';
  if (entries.some((e) => e.status === 'rejected')) return 'rejected';
  if (entries.some((e) => e.status === 'draft')) return 'draft';
  if (entries.some((e) => e.status === 'submitted')) return 'submitted';
  return 'approved';
}

const STATUS_COLOR: Record<PayrollEntryStatus, string> = {
  draft: '#6b7280',
  submitted: '#1d4ed8',
  approved: '#15803d',
  rejected: '#b91c1c',
};

export function PayPeriodPanel({ port, userId }: PayPeriodPanelProps) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const settings = await port.getSettings();
        const today = wageEngine.formatIsoDate(new Date().getTime());
        const weekStart = wageEngine.weekStartOf(today, settings.payWeek);
        const weekEnd = wageEngine.weekEndOf(today, settings.payWeek);
        const [entries, rates] = await Promise.all([
          port.listEntries({ from: weekStart, to: weekEnd }),
          port.getRateHistory(userId),
        ]);
        if (cancelled) return;
        setData({ settings, entries, rates, weekStart, weekEnd });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, userId]);

  const calc = useMemo(() => {
    if (!data) return null;
    const live = data.entries.filter((e) => e.status !== 'rejected');
    const worked: wageEngine.WorkedDay[] = live.map((e) => ({
      workDate: e.workDate,
      minutes: e.minutes,
    }));
    try {
      const alloc = wageEngine.allocateWorkweek(worked, data.settings.overtime, data.weekStart);
      let grossCents: number | null = null;
      try {
        grossCents = wageEngine.buildRunLine({
          userId,
          employeeName: '',
          days: alloc.days,
          rateHistory: data.rates,
        }).grossCents;
      } catch {
        grossCents = null;
      }
      return { totals: alloc.totals, grossCents };
    } catch {
      return null;
    }
  }, [data, userId]);

  if (error) return <Text style={{ color: '#b91c1c' }}>{`Could not load pay period: ${error}`}</Text>;
  if (!data) return <ActivityIndicator />;

  const status = weekStatus(data.entries);

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ flex: 1, fontWeight: '600' }}>{`${data.weekStart} to ${data.weekEnd}`}</Text>
        <Text style={{ color: STATUS_COLOR[status], fontWeight: '600' }}>{status}</Text>
      </View>
      {calc === null ? (
        <Text>Hours could not be calculated.</Text>
      ) : (
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Text style={{ flex: 1 }}>Regular</Text>
            <Text>{formatHm(calc.totals.regularMin)}</Text>
          </View>
          <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Text style={{ flex: 1, color: '#b45309' }}>OT</Text>
            <Text>{formatHm(calc.totals.otMin)}</Text>
          </View>
          <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Text style={{ flex: 1, color: '#b91c1c' }}>DT</Text>
            <Text>{formatHm(calc.totals.dtMin)}</Text>
          </View>
          <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Text style={{ flex: 1, fontWeight: '600' }}>Estimated gross</Text>
            <Text style={{ fontWeight: '600' }}>
              {calc.grossCents === null ? 'No rate on file' : formatDollars(calc.grossCents)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
