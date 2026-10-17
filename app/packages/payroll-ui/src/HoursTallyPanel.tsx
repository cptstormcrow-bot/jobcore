import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { wageEngine } from '@jobcore/core';
import { colors } from '@jobcore/ui';
import type { PayrollSelfPort, PayrollSettings, PayrollTimeEntry } from './port';
import { errorText } from './errorText';

export interface HoursTallyPanelProps {
  port: PayrollSelfPort;
  userId: string;
  /** Bump to force the tally to reload. */
  refreshKey?: number;
}

const TABS: { id: wageEngine.RollupGranularity; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const HISTORY_DAYS = 400;

interface TallyItem {
  kind: 'parent' | 'child' | 'total';
  row: { key: string; regularMin: number; otMin: number; dtMin: number; totalMin: number };
}

/** Minutes to H:MM. */
function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

export function HoursTallyPanel({ port, userId, refreshKey }: HoursTallyPanelProps) {
  const [tab, setTab] = useState<wageEngine.RollupGranularity>('day');
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

  const rows = useMemo(() => {
    if (!entries || !settings) return [];
    const days: wageEngine.WorkedDay[] = wageEngine.workedDaysFromEntries(entries);
    try {
      const { overtime, payWeek } = settings;
      const childGran: wageEngine.RollupGranularity | null =
        tab === 'week' ? 'day' : tab === 'month' ? 'week' : tab === 'year' ? 'month' : null;
      const parents = wageEngine.rollup(days, tab, overtime, payWeek);
      const children = childGran ? wageEngine.rollup(days, childGran, overtime, payWeek) : [];
      // A week straddling a month boundary is listed under the month of its start date.
      const parentKeyOf = (childKey: string): string =>
        tab === 'week'
          ? wageEngine.rollupKey(childKey, 'week', payWeek)
          : tab === 'month'
            ? childKey.slice(0, 7)
            : childKey.slice(0, 4);
      const items: TallyItem[] = [];
      for (const p of [...parents].reverse()) {
        items.push({ kind: 'parent', row: p });
        if (!childGran) continue;
        const kids = children.filter((c) => parentKeyOf(c.key) === p.key).reverse();
        for (const c of kids) items.push({ kind: 'child', row: c });
      }
      if (items.length > 0) {
        const total = { key: 'Total', regularMin: 0, otMin: 0, dtMin: 0, totalMin: 0 };
        for (const p of parents) {
          total.regularMin += p.regularMin;
          total.otMin += p.otMin;
          total.dtMin += p.dtMin;
          total.totalMin += p.totalMin;
        }
        items.push({ kind: 'total', row: total });
      }
      return items;
    } catch {
      return [] as TallyItem[];
    }
  }, [entries, settings, tab]);

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t.id }}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              paddingVertical: 6,
              paddingHorizontal: 12,
              marginRight: 6,
              borderRadius: 999,
              backgroundColor: tab === t.id ? colors.sand : colors.sandInactive,
            }}
          >
            <Text style={{ color: colors.text }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <Text style={{ color: '#b91c1c' }}>{`Couldn't load your hours: ${error}`}</Text>
      ) : entries === null ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text>No hours recorded.</Text>
      ) : (
        rows.map(({ kind, row: r }) => (
          <View
            key={`${kind}:${r.key}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 6,
              paddingLeft: kind === 'child' ? 20 : 0,
              opacity: kind === 'child' ? 0.75 : 1,
              ...(kind === 'total' ? { borderTopWidth: 1, borderTopColor: '#9ca3af', marginTop: 4 } : null),
            }}
          >
            <Text style={{ flex: 1, fontWeight: kind === 'child' ? '400' : '700' }}>{r.key}</Text>
            {r.otMin > 0 ? (
              <Text style={{ marginRight: 8, color: '#b45309' }}>{`OT ${formatHm(r.otMin)}`}</Text>
            ) : null}
            {r.dtMin > 0 ? (
              <Text style={{ marginRight: 8, color: '#b91c1c' }}>{`DT ${formatHm(r.dtMin)}`}</Text>
            ) : null}
            <Text style={{ fontWeight: kind === 'child' ? '400' : '700' }}>{formatHm(r.totalMin)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
