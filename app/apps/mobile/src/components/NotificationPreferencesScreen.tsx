/**
 * Notification preferences screen (P7 Slice B).
 *
 * Props-in / callbacks-out: the host app supplies the current
 * `NotificationPreferences` and an `onChange` callback; this component never
 * touches `expo-secure-store` directly (that lives in `../lib/notifications.ts`).
 * One toggle row per `NotificationEventType`. No server-side subscription
 * management here — purely local preference editing.
 */

import React from 'react';
import { View, ScrollView, StyleSheet, Text, Switch } from 'react-native';
import { Card, colors, spacing } from '@jobcore/ui';
import type { NotificationEventType, NotificationPreferences } from '../lib/notifications';

const EVENT_LABELS: Record<NotificationEventType, string> = {
  'job.assigned': 'Job assigned to me',
  'job.reschedule_requested': 'Reschedule requested',
  'job.status_changed': 'Job status changed',
  'payroll.period_closed': 'Payroll period closed',
  'audit.skew_detected': 'Clock-skew detected',
};

const EVENT_ORDER: readonly NotificationEventType[] = [
  'job.assigned',
  'job.reschedule_requested',
  'job.status_changed',
  'payroll.period_closed',
  'audit.skew_detected',
];

export interface NotificationPreferencesScreenProps {
  preferences: NotificationPreferences;
  onChange: (next: NotificationPreferences) => void;
}

export function NotificationPreferencesScreen({ preferences, onChange }: NotificationPreferencesScreenProps) {
  function toggle(eventType: NotificationEventType, value: boolean) {
    onChange({ ...preferences, [eventType]: value });
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          {EVENT_ORDER.map((eventType) => (
            <View key={eventType} style={styles.row}>
              <Text style={styles.label}>{EVENT_LABELS[eventType]}</Text>
              <Switch
                value={preferences[eventType]}
                onValueChange={(value) => toggle(eventType, value)}
              />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

export default NotificationPreferencesScreen;

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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
});
