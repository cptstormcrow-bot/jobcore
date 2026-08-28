/**
 * Blackout editor screen — full-screen (not modal) create form for an org
 * admin to block out a per-tech date range, mirrors `EmployeeEditorScreen.tsx`'s
 * `ActionState` discriminated union and save/cancel layout exactly.
 *
 * `TimeOffAdminRepo` (`../data/time-off-repo.ts`) already declares
 * `createBlackout` returning `Promise<TimeOffRequestAdmin>`; this screen
 * consumes that port directly rather than a local extension.
 *
 * The DB call can be legitimately REJECTED (e.g. a conflicting job assignment
 * for that tech in that date range), not just fail on network/validation —
 * that rejection is caught, surfaces via `ActionState`'s `failed` kind with
 * the caught error's message, and the form stays populated so the admin can
 * adjust and retry (no crash-worthy treatment, no form reset).
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, EmptyState, ErrorState, ScreenTitle, Select, TextField, DatePicker, colors, spacing } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import type { TimeOffAdminRepo } from '../data/time-off-repo';
import { getModuleSession } from '../lib/module-session';

export interface BlackoutEditorScreenProps {
  timeOffAdmin?: TimeOffAdminRepo;
  techs?: Profile[];
  onSaved?: () => void;
  onCancel?: () => void;
}

/** Save action state, mirrors `EmployeeEditorScreen.tsx`'s `ActionState`. */
type ActionState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; message: string };

export function BlackoutEditorScreen(props: BlackoutEditorScreenProps) {
  const { timeOffAdmin, techs = [], onSaved, onCancel } = props;

  const [techIdInput, setTechIdInput] = useState<string | null>(null);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');

  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const session = getModuleSession();

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Blackout" message="Sign in to view this organization's techs." />
      </View>
    );
  }

  if (!timeOffAdmin) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Blackout" message="No data source is connected for this module yet." />
      </View>
    );
  }

  const busy = actionState.kind === 'working';

  const techOptions = techs.map((tech) => ({ label: tech.fullName, value: tech.id }));

  async function handleSave(): Promise<void> {
    if (!techIdInput) {
      setValidationMessage('Select a tech.');
      return;
    }
    if (!startDateInput || !endDateInput) {
      setValidationMessage('Select a start and end date.');
      return;
    }
    if (endDateInput < startDateInput) {
      setValidationMessage('End date must be on or after the start date.');
      return;
    }
    setValidationMessage(null);
    setActionState({ kind: 'working' });
    try {
      const trimmedReason = reasonInput.trim();
      await timeOffAdmin!.createBlackout(session!.org.id, techIdInput, {
        startDate: startDateInput,
        endDate: endDateInput,
        reason: trimmedReason ? trimmedReason : null,
      });
      setActionState({ kind: 'done', message: 'Blackout saved.' });
      onSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the blackout.';
      setActionState({ kind: 'failed', message });
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Add Blackout" />
      <View style={styles.content}>
        <Card style={styles.card}>
          <Select
            label="Tech"
            value={techIdInput}
            options={techOptions}
            onChange={setTechIdInput}
            placeholder="Select tech"
            style={styles.field}
          />
          <DatePicker
            label="Start Date"
            value={startDateInput}
            onChange={setStartDateInput}
            style={styles.field}
          />
          <DatePicker
            label="End Date"
            value={endDateInput}
            onChange={setEndDateInput}
            style={styles.field}
          />
          <TextField
            label="Reason"
            value={reasonInput}
            onChangeText={setReasonInput}
            placeholder="Reason (optional)"
            multiline
            style={styles.field}
          />
        </Card>

        {validationMessage ? <ErrorState message={validationMessage} /> : null}

        <Button
          label={busy ? 'Saving...' : 'Save'}
          onPress={() => {
            void handleSave();
          }}
          disabled={busy}
          style={styles.action}
        />
        <Button
          label="Cancel"
          variant="outline"
          onPress={() => onCancel?.()}
          disabled={!onCancel}
          style={styles.action}
        />

        {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
      </View>
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
  card: {
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.sm,
  },
  action: {
    marginBottom: spacing.sm,
  },
});
