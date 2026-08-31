/**
 * Admin blackout editor screen — full-screen editor (not a modal), following
 * the `-editor` naming convention used by `EmployeeEditorScreen.tsx` /
 * `PriceSheetEditorScreen.tsx`.
 *
 * Create-only: picks a tech (`Select`), a start/end date range
 * (`DatePicker` x2), and an optional reason (`TextField`, multiline), then
 * calls `TimeOffAdminRepo.createBlackout(organizationId, techId, draft)`.
 *
 * `createBlackout` can be legitimately rejected by the database — the tech
 * already has a conflicting job assignment in that window
 * (`deny_job_assignment_on_time_off`'s mirror-direction check in
 * `decide_time_off_request()`) — not only on network/validation errors. That
 * rejection is caught and surfaced via `ActionState`'s `failed` variant with
 * the thrown message, and the form stays populated so the admin can pick
 * different dates or a different tech.
 *
 * `initialTechId` (Fix 4) lets a caller — the Calendar tab's tech-filtered
 * "Add Blackout" entry point — preselect the tech; the Time Off queue's
 * entry point omits it, leaving the tech picker unset.
 */

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, ErrorState, ScreenTitle, Select, DatePicker, TextField, EmptyState, colors, spacing } from '@jobcore/ui';
import type { Profile } from '@jobcore/core';
import type { TimeOffAdminRepo } from '../data/time-off-repo';
import { getModuleSession } from '../lib/module-session';

export interface BlackoutEditorScreenProps {
  timeOffAdmin?: TimeOffAdminRepo;
  techs?: Profile[];
  onSaved?: () => void;
  onCancel?: () => void;
  /** Preselects the tech picker, e.g. when opened from a tech-filtered Calendar view. */
  initialTechId?: string;
}

/** Save action state. */
type ActionState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; message: string };

export function BlackoutEditorScreen(props: BlackoutEditorScreenProps = {}) {
  const { timeOffAdmin, techs = [], onSaved, onCancel, initialTechId } = props;

  const [techIdInput, setTechIdInput] = useState<string | null>(initialTechId ?? null);
  const [startDateInput, setStartDateInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });

  const session = getModuleSession();

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

  const busy = actionState.kind === 'working';

  function validate(): string | null {
    if (!techIdInput) {
      return 'Select a technician.';
    }
    if (!startDateInput || !endDateInput) {
      return 'Enter both a start date and an end date.';
    }
    if (endDateInput < startDateInput) {
      return 'End date must be on or after the start date.';
    }
    return null;
  }

  async function handleSave(): Promise<void> {
    if (!timeOffAdmin) return;
    const validationError = validate();
    if (validationError) {
      setActionState({ kind: 'failed', message: validationError });
      return;
    }
    setActionState({ kind: 'working' });
    try {
      await timeOffAdmin.createBlackout(session!.org.id, techIdInput!, {
        startDate: startDateInput,
        endDate: endDateInput,
        reason: reasonInput || null,
      });
      setActionState({ kind: 'done', message: 'Blackout added.' });
      onSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not add the blackout.';
      setActionState({ kind: 'failed', message });
    }
  }

  const techOptions = techs.map((tech) => ({ label: tech.fullName, value: tech.id }));

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Add Blackout" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Select
            label="Technician"
            value={techIdInput}
            options={techOptions}
            onChange={setTechIdInput}
            placeholder="Select a technician"
            disabled={busy}
            style={styles.field}
          />
          <DatePicker
            label="Start Date"
            value={startDateInput}
            onChange={setStartDateInput}
            disabled={busy}
            style={styles.field}
          />
          <DatePicker
            label="End Date"
            value={endDateInput}
            onChange={setEndDateInput}
            disabled={busy}
            style={styles.field}
          />
          <TextField
            label="Reason"
            value={reasonInput}
            onChangeText={setReasonInput}
            placeholder="Reason (optional)"
            multiline
            disabled={busy}
            style={styles.field}
          />
        </Card>

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
          disabled={!onCancel || busy}
          style={styles.action}
        />

        {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
      </ScrollView>
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
