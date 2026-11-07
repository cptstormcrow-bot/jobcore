// JobCore screen #0065 - config-settings - Settings
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Switch, StyleSheet, TextInput, Image } from 'react-native';
import type { CompanyInfo, BarcodePaths, BarcodeService } from '../../../../modules/admin-finance/src/data/ports';
import { buildAdminFinancePorts } from '../../src/lib/admin-finance-repos';
import { useSession } from '../../src/lib/session';
import { pickBarcodeImage } from '../../src/lib/barcode-image-picker';
import { AppChrome, EmptyState, PayrollButton, Text, spacing, colors, typography, useAppVersion, formatVersionLabel, useScreenNumber, radius } from '@jobcore/ui';

const BARCODE_LABELS: Record<BarcodeService, string> = { paypal: 'PayPal', venmo: 'Venmo', zelle: 'Zelle' };
const EMPTY_INFO: CompanyInfo = { name: '', address: '', licenseNumber: '', phone: '' };

export default function SettingsScreen() {
  const session = useSession();
  const ports = useMemo(() => buildAdminFinancePorts(), []);
  const [info, setInfo] = useState<CompanyInfo>(EMPTY_INFO);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [barcodes, setBarcodes] = useState<BarcodePaths>({});
  const [barcodeUrls, setBarcodeUrls] = useState<BarcodePaths>({});
  const [barcodeBusy, setBarcodeBusy] = useState<BarcodeService | null>(null);
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

  useEffect(() => {
    if (!orgId || !ports.companyInfo.getBarcodePaths) return;
    let live = true;
    void ports.companyInfo.getBarcodePaths(orgId).then((paths) => {
      if (live) setBarcodes(paths);
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [ports, orgId]);

  useEffect(() => {
    let live = true;
    (['paypal', 'venmo', 'zelle'] as const).forEach((svc) => {
      const path = barcodes[svc];
      if (!path || !ports.companyInfo.barcodeUrl) return;
      void ports.companyInfo.barcodeUrl(path).then((url) => {
        if (live && url) setBarcodeUrls((prev) => ({ ...prev, [svc]: url }));
      }).catch(() => undefined);
    });
    return () => {
      live = false;
    };
  }, [ports, barcodes]);

  const chooseBarcode = useCallback(async (svc: BarcodeService) => {
    if (!orgId || !canEdit || !ports.companyInfo.saveBarcode) return;
    setError(null);
    setMessage(null);
    try {
      const file = await pickBarcodeImage();
      if (!file) return;
      setBarcodeBusy(svc);
      const path = await ports.companyInfo.saveBarcode(orgId, svc, file);
      setBarcodes((prev) => ({ ...prev, [svc]: path }));
      setBarcodeUrls((prev) => ({ ...prev, [svc]: file.uri }));
      setMessage('Barcode saved');
    } catch (err) {
      setError(`Could not save barcode: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBarcodeBusy(null);
    }
  }, [ports, orgId, canEdit]);

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
        <Text style={styles.sectionTitle}>Payment barcodes</Text>
        {(['paypal', 'venmo', 'zelle'] as const).map((svc) => (
          <View key={svc} style={styles.barcodeRow} testID={`barcode-row-${svc}`}>
            {barcodeUrls[svc] ? (
              <Image source={{ uri: barcodeUrls[svc] }} style={styles.barcodeThumb} accessibilityLabel={`${BARCODE_LABELS[svc]} barcode`} />
            ) : (
              <View style={styles.barcodeThumb} />
            )}
            <Text style={[styles.rowLabel, { flex: 1 }]} numberOfLines={1}>{BARCODE_LABELS[svc]}</Text>
            {canEdit ? (
              <PayrollButton
                testID={`barcode-pick-${svc}`}
                label={barcodes[svc] ? 'Replace' : 'Upload'}
                onPress={() => void chooseBarcode(svc)}
                disabled={barcodeBusy !== null || busy}
              />
            ) : (
              <Text style={{ color: colors.textMuted }}>{barcodes[svc] ? 'Saved' : 'None'}</Text>
            )}
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
      <Text style={styles.version}>{formatVersionLabel(appVersion, '\n')}</Text>
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
    minHeight: 36,
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
  barcodeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40, paddingVertical: spacing.xs },
  barcodeThumb: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.white },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    color: colors.text,
    fontSize: typography.text.input,
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
