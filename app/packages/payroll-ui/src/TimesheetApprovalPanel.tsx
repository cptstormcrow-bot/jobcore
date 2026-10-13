/**
 * TimesheetApprovalPanel — admin review of the team's submitted pay weeks.
 * Talks only to the injected PayrollAdminPort.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text, TextField } from '@jobcore/ui';
import type { wageEngine } from '@jobcore/core';
import type { PayrollAdminPort, PayrollDateRange, TeamWeek } from './port';
import { errorText } from './errorText';
import { SandButton } from './SandButton';

export interface TimesheetApprovalPanelProps {
  port: PayrollAdminPort;
  weekStartDow: number;
}

type Iso = wageEngine.IsoDate;

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function toIso(ms: number): Iso {
  const d = new Date(ms);
  return (d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())) as Iso;
}

function weekRange(weekStartDow: number, offsetWeeks: number): PayrollDateRange {
  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = new Date(todayMs).getUTCDay();
  const back = (dow - weekStartDow + 7) % 7;
  const startMs = todayMs - back * 86400000 + offsetWeeks * 7 * 86400000;
  return { from: toIso(startMs), to: toIso(startMs + 6 * 86400000) };
}

function fmt(minutes: number): string {
  return Math.floor(minutes / 60) + ':' + pad(minutes % 60);
}

function weekMinutes(w: TeamWeek): number {
  let total = 0;
  for (const e of w.entries) total += e.minutes;
  return total;
}

function msg(e: unknown): string {
  return errorText(e);
}

export function TimesheetApprovalPanel({ port, weekStartDow }: TimesheetApprovalPanelProps) {
  const [offset, setOffset] = useState(0);
  const [weeks, setWeeks] = useState<TeamWeek[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const range = weekRange(weekStartDow, offset);

  const refresh = useCallback(async () => {
    if (!port.listTeamEntries) {
      setError('Team timesheets are not available.');
      return;
    }
    try {
      setWeeks(await port.listTeamEntries(weekRange(weekStartDow, offset)));
      setError('');
    } catch (e) {
      setError(msg(e));
    }
  }, [port, weekStartDow, offset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      setError('');
    } catch (e) {
      setError(msg(e));
    }
    setBusy(false);
    await refresh();
  };

  const approve = (w: TeamWeek) => {
    const approveWeek = port.approveWeek;
    if (!approveWeek) {
      setError('Approving is not available.');
      return;
    }
    void act(() => approveWeek(w.userId, { from: w.weekStart, to: w.weekEnd }));
  };

  const confirmReject = (w: TeamWeek) => {
    const rejectWeek = port.rejectWeek;
    if (!rejectWeek) {
      setError('Rejecting is not available.');
      return;
    }
    const r = reason.trim();
    if (r === '') {
      setError('A reason is required to reject a week.');
      return;
    }
    setRejecting(null);
    setReason('');
    void act(() => rejectWeek(w.userId, { from: w.weekStart, to: w.weekEnd }, r));
  };

  return (
    <View>
      <View>
        <Button label="Previous week" size="sm" variant="outline" onPress={() => setOffset(offset - 1)} />
        <Text>{range.from + ' to ' + range.to}</Text>
        <Button label="Next week" size="sm" variant="outline" onPress={() => setOffset(offset + 1)} />
      </View>
      {error !== '' ? <Text>{error}</Text> : null}
      {weeks.length === 0 ? <Text>No timesheets for this week.</Text> : null}
      {weeks.map((w) => {
        const key = w.userId + w.weekStart;
        return (
          <Card key={key}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text>{w.employeeName}</Text>
                <Text>{w.weekStart + ' to ' + w.weekEnd}</Text>
                <Text>{'Total ' + fmt(weekMinutes(w)) + ' - ' + w.status}</Text>
              </View>
              {w.status === 'submitted' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <SandButton label="Approve" onPress={() => approve(w)} disabled={busy} />
                  <SandButton
                    label="Reject"
                    onPress={() => {
                      setRejecting(key);
                      setReason('');
                    }}
                    disabled={busy}
                  />
                </View>
              ) : null}
            </View>
            {rejecting === key ? (
              <View>
                <TextField label="Reason (required)" value={reason} onChangeText={setReason} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <SandButton label="Confirm reject" onPress={() => confirmReject(w)} disabled={busy} />
                  <SandButton label="Cancel" onPress={() => setRejecting(null)} />
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
