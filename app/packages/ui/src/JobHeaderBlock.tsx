// JobHeaderBlock — customer name / ingress code, address, phone, job-number + schedule line,
// with tap-to-copy on the first three lines and a children slot (stage rail) beneath.
// Plain react-native primitives only; clipboard access is injected via onCopy.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { colors, spacing, typography } from './tokens';
import { formatJobNumberLine, formatScheduledLabel } from './job-header-format';

export type JobHeaderBlockProps = {
  customerName: string | null | undefined; address: string | null | undefined;
  phone: string | null | undefined; jobNumber: number | string | null | undefined;
  createdAt: string | Date | null | undefined; scheduledStart: string | Date | null | undefined;
  ingressCode?: string | null; onPressSchedule?: () => void;
  onCopy: (text: string) => void | Promise<void>; children?: React.ReactNode;
};

type CopiedKey = 'ingress' | 'address' | 'phone' | null;

const COPIED_MS = 1500;

export function JobHeaderBlock({
  customerName,
  address,
  phone,
  jobNumber,
  createdAt,
  scheduledStart,
  ingressCode,
  onPressSchedule,
  onCopy,
  children,
}: JobHeaderBlockProps) {
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(
    async (key: Exclude<CopiedKey, null>, text: string) => {
      try {
        await onCopy(text);
      } catch {
        return;
      }
      setCopiedKey(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopiedKey(null);
        timer.current = null;
      }, COPIED_MS);
    },
    [onCopy],
  );

  const code = ingressCode?.trim() ?? '';
  const addressText = address ?? '—';
  const phoneText = `Phone: ${phone ?? '—'}`;
  const phoneValue = phone?.trim() ?? '';
  const hasAddress = Boolean(address && address.trim());
  const hasPhone = Boolean(phoneValue);

  return (
    <View style={styles.root}>
      <View style={[styles.row, styles.line]}>
        <Text style={styles.name}>{customerName ?? 'Unknown Customer'}</Text>
        {code ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy ingress code ${code}`}
            onPress={() => copy('ingress', code)}
          >
            <Text style={styles.detail}>{copiedKey === 'ingress' ? 'Copied' : code}</Text>
          </Pressable>
        ) : null}
      </View>

      <Pressable
        style={styles.line}
        accessibilityRole="button"
        accessibilityLabel={`Copy address ${addressText}`}
        onPress={() => {
          if (hasAddress) copy('address', addressText);
        }}
      >
        <Text style={styles.detail}>{copiedKey === 'address' ? 'Copied' : addressText}</Text>
      </Pressable>

      <Pressable
        style={styles.line}
        accessibilityRole="button"
        accessibilityLabel={`Copy phone number ${phoneText}`}
        onPress={() => {
          if (hasPhone) copy('phone', phoneValue);
        }}
      >
        <Text style={styles.detail}>{copiedKey === 'phone' ? 'Copied' : phoneText}</Text>
      </Pressable>

      <View style={[styles.row, styles.center, styles.line]}>
        <Text style={styles.body}>{formatJobNumberLine(jobNumber, createdAt)}</Text>
        {onPressSchedule ? (
          <Pressable
            style={styles.scheduleBtn}
            accessibilityRole="button"
            accessibilityLabel="Adjust schedule"
            onPress={onPressSchedule}
          >
            <Text style={[styles.body, styles.right, { color: colors.primary }]}>
              {formatScheduledLabel(scheduledStart, true)}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.body, styles.right, { color: colors.text }]}>
            {formatScheduledLabel(scheduledStart, false)}
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingHorizontal: spacing.md, marginTop: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  line: { marginBottom: spacing.xs },
  name: {
    flexShrink: 1,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.h3,
    color: colors.text,
  },
  detail: { fontSize: typography.size.h5, color: colors.text },
  body: { flexShrink: 1, fontSize: typography.size.body, color: colors.text },
  right: { textAlign: 'right' },
  scheduleBtn: { flexShrink: 1 },
});
