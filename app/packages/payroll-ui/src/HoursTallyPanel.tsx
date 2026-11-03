import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { wageEngine } from '@jobcore/core';
import { StepperPicker, colors, spacing, typography } from '@jobcore/ui';
import type { PayrollSelfPort, PayrollSettings, PayrollTimeEntry } from './port';
import { errorText } from './errorText';

export interface HoursTallyPanelProps {
  port: PayrollSelfPort;
  userId: string;
  /** Bump to force the tally to reload. */
  refreshKey?: number;
  /** Range to tally; chosen by the parent. Defaults to 'week'. */
  range?: HoursRange;
}

export type HoursRange = 'day' | 'week' | 'month' | 'year';

const HISTORY_DAYS = 400;

interface TallyRow {
  key: string;
  regularMin: number;
  otMin: number;
  dtMin: number;
  totalMin: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Minutes to H:MM. */
function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

/** 'YYYY-MM-DD' to 'Oct 12'. */
function shortDate(d: string): string {
  return `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
}

/** A date inside the period `offset` steps from today's (0 = current, -1 = previous). */
function periodRef(today: string, range: HoursRange, offset: number): string {
  if (range === 'day') return wageEngine.addDays(today, offset);
  if (range === 'week') return wageEngine.addDays(today, 7 * offset);
  const y = Number(today.slice(0, 4));
  if (range === 'year') return `${y + offset}-01-01`;
  const m = Number(today.slice(5, 7)) - 1 + offset;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${mm < 9 ? '0' : ''}${mm + 1}-01`;
}

/** Stepper label for the period that holds `ref`, matching the Pay Period style. */
function periodLabel(ref: string, range: HoursRange, payWeek: PayrollSettings['payWeek']): string {
  if (range === 'year') return ref.slice(0, 4);
  if (range === 'month') return `${MONTHS[Number(ref.slice(5, 7)) - 1]} ${ref.slice(0, 4)}`;
  if (range === 'day') return `${shortDate(ref)}, ${ref.slice(0, 4)}`;
  const start = wageEngine.weekStartOf(ref, payWeek);
  const end = wageEngine.addDays(start, 6);
  return `${shortDate(start)} - ${shortDate(end)}, ${end.slice(0, 4)}`;
}

export function HoursTallyPanel({ port, userId, refreshKey, range = 'week' }: HoursTallyPanelProps) {
  const tab: wageEngine.RollupGranularity = range;
  const [entries, setEntries] = useState<PayrollTimeEntry[] | null>(null);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // A new range starts back on the current period.
  useEffect(() => setOffset(0), [range]);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setError(null);
    (async () => {
      try {
        const s = await port.getSettings();
        const today = wageEngine.formatIsoDate(new Date().getTime());
        // Start on a whole pay week so weekly OT is allocated correctly.
        const from = wageEngine.weekStartOf(wageEngine.addDays(today, -HISTORY_DAYS), s.payWeek);
        const list = await port.listEntries({ from, to: today });
        if (cancelled) return;
        setSettings(s);
        setEntries(list);
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, userId, refreshKey]);

  const { row, label } = useMemo(() => {
    if (!entries || !settings) return { row: null as TallyRow | null, label: '' };
    const { overtime, payWeek } = settings;
    const ref = periodRef(wageEngine.formatIsoDate(new Date().getTime()), range, offset);
    const text = periodLabel(ref, range, payWeek);
    // Submitted hours only: drafts and rejected entries do not count.
    const counted = entries.filter((e) => e.status === 'submitted' || e.status === 'approved');
    const days: wageEngine.WorkedDay[] = wageEngine.workedDaysFromEntries(counted);
    try {
      const key = wageEngine.rollupKey(ref, tab, payWeek);
      const found = wageEngine.rollup(days, tab, overtime, payWeek).find((p) => p.key === key);
      return { row: (found ?? null) as TallyRow | null, label: text };
    } catch {
      return { row: null as TallyRow | null, label: text };
    }
  }, [entries, settings, tab, range, offset]);

  const periodName = tab === 'year' ? 'year' : tab === 'month' ? 'month' : tab === 'day' ? 'day' : 'week';
  const stepName = range === 'week' ? 'pay period' : range;

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      {error ? (
        <Text style={{ color: colors.danger }}>{`Couldn't load your hours: ${error}`}</Text>
      ) : entries === null ? (
        <ActivityIndicator />
      ) : (
        <>
          <StepperPicker
            value={label}
            prevLabel={`Previous ${stepName}`}
            nextLabel={`Next ${stepName}`}
            onPrev={() => setOffset((o) => o - 1)}
            onNext={() => setOffset((o) => Math.min(0, o + 1))}
            nextDisabled={offset === 0}
          />
          <Text
            style={{ fontSize: typography.size.h4, fontWeight: '700', paddingVertical: spacing.sm }}
            numberOfLines={1}
          >
            {`${offset === 0 ? `This ${periodName}` : 'Total'}: ${formatHm(row ? row.totalMin : 0)}`}
          </Text>
          {row === null ? (
            <Text>No submitted hours recorded.</Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
                <Text style={{ flex: 1 }} numberOfLines={1}>Regular</Text>
                <Text style={{ fontWeight: '700' }}>{formatHm(row.regularMin)}</Text>
              </View>
              {row.otMin > 0 ? (
                <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
                  <Text style={{ flex: 1, color: '#b45309' }} numberOfLines={1}>Overtime</Text>
                  <Text style={{ fontWeight: '700', color: '#b45309' }}>{formatHm(row.otMin)}</Text>
                </View>
              ) : null}
              {row.dtMin > 0 ? (
                <View style={{ flexDirection: 'row', paddingVertical: spacing.xs }}>
                  <Text style={{ flex: 1, color: colors.danger }} numberOfLines={1}>Double time</Text>
                  <Text style={{ fontWeight: '700', color: colors.danger }}>{formatHm(row.dtMin)}</Text>
                </View>
              ) : null}
            </>
          )}
        </>
      )}
    </View>
  );
}
