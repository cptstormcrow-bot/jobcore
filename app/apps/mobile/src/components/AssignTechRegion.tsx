import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, TechSelect, colors, spacing, typography, Text } from '@jobcore/ui';

const UNASSIGNED_VALUE = '__unassigned__';

export interface AssignTechRegionProps {
  techs: { id: string; name: string }[];
  currentTechId?: string | null;
  busy?: boolean;
  error?: string | null;
  onAssign: (techId: string) => void;
  /** When supplied, an "Unassigned" choice is listed first so an admin can reset the job. */
  onUnassign?: () => void;
  label?: string;
  indicator?: string | null;
}

export function AssignTechRegion({
  techs,
  currentTechId = null,
  busy = false,
  error = null,
  onAssign,
  onUnassign,
  label = 'Assign Technician',
  indicator = null,
}: AssignTechRegionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(currentTechId);
  const techOptions = techs.map((tech) => ({ label: tech.name, value: tech.id }));
  const options = onUnassign ? [{ label: 'Unassigned', value: UNASSIGNED_VALUE }, ...techOptions] : techOptions;

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.label}>
        {`Tech: ${techs.find((t) => t.id === currentTechId)?.name ?? (currentTechId ? 'Assigned' : 'Unassigned')}`}
      </Text>
      {indicator ? <Text style={styles.indicator}>{indicator}</Text> : null}
      {techs.length === 0 && (
        <Text style={styles.hint}>No active technicians in this organization</Text>
      )}
      <TechSelect
        value={selectedId}
        options={options}
        onChange={setSelectedId}
        disabled={busy}
        placeholder="Select a technician"
      />
      <Button
        label="Assign"
        onPress={() => (selectedId === UNASSIGNED_VALUE ? onUnassign?.() : selectedId && onAssign(selectedId))}
        disabled={!selectedId || busy}
        style={styles.button}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  label: {
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.detail,
    color: colors.textMutedDark,
    marginBottom: spacing.xs,
  },
  hint: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  indicator: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.small,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  button: { marginTop: spacing.sm },
  error: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.small,
    color: colors.danger,
    marginTop: spacing.sm,
  },
});
