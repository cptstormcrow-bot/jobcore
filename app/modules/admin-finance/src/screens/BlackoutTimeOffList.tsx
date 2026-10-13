// JobCore screen #0082 - blackout-time-off-list - blackout-time-off-list
// JobCore #0056 - Add Blackout time-off list (presentational)
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, ListItem, colors, spacing } from '@jobcore/ui';
import type { TimeOffRequestAdmin } from '../data/time-off-repo';

export type BlackoutTimeOffListProps = {
  rows: TimeOffRequestAdmin[];
  techNameById: Record<string, string>;
  cancellingId?: string | null;
  highlightId?: string | null;
  onCancel: (requestId: string) => void;
};

export function BlackoutTimeOffList({ rows, techNameById, cancellingId, highlightId, onCancel }: BlackoutTimeOffListProps) {
  return (
    <Card style={styles.card}>
      {rows.map((row) => {
        const range = row.startDate === row.endDate ? row.startDate : `${row.startDate} - ${row.endDate}`;
        const subtitle = row.reason ? `${range} · ${row.status} · ${row.reason}` : `${range} · ${row.status}`;
        const cancellable = row.status === 'pending' || row.status === 'approved';
        const cancelling = cancellingId === row.id;
        return (
          <View key={row.id} style={[styles.row, highlightId === row.id ? styles.highlight : null]}>
            <ListItem title={techNameById[row.techId] ?? 'Unknown tech'} subtitle={subtitle} />
            {cancellable ? (
              <Button
                label={cancelling ? 'Cancelling...' : 'Cancel'}
                onPress={() => onCancel(row.id)}
                disabled={cancelling}
                style={styles.action}
              />
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  row: { marginBottom: spacing.md, borderWidth: 2, borderColor: 'transparent' },
  highlight: { borderColor: colors.primary },
  action: { marginBottom: spacing.sm },
});
