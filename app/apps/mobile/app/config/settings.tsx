// JobCore screen #0065 - config-settings - Settings
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Switch, StyleSheet, TextInput } from 'react-native';
import type { CompanyInfo } from '../../../../modules/admin-finance/src/data/ports';
import { buildAdminFinancePorts } from '../../src/lib/admin-finance-repos';
import { useSession } from '../../src/lib/session';
import { AppChrome, EmptyState, PayrollButton, Text, spacing, colors, typography, useAppVersion, formatVersionLabel, useScreenNumber, radius } from '@jobcore/ui';

const EMPTY_INFO: CompanyInfo = { name: '', address: '', licenseNumber: '', phone: '' };

export default function SettingsScreen() {
  const session = useSession();
  const ports = useMemo(() => buildAdminFinancePorts(), []);
  const [info, setInfo] = useState<CompanyInfo>(EMPTY_INFO);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orgId = session.status === 'authenticated' ? session.organization.id : null;
  const role = session.status === 'authenticated' ? session.profile.role : null;
  const canEdit = role === 'admin' || role === 'owner';

  useEffect(() => {
    if (!orgId) return;
    let live = true;
    ports.companyInfo
      .get(orgId)
      .then((row) => {
        if (live) setInfo(row ?? EMPTY_INFO);
      })
      .catch((err) => {
        if (live) setError(`Could not load company info: ${err instanceof Error ? err.message : String(err)}`);
      });
    return () => {
      live = false;
    };
  }, [ports, orgId]);

  const save = useCallback(async () => {
    if (!orgId || !canEdit) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await ports.companyInfo.save(orgId, info);
      setMessage('Saved');
    } catch (err) {
      setError(`Could not save company info: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [ports, orgId, canEdit, info]);

  const fields: Array<{ key: keyof CompanyInfo; label: string }> = [
    { key: 'name', label: 'Name' },
    { key: 'address', label: 'Address' },
    { key: 'licenseNumber', label: 'License #' },
    { key: 'phone', label: 'Phone' },
  ];
  const appVersion = useAppVersion();
  const { enabled, setEnabled } = useScreenNumber();
  return (
    <View style={styles.container}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Configuration' }, { label: 'Settings' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Settings', subtitle: 'Configuration' }}
        helpContext={{ screenKey: 'settings' }}
      />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Show screen numbers</Text>
        <Switch
          testID="show-screen-numbers-switch"
          accessibilityLabel="Show screen numbers"
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.white}
        />
      </View>
      <View testID="company-info-section">
        <Text style={styles.sectionTitle}>Company Info</Text>
        {fields.map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.rowLabel}>{f.label}</Text>
            <TextInput
              testID={`company-info-${f.key}`}
              accessibilityLabel={f.label}
              style={styles.input}
              value={info[f.key]}
              editable={canEdit && !busy}
              onChangeText={(v) => setInfo((prev) => ({ ...prev, [f.key]: v }))}
            />
          </View>
        ))}
        {canEdit ? (
          <PayrollButton testID="company-info-save" label="Save" onPress={() => void save()} disabled={busy} />
        ) : null}
        {message ? <Text style={styles.saved}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <EmptyState
        title="Settings"
        message="Settings are coming soon."
      />
      <Text style={styles.version}>{formatVersionLabel(appVersion)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.offWhite,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.body,
    fontSize: typography.size.body,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  field: { paddingVertical: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    minHeight: 40,
  },
  saved: { color: colors.textMuted, marginTop: spacing.xs },
  error: { color: colors.danger, marginTop: spacing.xs },
  version: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
