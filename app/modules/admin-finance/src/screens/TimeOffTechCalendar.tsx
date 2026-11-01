// JobCore screen #0083 - time-off-tech-calendar - per-tech blackout calendar (display-only)
/**
 * The calendar is display-only (no onSelectDay / onSelectTimeOff), because "Add Blackout"
 * already routes to #0056. It shows pending and approved rows only (expandBlackoutsToEvents).
 * Month is the default; Week is restored from device-local prefs and shares
 * BLACKOUT_WEEK_VIEW_KEY with #0056.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { addDays, addMonths, format } from 'date-fns';
import { TechSelect, CalendarHeader, MonthView, WeekView, Text, spacing, typography } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';
import { getModulePorts } from '../lib/module-ports';
import { expandBlackoutsToEvents, filterTimeOffByTech, readCalMode, writeCalMode } from './blackout-calendar-logic';
import type { CalMode } from './blackout-calendar-logic';

export interface TimeOffTechCalendarProps {
  rows: TimeOffRequestAdmin[];
  techs: Profile[];
}

/** localPrefs port, or undefined when the host has not injected ports (mode stays Month). */
function safeLocalPrefs() {
  try {
    return getModulePorts().localPrefs;
  } catch {
    return undefined;
  }
}

export function TimeOffTechCalendar({ rows, techs }: TimeOffTechCalendarProps) {
  const [techFilter, setTechFilter] = useState<string>('all');
  const [mode, setMode] = useState<CalMode>('month');
  const [anchorDay, setAnchorDay] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    void readCalMode(safeLocalPrefs()).then((m) => {
      if (!cancelled) setMode(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleRows = useMemo(() => filterTimeOffByTech(rows, techFilter), [rows, techFilter]);
  const techNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tech of techs) map[tech.id] = tech.fullName;
    // Orphaned ids (tech no longer in the roster) still get a readable label.
    for (const row of rows) if (!(row.techId in map)) map[row.techId] = 'Unknown tech';
    return map;
  }, [techs, rows]);
  const events = useMemo(() => expandBlackoutsToEvents(visibleRows, techNameById), [visibleRows, techNameById]);

  const changeMode = (next: CalMode) => {
    setMode(next);
    void writeCalMode(safeLocalPrefs(), next);
  };
  const step = (direction: 1 | -1) =>
    setAnchorDay((d) => (mode === 'month' ? addMonths(d, direction) : addDays(d, 7 * direction)));

  const selectOptions = [{ label: 'All Techs', value: 'all' }, ...techs.map((t) => ({ label: t.fullName, value: t.id }))];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Blackout calendar</Text>
      <TechSelect value={techFilter} options={selectOptions} onChange={setTechFilter} style={styles.field} />
      <CalendarHeader
        mode={mode}
        onModeChange={(m) => changeMode(m === 'day' ? 'week' : m)}
        label={format(anchorDay, mode === 'month' ? 'MMMM yyyy' : "'Week of' MMM d")}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToday={() => setAnchorDay(new Date())}
      />
      {mode === 'week' ? (
        <WeekView jobs={[]} anchorDay={anchorDay} timeOffEvents={events} />
      ) : (
        <MonthView variant="list" jobs={[]} anchorDay={anchorDay} timeOffEvents={events} />
      )}
    </View>
  );
}

export default TimeOffTechCalendar;

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.size.body, fontWeight: '600', marginBottom: spacing.sm },
  field: { marginBottom: spacing.sm },
});
