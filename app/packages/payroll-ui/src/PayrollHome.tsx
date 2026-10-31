import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { DefaultTabBar, PayrollButton } from '@jobcore/ui';
import type { PayrollPort } from './port';
import { TimeEntryPanel } from './TimeEntryPanel';
import type { TimeEntryPanelActions } from './TimeEntryPanel';
import { HoursTallyPanel } from './HoursTallyPanel';
import type { HoursRange } from './HoursTallyPanel';
import { PayPeriodPanel } from './PayPeriodPanel';
import { ReimbursementPanel } from './ReimbursementPanel';
import type { ReimbursementPanelActions } from './ReimbursementPanel';
import { TimesheetApprovalPanel } from './TimesheetApprovalPanel';

export type TabId = 'time' | 'hours' | 'period' | 'reimb' | 'approvals' | 'run' | 'settings';

export interface PayrollHomeProps {
  port: PayrollPort;
  userId: string;
  mode: 'self' | 'admin';
  /** @deprecated Run is now a tab; use renderRun. Ignored. */
  onOpenRun?: () => void;
  /** @deprecated Settings is now a tab; use renderSettings. Ignored. */
  onOpenSettings?: () => void;
  renderRun?: () => ReactNode;
  renderSettings?: () => ReactNode;
  initialTab?: TabId;
}

export function PayrollHome({ port, userId, mode, renderRun, renderSettings, initialTab }: PayrollHomeProps) {
  const [active, setActive] = useState<TabId>(initialTab ?? 'time');
  const [weekStartDow, setWeekStartDow] = useState(0);
  const [timeActions, setTimeActions] = useState<TimeEntryPanelActions | null>(null);
  const [reimbActions, setReimbActions] = useState<ReimbursementPanelActions | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hoursRange, setHoursRange] = useState<HoursRange>('week');
  const onChanged = useCallback(() => setRefreshKey((k) => k + 1), []);

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
  if (mode === 'admin') {
    tabs.push({ id: 'run', label: 'Payroll Run' });
    tabs.push({ id: 'settings', label: 'Payroll Settings' });
  }

  const rightSlot =
    active === 'time' || active === 'reimb' ? (
      <View style={{ alignItems: 'flex-end', paddingHorizontal: 16 }}>
          {active === 'time' ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 2, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              <PayrollButton
                label={timeActions?.busy ? 'Saving...' : 'Save'}
                onPress={() => void timeActions?.saveAll()}
                disabled={!timeActions || timeActions.busy}
                accessibilityLabel="Save"
              />
              <PayrollButton
                label="Submit"
                onPress={() => {
                  if (!timeActions?.canSubmit || timeActions?.busy) return;
                  void timeActions.submitWeek();
                }}
                disabled={!timeActions?.canSubmit || timeActions?.busy}
                accessibilityLabel="Submit"
              />
              <PayrollButton
                label="Withdraw"
                onPress={() => {
                  if (!timeActions?.canWithdraw || timeActions?.busy) return;
                  void timeActions.withdrawWeek();
                }}
                disabled={!timeActions?.canWithdraw || timeActions?.busy}
                accessibilityLabel="Withdraw"
              />
              <PayrollButton
                label={confirmDelete ? 'Tap again to delete' : 'Delete'}
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
                accessibilityLabel={confirmDelete ? 'Tap again to delete' : 'Delete'}
              />
            </View>
          ) : null}
          {active === 'reimb' ? (
            <PayrollButton
              label="Submit"
              onPress={() => {
                if (!reimbActions?.canSubmit || reimbActions?.busy) return;
                void reimbActions.submit();
              }}
              disabled={!reimbActions?.canSubmit || reimbActions?.busy}
              accessibilityLabel="Submit"
              style={{ marginTop: 6 }}
            />
          ) : null}
      </View>
    ) : undefined;

  return (
    <View style={{ flex: 1 }}>
      <DefaultTabBar tabs={tabs} activeId={active} onChange={(id) => setActive(id as TabId)} rightSlot={rightSlot} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {active === 'time' ? (
          <TimeEntryPanel
            port={port}
            userId={userId}
            weekStartDow={weekStartDow}
            onRegisterActions={setTimeActions}
            onChanged={onChanged}
          />
        ) : null}
        {active === 'hours' ? (
          <View>
            <DefaultTabBar
              tabs={[
                { id: 'week', label: 'Week' },
                { id: 'month', label: 'Month' },
                { id: 'year', label: 'Year' },
              ]}
              activeId={hoursRange}
              onChange={(id) => setHoursRange(id as HoursRange)}
            />
            <HoursTallyPanel port={port} userId={userId} refreshKey={refreshKey} range={hoursRange} />
          </View>
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
        {active === 'run' && mode === 'admin' && renderRun?.()}
        {active === 'settings' && mode === 'admin' && renderSettings?.()}
      </ScrollView>
    </View>
  );
}
