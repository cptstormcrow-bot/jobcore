// JobCore screen #0056 - af-blackout-editor - Add Blackout
/**
 * Admin blackout editor screen — full-screen editor (not a modal), following
 * the `-editor` naming convention used by `EmployeeEditorScreen.tsx` /
 * `PriceSheetEditorScreen.tsx`.
 *
 * Month/Week calendar plus a time-off list: tapping a day opens
 * `BlackoutRangeModal`, whose save calls
 * `TimeOffAdminRepo.createBlackout(organizationId, techId, draft)`; the list
 * below can cancel existing time off via `TimeOffAdminRepo.cancel`.
 *
 * `createBlackout` can be legitimately rejected by the database — the tech
 * already has a conflicting job assignment in that window
 * (`deny_job_assignment_on_time_off`'s mirror-direction check in
 * `decide_time_off_request()`) — not only on network/validation errors. That
 * rejection is caught and shown inline in the modal, which stays open so the
 * admin can pick different dates or a different tech.
 *
 * `initialTechId` (Fix 4) lets a caller — the Calendar tab's tech-filtered
 * "Add Blackout" entry point — preselect the tech; the Time Off queue's
 * entry point omits it, leaving the filter on All Techs.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { addDays, addMonths, format } from 'date-fns';
import { PayrollButton, ErrorState, ScreenTitle, TechSelect, EmptyState, CalendarHeader, MonthView, WeekView, Text, colors, spacing, useScreenNumber } from '@jobcore/ui';
import type { TimeOffEvent } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import type { TimeOffAdminRepo, TimeOffRequestAdmin } from '../data/time-off-repo';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { BlackoutRangeModal } from './BlackoutRangeModal';
import { BlackoutTimeOffList } from './BlackoutTimeOffList';
import { expandBlackoutsToEvents, filterTimeOffByTech, readCalMode, writeCalMode } from './blackout-calendar-logic';
import type { CalMode } from './blackout-calendar-logic';

export interface BlackoutEditorScreenProps {
  timeOffAdmin?: TimeOffAdminRepo;
  techs?: Profile[];
  onSaved?: () => void;
  onCancel?: () => void;
  /** Preselects the tech picker, e.g. when opened from a tech-filtered Calendar view. */
  initialTechId?: string;
  /** Fires after any create or cancel so the caller can refresh its own lists. */
  onChanged?: () => void;
}

/** localPrefs port, or undefined when the host has not injected ports (mode stays Month). */
function safeLocalPrefs() {
  try {
    return getModulePorts().localPrefs;
  } catch {
    return undefined;
  }
}

export function BlackoutEditorScreen(props: BlackoutEditorScreenProps = {}) {
  const { timeOffAdmin, techs = [], onSaved, onCancel, initialTechId, onChanged } = props;
  useScreenNumber({ subView: 'blackout-editor' });

  const [techFilter, setTechFilter] = useState<string>(initialTechId ?? 'all');
  const [mode, setMode] = useState<CalMode>('month');
  const [anchorDay, setAnchorDay] = useState<Date>(new Date());
  const [rows, setRows] = useState<TimeOffRequestAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalDay, setModalDay] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [savedThisVisit, setSavedThisVisit] = useState(false);

  const session = getModuleSession();
  const organizationId = session?.org.id ?? null;

  // Restore the persisted Month/Week choice; a missing port leaves Month.
  useEffect(() => {
    let cancelled = false;
    void readCalMode(safeLocalPrefs()).then((m) => {
      if (!cancelled) setMode(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async (): Promise<TimeOffRequestAdmin[] | null> => {
    if (!timeOffAdmin || !organizationId) return null;
    try {
      const list = await timeOffAdmin.listForOrganization(organizationId);
      setRows(list);
      setLoadError(null);
      return list;
    } catch (error: unknown) {
      setLoadError(error instanceof Error ? error.message : 'Could not load time off.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [timeOffAdmin, organizationId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleRows = useMemo(() => filterTimeOffByTech(rows, techFilter), [rows, techFilter]);
  const events = useMemo(() => expandBlackoutsToEvents(visibleRows), [visibleRows]);
  const techNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const tech of techs) map[tech.id] = tech.fullName;
    // Orphaned ids (tech no longer in the roster) still get a readable label.
    for (const row of rows) if (!(row.techId in map)) map[row.techId] = 'Unknown tech';
    return map;
  }, [techs, rows]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Add Blackout" message="Sign in to add a blackout for this organization." />
      </View>
    );
  }

  if (!timeOffAdmin) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Add Blackout" message="No data source is connected for this module yet." />
      </View>
    );
  }

  function changeMode(next: CalMode): void {
    setMode(next);
    void writeCalMode(safeLocalPrefs(), next);
  }

  function step(direction: 1 | -1): void {
    setAnchorDay((d) => (mode === 'month' ? addMonths(d, direction) : addDays(d, 7 * direction)));
  }

  function onPickEvent(e: TimeOffEvent): void {
    const hit = rows.find((r) => e.id.startsWith(r.id));
    if (hit) setHighlightId(hit.id);
  }

  function openModal(day: Date): void {
    setSaveError(null);
    setModalDay(day);
  }

  async function handleSave(
    techId: string,
    draft: { startDate: string; endDate: string; reason: string },
  ): Promise<void> {
    if (!timeOffAdmin) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await timeOffAdmin.createBlackout(session!.org.id, techId, {
        startDate: draft.startDate,
        endDate: draft.endDate,
        reason: draft.reason || null,
      });
      setModalDay(null);
      setSavedThisVisit(true);
      setHighlightId(created.id);
      onChanged?.();
      const list = await reload();
      // Reload may lag the write; keep the new row visible regardless.
      if (list && !list.some((r) => r.id === created.id)) {
        setRows((prev) => (prev.some((r) => r.id === created.id) ? prev : [...prev, created]));
      }
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Could not add the blackout.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelRow(requestId: string): Promise<void> {
    if (!timeOffAdmin) return;
    setCancellingId(requestId);
    setCancelError(null);
    try {
      await timeOffAdmin.cancel(requestId);
      onChanged?.();
      await reload();
    } catch (error: unknown) {
      setCancelError(error instanceof Error ? error.message : 'Could not cancel the time off.');
    } finally {
      setCancellingId(null);
    }
  }

  const selectOptions = [{ label: 'All Techs', value: 'all' }, ...techs.map((t) => ({ label: t.fullName, value: t.id }))];

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Add Blackout" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule time off</Text>
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
            <WeekView jobs={[]} anchorDay={anchorDay} timeOffEvents={events} onSelectTimeOff={onPickEvent} onSelectDay={openModal} />
          ) : (
            <MonthView variant="list" jobs={[]} anchorDay={anchorDay} timeOffEvents={events} onSelectTimeOff={onPickEvent} onSelectDay={openModal} />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time off</Text>
          {loading ? (
            <Text>Loading...</Text>
          ) : loadError ? (
            <ErrorState message={loadError} />
          ) : visibleRows.length === 0 ? (
            <Text>No time off scheduled.</Text>
          ) : (
            <BlackoutTimeOffList
              rows={visibleRows}
              techNameById={techNameById}
              cancellingId={cancellingId}
              highlightId={highlightId}
              onCancel={(id) => {
                void handleCancelRow(id);
              }}
            />
          )}
          {cancelError ? <ErrorState message={cancelError} /> : null}
        </View>

        <PayrollButton
          label="Done"
          onPress={() => (savedThisVisit ? onSaved?.() : onCancel?.())}
          style={styles.action}
        />
      </ScrollView>

      <BlackoutRangeModal
        visible={modalDay !== null}
        day={modalDay}
        techs={techs}
        initialTechId={techFilter === 'all' ? null : techFilter}
        existingRows={rows}
        busy={saving}
        error={saveError}
        onSave={(techId, draft) => {
          void handleSave(techId, draft);
        }}
        onCancel={() => setModalDay(null)}
      />
    </View>
  );
}

export default BlackoutEditorScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  action: {
    marginBottom: spacing.sm,
  },
});
