// JobCore screen #0081 - blackout-range-modal - blackout-range-modal
/**
 * BlackoutRangeModal — schedule admin time off ("blackout") from the #0056
 * calendar screen. Tapping a day opens this modal seeded with that day; the
 * admin picks a technician, adjusts the range and optional reason, then saves.
 * Persistence is the caller's job (`onSave`).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { PayrollButton, DateRangeCalendar, TechSelect, TextField, colors } from '@jobcore/ui';
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
    setTechId(initialTechId ?? '');
  }, [visible, day, initialTechId]);

  const markedRanges = useMemo(
    () =>
      existingRows
        .filter((r) => r.techId === techId && (r.status === 'pending' || r.status === 'approved'))
        .map((r) => ({ id: r.id, startDate: r.startDate, endDate: r.endDate })),
    [existingRows, techId],
  );

  const techOptions = techs.map((tech) => ({ label: tech.fullName, value: tech.id }));
  const canSave = !busy && techId !== '' && startDate !== '' && endDate !== '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
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
              <TextField
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheetWrap: { width: '100%', maxHeight: '90%' },
  sheet: { width: '100%', flexShrink: 1, backgroundColor: colors.white, borderRadius: 8, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  field: { marginBottom: 12 },
  error: { color: colors.danger, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1 },
});
