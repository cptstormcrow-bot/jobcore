// JobCore screen #0070 - sweep-modules-admin-finance-src-screens-accordioneditrow-tsx - sweep-modules-admin-finance-src-screens-accordioneditrow-tsx
/**
 * AccordionEditRow — collapsible row with header (title/subtitle/tag),
 * expand-to-edit children, and a Save/Cancel/Delete action row.
 *
 * Parent owns field draft state; this component owns only confirmDelete,
 * pending and error, all reset when `expanded` becomes false.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { PayrollButton, Text, colors, spacing, typography, radius } from '@jobcore/ui';

export type AccordionEditRowProps = {
  title: string;
  subtitle?: string;
  tag?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  onSave: () => Promise<{ ok: boolean; reason?: string }>;
  onCancel: () => void;
  onDelete?: () => Promise<{ ok: boolean; reason?: string }>;
  saveDisabled?: boolean;
  testID?: string;
};

const CONFIRM_DELETE_TIMEOUT_MS = 4000;

export function AccordionEditRow({
  title,
  subtitle,
  tag,
  expanded,
  onToggle,
  children,
  onSave,
  onCancel,
  onDelete,
  saveDisabled,
  testID,
}: AccordionEditRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearConfirmTimeout = () => {
    if (confirmTimeoutRef.current) {
      clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!expanded) {
      setConfirmDelete(false);
      setPending(null);
      setError(undefined);
      clearConfirmTimeout();
    }
  }, [expanded]);

  useEffect(() => {
    return () => clearConfirmTimeout();
  }, []);

  const handleCancel = () => {
    setConfirmDelete(false);
    setError(undefined);
    clearConfirmTimeout();
    onCancel();
  };

  const handleSave = async () => {
    setPending('save');
    setError(undefined);
    const result = await onSave();
    setPending(null);
    if (!result.ok) {
      setError(result.reason);
    }
  };

  const handleDeletePress = async () => {
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      clearConfirmTimeout();
      confirmTimeoutRef.current = setTimeout(() => {
        setConfirmDelete(false);
        confirmTimeoutRef.current = null;
      }, CONFIRM_DELETE_TIMEOUT_MS);
      return;
    }
    clearConfirmTimeout();
    setPending('delete');
    setError(undefined);
    const result = await onDelete();
    setPending(null);
    if (!result.ok) {
      setError(result.reason);
    } else {
      setConfirmDelete(false);
    }
  };

  const busy = pending !== null;
  const busyLabel = pending === 'delete' ? 'Deleting…' : 'Saving…';

  return (
    <View style={styles.container} testID={testID}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {children}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            {onDelete ? (
              <PayrollButton
                label={busy ? busyLabel : confirmDelete ? 'Confirm delete' : 'Delete'}
                onPress={handleDeletePress}
                disabled={busy}
                tone={confirmDelete ? 'danger' : 'default'}
              />
            ) : null}
            <PayrollButton label="Cancel" onPress={handleCancel} disabled={busy} />
            <PayrollButton
              label={pending === 'save' ? busyLabel : 'Save'}
              onPress={handleSave}
              disabled={busy || saveDisabled}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.bodyMedium,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    color: colors.textMuted,
    marginTop: spacing.xs / 2,
  },
  tag: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    marginLeft: spacing.sm,
  },
  tagText: {
    fontSize: typography.size.detail,
    fontFamily: typography.fontFamily.body,
    color: colors.textMuted,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  error: {
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dangerOutline: {
    borderColor: colors.danger,
  },
});
