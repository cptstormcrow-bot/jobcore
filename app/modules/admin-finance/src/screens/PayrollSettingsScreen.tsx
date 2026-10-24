// JobCore screen #0086 - af-PayrollSettings - Payroll Settings
/**
 * Payroll settings screen (admin) — week-start day, overtime rules and the
 * QuickBooks account map. Weekly pay only: there is no period selector.
 *
 * Uses the optional admin members of the payroll port (getSettings,
 * saveSettings, getQbAccountMap, setQbAccountMap). If the host has not
 * injected a payroll port, renders a short message instead of crashing.
 */

import React from 'react';
import { ScrollView, View } from 'react-native';
import { EmptyState, PayrollButton, Text, TextField, Toggle } from '@jobcore/ui';
import type { PayrollSettings } from '@jobcore/payroll-ui';
import { getModulePorts } from '../lib/module-ports';
import { useModuleSession } from '../lib/module-session';

export interface PayrollSettingsScreenProps {
  onBack?: () => void;
  onOpenCompensationPolicy?: () => void;
}

type QbKey = 'wages_expense' | 'reimbursement_expense' | 'payroll_payable';
type QbMap = Record<QbKey, string>;

const QB_FIELDS: { key: QbKey; label: string }[] = [
  { key: 'wages_expense', label: 'Wages expense account' },
  { key: 'reimbursement_expense', label: 'Reimbursement expense account' },
  { key: 'payroll_payable', label: 'Payroll payable account' },
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toInt(text: string): number {
  const n = parseInt(text, 10);
  return Number.isFinite(n) ? n : 0;
}

export function PayrollSettingsScreen(props: PayrollSettingsScreenProps = {}) {
  const { onBack } = props;
  const session = useModuleSession();
  const payroll = getModulePorts().payroll;

  const [settings, setSettings] = React.useState<PayrollSettings | null>(null);
  const [qb, setQb] = React.useState<QbMap | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!payroll) return;
    let alive = true;
    (async () => {
      try {
        const s = await payroll.getSettings();
        const m = payroll.getQbAccountMap ? await payroll.getQbAccountMap() : null;
        if (!alive) return;
        setSettings(s);
        setQb(m);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load payroll settings');
      }
    })();
    return () => {
      alive = false;
    };
  }, [payroll]);

  if (!payroll || !session) {
    return (
      <View>
        <EmptyState title="Payroll settings are not available yet" />
        {onBack ? <PayrollButton label="Back" onPress={onBack} /> : null}
      </View>
    );
  }

  const canSaveSettings = !!payroll.saveSettings;
  const canSaveQb = !!payroll.setQbAccountMap;

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const patchOvertime = (patch: Partial<PayrollSettings['overtime']>) =>
    setSettings((s) => (s ? { ...s, overtime: { ...s.overtime, ...patch } } : s));

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {onBack ? <PayrollButton label="Back" onPress={onBack} /> : null}
        {props.onOpenCompensationPolicy ? (
          <PayrollButton label="Compensation Policy" onPress={props.onOpenCompensationPolicy} />
        ) : null}
        {canSaveSettings && settings ? (
          <PayrollButton
            label="Save settings"
            disabled={busy}
            onPress={() => run(() => payroll.saveSettings!(settings), 'Settings saved')}
          />
        ) : null}
        {canSaveQb && qb ? (
          <PayrollButton
            label="Save accounts"
            disabled={busy}
            onPress={() => run(() => payroll.setQbAccountMap!(qb), 'Accounts saved')}
          />
        ) : null}
      </View>
      <Text>Payroll settings</Text>
      {error ? <Text>{error}</Text> : null}
      {message ? <Text>{message}</Text> : null}

      {settings ? (
        <View>
          <Text>Week starts on</Text>
          <TextField
            label="Week-start day (0 = Sunday ... 6 = Saturday)"
            value={String(settings.payWeek.weekStartDow)}
            disabled={!canSaveSettings}
            onChangeText={(t) =>
              setSettings({
                ...settings,
                payWeek: { ...settings.payWeek, weekStartDow: Math.min(6, Math.max(0, toInt(t))) },
              })
            }
          />
          <Text>{DAY_NAMES[settings.payWeek.weekStartDow] ?? ''}</Text>

          <Text>Overtime rules</Text>
          <TextField
            label="Daily overtime after (minutes)"
            value={String(settings.overtime.dailyOtAfterMin)}
            disabled={!canSaveSettings}
            onChangeText={(t) => patchOvertime({ dailyOtAfterMin: toInt(t) })}
          />
          <TextField
            label="Daily double time after (minutes)"
            value={String(settings.overtime.dailyDtAfterMin)}
            disabled={!canSaveSettings}
            onChangeText={(t) => patchOvertime({ dailyDtAfterMin: toInt(t) })}
          />
          <TextField
            label="Weekly overtime after (minutes)"
            value={String(settings.overtime.weeklyOtAfterMin)}
            disabled={!canSaveSettings}
            onChangeText={(t) => patchOvertime({ weeklyOtAfterMin: toInt(t) })}
          />
          <Toggle
            label="Seventh consecutive day rule"
            value={settings.overtime.seventhDayRule}
            disabled={!canSaveSettings}
            onChange={(v) => patchOvertime({ seventhDayRule: v })}
          />
        </View>
      ) : (
        !error && <Text>Loading...</Text>
      )}

      {qb ? (
        <View>
          <Text>QuickBooks accounts</Text>
          {QB_FIELDS.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              value={qb[f.key] ?? ''}
              disabled={!canSaveQb}
              onChangeText={(t) => setQb({ ...qb, [f.key]: t })}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
