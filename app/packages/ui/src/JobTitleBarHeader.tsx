/**
 * JobTitleBarHeader - customer header that lives inside the gold title bar.
 * Name (larger, bold), then address, then phone; address and phone are
 * tap-to-copy links. Copying is injected through `onCopy` (no clipboard here).
 * `framed` reproduces the AppChrome gold pill for screens without AppChrome's bar.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { TruncatedText } from './TruncatedText';
import { colors, radius, spacing, typography } from './tokens';

export type JobTitleBarHeaderProps = {
  customerName: string | null | undefined;
  address: string | null | undefined;
  phone: string | null | undefined;
  ingressCode?: string | null;
  onCopy: (text: string) => void | Promise<void>;
  framed?: boolean;
  jobLine?: string;
  dateLine?: string;
  scheduleLabel?: string;
  onSchedulePress?: () => void;
  timeLines?: string[];
  inset?: number;
};

type CopiedKey = 'ingress' | 'address' | 'phone' | null;
const COPIED_MS = 1500;

export function JobTitleBarHeader({
  customerName,
  address,
  phone,
  ingressCode,
  onCopy,
  framed,
  jobLine,
  dateLine,
  scheduleLabel,
  onSchedulePress,
  timeLines,
  inset = 0,
}: JobTitleBarHeaderProps) {
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
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
      if (!mounted.current) return;
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
  const addr = address?.trim() ?? '';
  const tel = phone?.trim() ?? '';
  const addressText = addr || '—';
  const phoneText = `Phone: ${tel || '—'}`;
  const hasAddress = Boolean(addr);
  const hasPhone = Boolean(tel);

  const content = (
    <View style={styles.root}>
      <View style={styles.nameRow}>
        <TruncatedText style={styles.name}>
          {customerName ?? 'Unknown Customer'}
        </TruncatedText>
        {code ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copy ingress code ${code}`}
            onPress={() => copy('ingress', code)}
          >
            <Text style={[styles.link, styles.underline, styles.ingress]}>
              {copiedKey === 'ingress' ? 'Copied' : code}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        disabled={!hasAddress}
        accessibilityRole={hasAddress ? 'button' : undefined}
        accessibilityLabel={`Copy address ${addressText}`}
        onPress={() => {
          if (hasAddress) copy('address', addr);
        }}
        style={styles.line}
      >
        <Text style={[styles.link, hasAddress && styles.underline]} numberOfLines={2}>
          {copiedKey === 'address' ? 'Copied' : addressText}
        </Text>
      </Pressable>
      <Pressable
        disabled={!hasPhone}
        accessibilityRole={hasPhone ? 'button' : undefined}
        accessibilityLabel={`Copy phone number ${tel || '—'}`}
        onPress={() => {
          if (hasPhone) copy('phone', tel);
        }}
        style={styles.line}
      >
        <Text style={[styles.link, hasPhone && styles.underline]}>
          {copiedKey === 'phone' ? 'Copied' : phoneText}
        </Text>
      </Pressable>
    </View>
  );

  const threePart = jobLine !== undefined;
  const body = threePart ? (
    <View style={styles.threeRow}>
      <View style={styles.leftCol}>
        <TruncatedText style={styles.jobLine}>
          {jobLine}
        </TruncatedText>
        {dateLine ? (
          <TruncatedText style={styles.sideText}>
            {dateLine}
          </TruncatedText>
        ) : null}
      </View>
      <View style={styles.centreCol}>{content}</View>
      <View style={styles.rightCol}>
        {scheduleLabel ? (
          onSchedulePress ? (
            <Pressable accessibilityRole="link" hitSlop={8} onPress={onSchedulePress}>
              <Text style={[styles.sideText, styles.underline, styles.rightText]} numberOfLines={2}>
                {scheduleLabel}
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.sideText, styles.rightText]} numberOfLines={2}>
              {scheduleLabel}
            </Text>
          )
        ) : null}
        {timeLines && timeLines.length > 0
          ? timeLines.map((line) => (
              <Text key={line} style={[styles.sideText, styles.rightText]} numberOfLines={1}>{line}</Text>
            ))
          : null}
      </View>
    </View>
  ) : (
    content
  );

  return framed ? (
    <View style={[styles.frame, inset ? { marginHorizontal: inset } : null]}>{body}</View>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.sand,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    marginHorizontal: 0,
  },
  root: { alignSelf: 'stretch' },
  threeRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: spacing.sm },
  leftCol: { flex: 1, alignItems: 'center' },
  centreCol: { flexShrink: 0, maxWidth: '60%', alignItems: 'center' },
  rightCol: { flex: 1, alignItems: 'center' },
  jobLine: {
    fontSize: 11,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  sideText: { fontSize: 11, color: colors.text },
  rightText: { textAlign: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  name: {
    fontSize: 18,
    fontFamily: typography.fontFamily.headingBold,
    fontWeight: typography.weight.bold,
    color: colors.text,
    flexShrink: 1,
  },
  link: { fontSize: 14, color: colors.text },
  underline: { textDecorationLine: 'underline' },
  ingress: { marginLeft: spacing.sm },
  line: { marginTop: spacing.xs },
});
