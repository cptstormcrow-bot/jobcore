import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { wageEngine } from '@jobcore/core';
import { StepperPicker, colors, spacing } from '@jobcore/ui';
import type {
  PayrollEntryStatus,
  PayrollJobPayLine,
  PayrollSelfPort,
  PayrollSettings,
  PayrollTimeEntry,
} from './port';
import { errorText } from './errorText';

export interface PayPeriodPanelProps {
  port: PayrollSelfPort;
  userId: string;
  /** Parent bumps this to force a reload. */
  refreshKey?: number;
}

interface Loaded {
  settings: PayrollSettings;
  entries: PayrollTimeEntry[];
  rates: wageEngine.RateChange[];
  jobPay: PayrollJobPayLine[];
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

const JOB_PAY_LABELS: Record<string, string> = {
  hourly: 'Hourly',
  travel: 'Travel',
  prem_bonus: 'Prem bonus',
  commission: 'Commission',
  dev_flat: 'Flat rate',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DD' to 'Oct 12'. */
function shortDate(d: string): string {
  return `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
}

/** 'Oct 12 - Oct 18, 2026'. */
function formatRange(start: string, end: string): string {
  return `${shortDate(start)} - ${shortDate(end)}, ${end.slice(0, 4)}`;
}

const STATUS_COLOR: Record<PayrollEntryStatus, string> = {
  draft: colors.textMuted,
  submitted: colors.selected,
  approved: colors.success,
  rejected: colors.danger,
};

export function PayPeriodPanel({ port, userId, refreshKey }: PayPeriodPanelProps) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 0 = the pay week containing today, negative = older. Lives outside the reload so stepping never resets it.
  const [periodOffset, setPeriodOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const settings = await port.getSettings();
        const today = wageEngine.formatIsoDate(new Date().getTime());
        const ref = wageEngine.addDays(today, 7 * periodOffset);
        const weekStart = wageEngine.weekStartOf(ref, settings.payWeek);
        const weekEnd = wageEngine.weekEndOf(ref, settings.payWeek);
        const [entries, rates, jobPay] = await Promise.all([
          port.listEntries({ from: weekStart, to: weekEnd }),
          port.getRateHistory(userId),
          port.listMyJobPay ? port.listMyJobPay({ from: weekStart, to: weekEnd }) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setData({ settings, entries, rates, jobPay, weekStart, weekEnd });
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, userId, refreshKey, periodOffset]);

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

  const status = data ? weekStatus(data.entries) : 'draft';
  const rangeLabel = data ? formatRange(data.weekStart, data.weekEnd) : 'Loading...';

  const picker = (
    <StepperPicker
      value={rangeLabel}
      prevLabel="Previous pay period"
      nextLabel="Next pay period"
      onPrev={() => setPeriodOffset((o) => o - 1)}
      onNext={() => setPeriodOffset((o) => Math.min(0, o + 1))}
      nextDisabled={periodOffset === 0}
    />
  );

  let body;
  if (error) {
    body = <Text style={{ color: colors.danger }}>{`Couldn't load your pay period: ${error}`}</Text>;
  } else if (!data) {
    body = <ActivityIndicator />;
  } else if (data.entries.length === 0 && data.jobPay.length === 0) {
    body = <Text style={{ textAlign: 'center' }}>No payroll for this week</Text>;
  } else {
    body = (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ flex: 1, fontWeight: '600' }}>{`Your week: ${rangeLabel}`}</Text>
          <Text style={{ color: STATUS_COLOR[status], fontWeight: '600' }}>{status}</Text>
        </View>
        {calc === null ? (
          <Text>Your hours could not be calculated.</Text>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
              <Text style={{ flex: 1 }}>Your regular hours</Text>
              <Text>{formatHm(calc.totals.regularMin)}</Text>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
              <Text style={{ flex: 1, color: '#b45309' }}>Your OT</Text>
              <Text>{formatHm(calc.totals.otMin)}</Text>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
              <Text style={{ flex: 1, color: colors.danger }}>Your DT</Text>
              <Text>{formatHm(calc.totals.dtMin)}</Text>
            </View>
            <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
              <Text style={{ flex: 1, fontWeight: '600' }}>You earned (estimated)</Text>
              <Text style={{ fontWeight: '600' }}>
                {calc.grossCents === null ? 'No rate on file' : formatDollars(calc.grossCents)}
              </Text>
            </View>
          </View>
        )}
        {data.jobPay.length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ fontWeight: '600', marginBottom: spacing.xs }}>Job pay from close-outs</Text>
            {data.jobPay.map((l) => (
              <View key={l.id} style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {`${l.jobNumber != null ? `Job #${l.jobNumber}` : 'Job'} ${JOB_PAY_LABELS[l.basis] ?? l.basis}`}
                </Text>
                <Text style={{ color: l.status === 'included' ? colors.success : colors.textMuted, marginRight: spacing.sm }}>
                  {l.status === 'included' ? 'paid' : 'next run'}
                </Text>
                <Text>{formatDollars(l.amountCents)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
              <Text style={{ flex: 1, fontWeight: '600' }}>Job pay total</Text>
              <Text style={{ fontWeight: '600' }}>
                {formatDollars(data.jobPay.reduce((sum, l) => sum + l.amountCents, 0))}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      {picker}
      {body}
    </View>
  );
}
