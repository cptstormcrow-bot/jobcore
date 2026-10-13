import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { PayrollPort } from './port';
import { TimeEntryPanel } from './TimeEntryPanel';
import { HoursTallyPanel } from './HoursTallyPanel';
import { PayPeriodPanel } from './PayPeriodPanel';
import { ReimbursementPanel } from './ReimbursementPanel';
import { TimesheetApprovalPanel } from './TimesheetApprovalPanel';

export interface PayrollHomeProps {
  port: PayrollPort;
  userId: string;
  mode: 'self' | 'admin';
}

type TabId = 'time' | 'hours' | 'period' | 'reimb' | 'approvals';

export function PayrollHome({ port, userId, mode }: PayrollHomeProps) {
  const [active, setActive] = useState<TabId>('time');
  const [weekStartDow, setWeekStartDow] = useState(0);

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
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setActive(t.id)}
            accessibilityRole="tab"
            style={{
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderBottomWidth: 2,
              borderBottomColor: active === t.id ? '#2563eb' : 'transparent',
            }}
          >
            <Text style={{ fontWeight: active === t.id ? '700' : '400' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={{ flex: 1 }}>
        {active === 'time' ? (
          <TimeEntryPanel port={port} userId={userId} weekStartDow={weekStartDow} />
        ) : null}
        {active === 'hours' ? <HoursTallyPanel port={port} userId={userId} /> : null}
        {active === 'period' ? <PayPeriodPanel port={port} userId={userId} /> : null}
        {active === 'reimb' ? <ReimbursementPanel port={port} userId={userId} /> : null}
        {active === 'approvals' ? (
          <TimesheetApprovalPanel port={port} weekStartDow={weekStartDow} />
        ) : null}
      </ScrollView>
    </View>
  );
}
