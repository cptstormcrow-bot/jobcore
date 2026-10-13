import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { wageEngine } from '@jobcore/core';
import type { PayrollSelfPort, PayrollSettings, PayrollTimeEntry } from './port';

export interface HoursTallyPanelProps {
  port: PayrollSelfPort;
  userId: string;
}

const TABS: { id: wageEngine.RollupGranularity; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

const HISTORY_DAYS = 400;

/** Minutes to H:MM. */
function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m < 10 ? '0' : ''}${m}`;
}

export function HoursTallyPanel({ port, userId }: HoursTallyPanelProps) {
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
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, userId]);

  const rows = useMemo(() => {
    if (!entries || !settings) return [];
    const byDate = new Map<wageEngine.IsoDate, number>();
    for (const e of entries) {
      if (e.status === 'rejected') continue;
      byDate.set(e.workDate, (byDate.get(e.workDate) ?? 0) + e.minutes);
    }
    const days: wageEngine.WorkedDay[] = [...byDate].map(([workDate, minutes]) => ({ workDate, minutes }));
    try {
      return wageEngine.rollup(days, tab, settings.overtime, settings.payWeek).reverse();
    } catch {
      return [];
    }
  }, [entries, settings, tab]);

  return (
    <View>
      <View style={{ flexDirection: 'row', marginBottom: 8 }}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === t.id }}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              marginRight: 6,
              borderRadius: 999,
              backgroundColor: tab === t.id ? '#1d4ed8' : '#e5e7eb',
            }}
          >
            <Text style={{ color: tab === t.id ? '#fff' : '#111827' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? (
        <Text style={{ color: '#b91c1c' }}>{`Could not load hours: ${error}`}</Text>
      ) : entries === null ? (
        <ActivityIndicator />
      ) : rows.length === 0 ? (
        <Text>No hours recorded.</Text>
      ) : (
        rows.map((r) => (
          <View
            key={r.key}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
          >
            <Text style={{ flex: 1 }}>{r.key}</Text>
            {r.otMin > 0 ? (
              <Text style={{ marginRight: 8, color: '#b45309' }}>{`OT ${formatHm(r.otMin)}`}</Text>
            ) : null}
            {r.dtMin > 0 ? (
              <Text style={{ marginRight: 8, color: '#b91c1c' }}>{`DT ${formatHm(r.dtMin)}`}</Text>
            ) : null}
            <Text style={{ fontWeight: '600' }}>{formatHm(r.totalMin)}</Text>
          </View>
        ))
      )}
    </View>
  );
}
