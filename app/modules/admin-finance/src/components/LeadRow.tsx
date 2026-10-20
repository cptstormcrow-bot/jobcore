/**
 * Lead inbox row (P3e.4).
 *
 * Shows the three axis fields the master spec calls out for the lead inbox
 * — `source` / `payer` / `attach_timing` (`03-P3-admin-finance.md` lines
 * 48-53). Built only from
 * `@jobcore/ui`'s `ListItem` primitive and its exported design tokens; no
 * raw color/spacing/radius/typography literals.
 *
 * Any extra elements are composed here from plain `View`/`Text` pairs
 * styled purely from tokens — same composition rule `Button.tsx` and
 * `AdminFinanceRoot.tsx` already follow.
 */

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { ListItem } from '@jobcore/ui';
import type { Lead } from '../domain/lead';

export interface LeadRowProps {
  lead: Lead;
  onPress?: (lead: Lead) => void;
  style?: StyleProp<ViewStyle>;
}

function axisValue(value: string | null, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

export function LeadRow({ lead, onPress, style }: LeadRowProps) {
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
      footer={axisValue(lead.phone, 'No phone')}
    />
  );
}

export default LeadRow;
