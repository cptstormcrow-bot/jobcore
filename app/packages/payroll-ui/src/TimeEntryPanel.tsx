/**
 * TimeEntryPanel — current-week time entry for the signed-in worker.
 * Talks only to the injected PayrollSelfPort.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text, TextField } from '@jobcore/ui';
import type { wageEngine } from '@jobcore/core';
import type { PayrollSelfPort, PayrollTimeEntry } from './port';

export interface TimeEntryPanelProps {
  port: PayrollSelfPort;
  userId: string;
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

function weekDays(weekStartDow: number): Iso[] {
  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = new Date(todayMs).getUTCDay();
  const back = (dow - weekStartDow + 7) % 7;
  const startMs = todayMs - back * 86400000;
  const out: Iso[] = [];
  for (let i = 0; i < 7; i++) out.push(toIso(startMs + i * 86400000));
  return out;
}

function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

/** Parse "1.5" (hours) or "1:30" (H:MM) to integer minutes; null if invalid. */
function parseMinutes(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const hm = /^(\d+):([0-5]?\d)$/.exec(t);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  if (/^\d*\.?\d+$/.test(t)) return Math.round(parseFloat(t) * 60);
  return null;
}

function fmt(minutes: number): string {
  return Math.floor(minutes / 60) + ':' + pad(minutes % 60);
}

function editable(e: PayrollTimeEntry): boolean {
  return e.status === 'draft' || e.status === 'rejected';
}

export function TimeEntryPanel(props: TimeEntryPanelProps) {
  const { port, userId, weekStartDow } = props;
  const days = useMemo(() => weekDays(weekStartDow), [weekStartDow]);
  const range = useMemo(() => ({ from: days[0], to: days[6] }), [days]);
  const [entries, setEntries] = useState<PayrollTimeEntry[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');

  const reload = useCallback(async () => {
    try {
      setEntries(await port.listEntries(range));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load time entries.');
    }
  }, [port, range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setError('');
      try {
        await fn();
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      }
    },
    [reload],
  );

  const openClock = entries.find(
    (e) => e.source === 'clock' && e.clockInAt !== null && e.clockOutAt === null && editable(e),
  );

  const clockIn = () =>
    run(() =>
      port.upsertEntry({
        id: newId(),
        userId,
        workDate: days.find((d) => d === toIso(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))) ?? days[0],
        minutes: 0,
        clockInAt: new Date().toISOString(),
        clockOutAt: null,
        source: 'clock',
        status: 'draft',
        notes: null,
        rejectionReason: null,
      }),
    );

  const clockOut = () => {
    if (!openClock || !openClock.clockInAt) return Promise.resolve();
    const out = new Date();
    const mins = Math.max(0, Math.floor((out.getTime() - new Date(openClock.clockInAt).getTime()) / 60000));
    return run(() =>
      port.upsertEntry({ ...openClock, clockOutAt: out.toISOString(), minutes: mins }),
    );
  };

  const saveDay = (day: Iso) => {
    const mins = parseMinutes(inputs[day] ?? '');
    if (mins === null) {
      setError('Enter hours as 1.5 or 1:30.');
      return Promise.resolve();
    }
    const existing = entries.find((e) => e.workDate === day && e.source === 'manual' && editable(e));
    const entry: PayrollTimeEntry = existing
      ? { ...existing, minutes: mins, status: 'draft', rejectionReason: null }
      : {
          id: newId(),
          userId,
          workDate: day,
          minutes: mins,
          clockInAt: null,
          clockOutAt: null,
          source: 'manual',
          status: 'draft',
          notes: null,
          rejectionReason: null,
        };
    return run(async () => {
      await port.upsertEntry(entry);
      setInputs((p) => ({ ...p, [day]: '' }));
    });
  };

  const canSubmit = entries.some(editable);

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        <Button label="Clock in" onPress={clockIn} disabled={!!openClock} />
        <Button label="Clock out" onPress={clockOut} disabled={!openClock} variant="secondary" />
      </View>
      {error !== '' ? <Text>{error}</Text> : null}
      {days.map((day) => {
        const dayEntries = entries.filter((e) => e.workDate === day);
        const total = dayEntries.reduce((s, e) => s + e.minutes, 0);
        return (
          <Card key={day}>
            <Text>{day + '  —  ' + fmt(total)}</Text>
            {dayEntries.map((e) => (
              <View key={e.id}>
                <Text>
                  {fmt(e.minutes) + ' · ' + e.source + ' · ' + e.status +
                    (e.status === 'rejected' && e.rejectionReason ? ' (' + e.rejectionReason + ')' : '')}
                </Text>
                {editable(e) ? (
                  <Button
                    label="Delete"
                    size="sm"
                    variant="outline"
                    onPress={() => run(() => port.deleteEntry(e.id))}
                  />
                ) : null}
              </View>
            ))}
            <TextField
              label="Add hours (1.5 or 1:30)"
              value={inputs[day] ?? ''}
              onChangeText={(v) => setInputs((p) => ({ ...p, [day]: v }))}
              dense
            />
            <Button label="Save" size="sm" onPress={() => saveDay(day)} />
          </Card>
        );
      })}
      <Button
        label="Submit week"
        onPress={() => run(() => port.submitWeek(range))}
        disabled={!canSubmit}
      />
    </View>
  );
}
