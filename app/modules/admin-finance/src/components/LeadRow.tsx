/**
 * Lead inbox row (P3e.4).
 *
 * Shows the three axis fields the master spec calls out for the lead inbox
 * — `source` / `payer` / `attach_timing` (`03-P3-admin-finance.md` lines
 * 48-53) — plus a "needs info" badge when `classifyLead` reports the lead
 * is missing a field required for scheduling. Built only from
 * `@jobcore/ui`'s `ListItem` primitive and its exported design tokens; no
 * raw color/spacing/radius/typography literals.
 *
 * `@jobcore/ui` has no `Badge` primitive, so the badge itself is composed
 * here from a plain `View`/`Text` pair styled purely from tokens
 * (`colors.warning`, `radius.pill`, `spacing`, `typography`) — same
 * composition rule `Button.tsx` and `AdminFinanceRoot.tsx` already follow.
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ListItem, colors, spacing, radius, typography } from '@jobcore/ui';
import type { Lead } from '../domain/lead';
import { classifyLead } from '../domain/lead-readiness';

export interface LeadRowProps {
  lead: Lead;
  onPress?: (lead: Lead) => void;
  style?: StyleProp<ViewStyle>;
}

function axisValue(value: string | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

export function LeadRow({ lead, onPress, style }: LeadRowProps) {
  const status = classifyLead(lead);
  const axisLine = [
    axisValue(lead.source, 'Source unknown'),
    axisValue(lead.payer, 'Payer unknown'),
    axisValue(lead.attachTiming, 'Timing unknown'),
  ].join(' · ');

  return (
    <ListItem
      title={lead.name}
      subtitle={axisLine}
      onPress={onPress ? () => onPress(lead) : undefined}
      style={style}
      right={
        status === 'needs_info' ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>Needs info</Text>
          </View>
        ) : undefined
      }
    />
  );
}

export default LeadRow;

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeLabel: {
    color: colors.white,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
  },
});
