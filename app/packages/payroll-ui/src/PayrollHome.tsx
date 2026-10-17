import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '@jobcore/ui';
import type { PayrollPort } from './port';
import { TimeEntryPanel } from './TimeEntryPanel';
import type { TimeEntryPanelActions } from './TimeEntryPanel';
import { HoursTallyPanel } from './HoursTallyPanel';
import { PayPeriodPanel } from './PayPeriodPanel';
import { ReimbursementPanel } from './ReimbursementPanel';
import type { ReimbursementPanelActions } from './ReimbursementPanel';
import { TimesheetApprovalPanel } from './TimesheetApprovalPanel';

export interface PayrollHomeProps {
  port: PayrollPort;
  userId: string;
  mode: 'self' | 'admin';
  onOpenRun?: () => void;
  onOpenSettings?: () => void;
}

const actionBtn = {
  backgroundColor: colors.sand, minHeight: 44,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 6,
} as const;
const actionTxt = { color: colors.text, fontWeight: '700' } as const;

type TabId ='time' | 'hours' | 'period' | 'reimb' | 'approvals';

export function PayrollHome({ port, userId, mode, onOpenRun, onOpenSettings }: PayrollHomeProps) {
  const [active, setActive] = useState<TabId>('time');
  const [weekStartDow, setWeekStartDow] = useState(0);
  const [timeActions, setTimeActions] = useState<TimeEntryPanelActions | null>(null);
  const [reimbActions, setReimbActions] = useState<ReimbursementPanelActions | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return undefined;
    if (active !== 'time') {
      setConfirmDelete(false);
      return undefined;
    }
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete, active]);

  useEffect(() => {
    let alive = true;
    port
      .getSettings()
      .then((s) => {
        if (alive) setWeekStartDow(s.payWeek.weekStartDow);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [port]);

  const tabs: { id: TabId; label: string }[] = [
    { id: 'time', label: 'My Time' },
    { id: 'hours', label: 'Hours' },
    { id: 'period', label: 'Pay period' },
    { id: 'reimb', label: 'Reimbursements' },
  ];
  if (mode === 'admin' && port.listTeamEntries && port.approveWeek && port.rejectWeek) {
    tabs.push({ id: 'approvals', label: 'Approvals' });
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', flexShrink: 1 }}>
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setActive(t.id)}
            accessibilityRole="tab"
            style={{
              paddingVertical: 4,
              paddingHorizontal: 12,
              backgroundColor: active === t.id ? colors.sand : colors.sandInactive,
              borderBottomWidth: 2,
              borderBottomColor: active === t.id ? '#2563eb' : 'transparent',
            }}
          >
            <Text style={{ fontWeight: active === t.id ? '700' : '400' }}>{t.label}</Text>
          </Pressable>
        ))}
        </View>
        <View style={{ alignItems: 'flex-end', paddingVertical: 0 }}>
          {mode === 'admin' && (onOpenRun || onOpenSettings) ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {onOpenRun ? (
                <Pressable
                  onPress={onOpenRun}
                  accessibilityRole="button"
                  accessibilityLabel="Payroll Run"
                  style={actionBtn}
                >
                  <Text style={actionTxt}>Payroll Run</Text>
                </Pressable>
              ) : null}
              {onOpenSettings ? (
                <Pressable
                  onPress={onOpenSettings}
                  accessibilityRole="button"
                  accessibilityLabel="Payroll Settings"
                  style={actionBtn}
                >
                  <Text style={actionTxt}>Payroll Settings</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {active === 'time' ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => void timeActions?.saveAll()}
                disabled={!timeActions || timeActions.busy}
                accessibilityRole="button"
                accessibilityLabel="Save all"
                style={[actionBtn, { backgroundColor: !timeActions || timeActions.busy ? colors.sandInactive : colors.sand }]}
              >
                <Text style={actionTxt}>{timeActions?.busy ? 'Saving…' : 'Save all'}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!timeActions?.canSubmit || timeActions?.busy) return;
                  void timeActions.submitWeek();
                }}
                disabled={!timeActions?.canSubmit || timeActions?.busy}
                accessibilityRole="button"
                accessibilityLabel="Submit week"
                style={[actionBtn, { backgroundColor: !timeActions?.canSubmit || timeActions?.busy ? colors.sandInactive : colors.sand }]}
              >
                <Text style={actionTxt}>Submit week</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!timeActions?.canWithdraw || timeActions?.busy) return;
                  void timeActions.withdrawWeek();
                }}
                disabled={!timeActions?.canWithdraw || timeActions?.busy}
                accessibilityRole="button"
                accessibilityLabel="Withdraw week"
                style={[actionBtn, { backgroundColor: !timeActions?.canWithdraw || timeActions?.busy ? colors.sandInactive : colors.sand }]}
              >
                <Text style={actionTxt}>Withdraw week</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!timeActions?.canDelete || timeActions?.busy) return;
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  setConfirmDelete(false);
                  void timeActions.deleteWeek();
                }}
                disabled={!timeActions?.canDelete || timeActions?.busy}
                accessibilityRole="button"
                accessibilityLabel="Delete week"
                style={[actionBtn, { backgroundColor: !timeActions?.canDelete || timeActions?.busy ? colors.sandInactive : colors.sand }]}
              >
                <Text style={actionTxt}>{confirmDelete ? 'Tap again to delete' : 'Delete week'}</Text>
              </Pressable>
            </View>
          ) : null}
          {active === 'reimb' ? (
            <Pressable
              onPress={() => {
                if (!reimbActions?.canSubmit || reimbActions?.busy) return;
                void reimbActions.submit();
              }}
              disabled={!reimbActions?.canSubmit || reimbActions?.busy}
              accessibilityRole="button"
              accessibilityLabel="Submit"
              style={[
                actionBtn,
                { marginTop: 6, backgroundColor: !reimbActions?.canSubmit || reimbActions?.busy ? colors.sandInactive : colors.sand },
              ]}
            >
              <Text style={actionTxt}>Submit</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView style={{ flex: 1 }}>
        {active === 'time' ? (
          <TimeEntryPanel
            port={port}
            userId={userId}
            weekStartDow={weekStartDow}
            onRegisterActions={setTimeActions}
            onChanged={() => setRefreshKey((k) => k + 1)}
          />
        ) : null}
        {active === 'hours' ? (
          <HoursTallyPanel port={port} userId={userId} refreshKey={refreshKey} />
        ) : null}
        {active === 'period' ? (
          <PayPeriodPanel port={port} userId={userId} refreshKey={refreshKey} />
        ) : null}
        {active === 'reimb' ? (
          <ReimbursementPanel port={port} userId={userId} onRegisterActions={setReimbActions} />
        ) : null}
        {active === 'approvals' ? (
          <TimesheetApprovalPanel port={port} weekStartDow={weekStartDow} />
        ) : null}
      </ScrollView>
    </View>
  );
}
