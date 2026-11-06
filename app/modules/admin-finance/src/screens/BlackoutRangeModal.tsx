// JobCore screen #0081 - blackout-range-modal - blackout-range-modal
/**
 * BlackoutRangeModal — schedule admin time off ("time-off") from the #0056
 * calendar screen. Tapping a day opens this modal seeded with that day; the
 * admin picks a technician, adjusts the range and optional reason, then saves.
 * Persistence is the caller's job (`onSave`).
 *
 * Drawn as an in-tree overlay, not an RN Modal: #0056 itself opens inside the
 * Calendar's Add Time-off Modal, and a Modal inside a Modal (plus the tech
 * picker's own Modal) does not take taps reliably on Android. Back closes it.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, BackHandler } from 'react-native';
import { PayrollButton, DateRangeCalendar, TechSelect, TextField, colors, spacing, radius, typography } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';

export type BlackoutRangeModalProps = {
  visible: boolean;
  day: Date | null;
  techs: Profile[];
  initialTechId: string | null;
  existingRows: TimeOffRequestAdmin[];
  busy: boolean;
  error: string | null;
  onSave: (techId: string, draft: { startDate: string; endDate: string; reason: string }) => void;
  onCancel: () => void;
};

function toIso(day: Date): string {
  const m = String(day.getMonth() + 1).padStart(2, '0');
  const d = String(day.getDate()).padStart(2, '0');
  return `${day.getFullYear()}-${m}-${d}`;
}

export function BlackoutRangeModal(props: BlackoutRangeModalProps): React.ReactElement {
  const { visible, day, techs, initialTechId, existingRows, busy, error, onSave, onCancel } = props;
  const [techId, setTechId] = useState<string>(initialTechId ?? '');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    if (!visible) return;
    const iso = day !== null ? toIso(day) : '';
    setStartDate(iso);
    setEndDate(iso);
    setReason('');
    // A lone tech needs no picking.
    setTechId(initialTechId ?? (techs.length === 1 ? (techs[0]?.id ?? '') : ''));
  }, [visible, day, initialTechId, techs]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => sub.remove();
  }, [visible, onCancel]);

  const markedRanges = useMemo(
    () =>
      existingRows
        .filter((r) => r.techId === techId && (r.status === 'pending' || r.status === 'approved'))
        .map((r) => ({ id: r.id, startDate: r.startDate, endDate: r.endDate })),
    [existingRows, techId],
  );

  const techOptions = techs.map((tech) => ({ label: tech.fullName, value: tech.id }));
  const canSave = !busy && techId !== '' && startDate !== '' && endDate !== '';

  if (!visible) return <></>;

  return (
    <View style={styles.layer}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>Schedule time off</Text>
              <TechSelect
                label="Technician"
                value={techId}
                options={techOptions}
                onChange={setTechId}
                placeholder="Select a technician"
                disabled={busy}
                style={styles.field}
              />
              <DateRangeCalendar
                startDate={startDate}
                endDate={endDate}
                onChangeStartDate={setStartDate}
                onChangeEndDate={setEndDate}
                disabled={busy}
                markedRanges={markedRanges}
              />
              <TextField inline
                label="Reason (optional)"
                value={reason}
                onChangeText={setReason}
                placeholder="Reason for time off"
                multiline
                disabled={busy}
                style={styles.field}
              />
              {error !== null ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.buttons}>
                <PayrollButton label="Cancel" onPress={onCancel} disabled={busy} />
                <PayrollButton
                  label={busy ? 'Saving…' : 'Save'}
                  disabled={!canSave}
                  onPress={() => onSave(techId, { startDate, endDate, reason })}
                />
              </View>
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 10, elevation: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: spacing.sm },
  sheetWrap: { width: '100%', maxHeight: '90%' },
  sheet: { width: '100%', flexShrink: 1, backgroundColor: colors.white, borderRadius: radius.sm, padding: spacing.lg },
  title: { fontSize: typography.size.h5, fontWeight: '600', marginBottom: spacing.sm },
  field: { marginBottom: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1 },
});
