import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { wageEngine } from '@jobcore/core';
import { colors, spacing, typography } from '@jobcore/ui';
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

interface TallyItem {
  kind: 'parent';
  row: { key: string; regularMin: number; otMin: number; dtMin: number; totalMin: number };
}

/** Minutes to H:MM. */
function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

export function HoursTallyPanel({ port, userId, refreshKey, range = 'week' }: HoursTallyPanelProps) {
  const tab: wageEngine.RollupGranularity = range;
  const [entries, setEntries] = useState<PayrollTimeEntry[] | null>(null);
  const [settings, setSettings] = useState<PayrollSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const { rows, currentMin } = useMemo(() => {
    if (!entries || !settings) return { rows: [] as TallyItem[], currentMin: 0 };
    // Submitted hours only: drafts and rejected entries do not count.
    const counted = entries.filter((e) => e.status === 'submitted' || e.status === 'approved');
    const days: wageEngine.WorkedDay[] = wageEngine.workedDaysFromEntries(counted);
    try {
      const { overtime, payWeek } = settings;
      const parents = wageEngine.rollup(days, tab, overtime, payWeek);
      const todayKey = wageEngine.rollupKey(wageEngine.formatIsoDate(new Date().getTime()), tab, payWeek);
      const cur = parents.find((p) => p.key === todayKey);
      // Newest first; the current period (if it has hours) is the first row.
      const items: TallyItem[] = [...parents].reverse().map((p) => ({ kind: 'parent' as const, row: p }));
      return { rows: items, currentMin: cur ? cur.totalMin : 0 };
    } catch {
      return { rows: [] as TallyItem[], currentMin: 0 };
    }
  }, [entries, settings, tab]);

  const periodName = tab === 'year' ? 'year' : tab === 'month' ? 'month' : tab === 'day' ? 'day' : 'week';

  return (
    <View style={{ paddingHorizontal: spacing.lg }}>
      {error ? (
        <Text style={{ color: colors.danger }}>{`Couldn't load your hours: ${error}`}</Text>
      ) : entries === null ? (
        <ActivityIndicator />
      ) : (
        <>
          <Text style={{ fontSize: typography.size.h4, fontWeight: '700', paddingVertical: spacing.sm }}>
            {`This ${periodName}: ${formatHm(currentMin)}`}
          </Text>
          {rows.length === 0 ? (
            <Text>No submitted hours recorded.</Text>
          ) : (
            rows.map(({ row: r }) => (
              <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm }}>
                <Text style={{ flex: 1, fontWeight: '700' }}>{r.key}</Text>
                {r.otMin > 0 ? (
                  <Text style={{ marginRight: spacing.sm, color: '#b45309' }}>{`OT ${formatHm(r.otMin)}`}</Text>
                ) : null}
                {r.dtMin > 0 ? (
                  <Text style={{ marginRight: spacing.sm, color: colors.danger }}>{`DT ${formatHm(r.dtMin)}`}</Text>
                ) : null}
                <Text style={{ fontWeight: '700' }}>{formatHm(r.totalMin)}</Text>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}
