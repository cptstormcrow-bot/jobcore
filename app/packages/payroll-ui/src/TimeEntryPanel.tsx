/**
 * TimeEntryPanel — current-week time entry for the signed-in worker.
 * Talks only to the injected PayrollSelfPort.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text, TextField } from '@jobcore/ui';
import type { wageEngine } from '@jobcore/core';
import type { PayrollSelfPort, PayrollTimeEntry } from './port';
import { errorText } from './errorText';

export interface TimeEntryPanelActions {
  saveAll: () => Promise<void>;
  submitWeek: () => Promise<void>;
  canSubmit: boolean;
  busy: boolean;
  clockIn: () => void | Promise<void>;
  clockOut: () => void | Promise<void>;
  clockedIn: boolean;
}

export interface TimeEntryPanelProps {
  port: PayrollSelfPort;
  userId: string;
  weekStartDow: number;
  /** Lets the parent render its own Submit week control. */
  onRegisterActions?: (a: TimeEntryPanelActions) => void;
  /** Called after every successful mutation (save, delete, submit, clock in/out). */
  onChanged?: () => void;
}

type Iso = wageEngine.IsoDate;

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function toIso(ms: number): Iso {
  const d = new Date(ms);
  return (d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())) as Iso;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon 10/12" from an ISO date (computed in UTC from the date parts, no TZ shift). */
function dayLabel(iso: string): string {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return WEEKDAYS[wd] + ' ' + m + '/' + d;
}

function weekdayOnly(iso: string): string {
  return dayLabel(iso).split(' ')[0]!;
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
  if (hm) return parseInt(hm[1]!, 10) * 60 + parseInt(hm[2]!, 10);
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
  const { port, userId, weekStartDow, onRegisterActions, onChanged } = props;
  const days = useMemo(() => weekDays(weekStartDow), [weekStartDow]);
  const range = useMemo(() => ({ from: days[0]!, to: days[6]! }), [days]);
  const [entries, setEntries] = useState<PayrollTimeEntry[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const reload = useCallback(async () => {
    try {
      setEntries(await port.listEntries(range));
    } catch (e) {
      setError("Couldn't load your time entries: " + errorText(e, 'Could not load time entries.'));
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
        if (onChanged) onChanged();
      } catch (e) {
        setError(errorText(e, 'Something went wrong.'));
      }
    },
    [reload, onChanged],
  );

  const openClock = entries.find(
    (e) => e.source === 'clock' && e.clockInAt !== null && e.clockOutAt === null && editable(e),
  );

  const clockIn = () =>
    run(() =>
      port.upsertEntry({
        id: newId(),
        userId,
        workDate: days.find((d) => d === toIso(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))) ?? days[0]!,
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

  const dirtyDays = days.filter((d) => (inputs[d] ?? '').trim() !== '');

  const saveAll = useCallback(async () => {
    if (dirtyDays.length === 0) return;
    setError('');
    setSaveState('saving');
    try {
      for (const day of dirtyDays) {
        const mins = parseMinutes(inputs[day] ?? '');
        if (mins === null) {
          throw new Error(dayLabel(day) + ': enter hours as 1.5 or 1:30.');
        }
        const note = (notes[day] ?? '').trim();
        const existing = entries.find((e) => e.workDate === day && e.source === 'manual' && editable(e));
        const entry: PayrollTimeEntry = existing
          ? { ...existing, minutes: mins, status: 'draft', rejectionReason: null, notes: note !== '' ? note : existing.notes }
          : {
              id: newId(),
              userId,
              workDate: day,
              minutes: mins,
              clockInAt: null,
              clockOutAt: null,
              source: 'manual',
              status: 'draft',
              notes: note !== '' ? note : null,
              rejectionReason: null,
            };
        await port.upsertEntry(entry);
        setInputs((p) => ({ ...p, [day]: '' }));
        setNotes((p) => ({ ...p, [day]: '' }));
      }
      await reload();
      setSaveState('saved');
      if (onChanged) onChanged();
    } catch (e) {
      setError(errorText(e, 'Could not save.'));
      setSaveState('idle');
      await reload();
    }
  }, [dirtyDays, inputs, notes, entries, port, userId, reload, onChanged]);

  const canSubmit = entries.some(editable);
  const busy = saveState === 'saving';

  const submitWeek = useCallback(() => run(() => port.submitWeek(range)), [run, port, range]);

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({ saveAll, submitWeek, canSubmit, busy, clockIn, clockOut, clockedIn: !!openClock });
    }
    // clockIn/clockOut are recreated each render; they close over entries/days, so re-register when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterActions, saveAll, submitWeek, canSubmit, busy, entries, days, userId, run, port]);

  return (
    <View>
      <View style={{ marginTop: 4 }}>
        <Button
          label={busy ? 'Saving…' : 'Save All'}
          onPress={saveAll}
          disabled={busy || dirtyDays.length === 0}
        />
        {saveState === 'saved' && dirtyDays.length === 0 ? <Text>Saved.</Text> : null}
      </View>
      {error !== '' ? <Text>{error}</Text> : null}
      {days.map((day) => {
        const dayEntries = entries.filter((e) => e.workDate === day);
        const total = dayEntries.reduce((s, e) => s + e.minutes, 0);
        return (
          <Card key={day} style={{ marginVertical: 2, padding: 6 }}>
            <Text>{dayLabel(day) + '  —  ' + fmt(total)}</Text>
            {dayEntries.map((e) => (
              <View key={e.id} style={{ marginVertical: 0, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1 }}>
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
              label={'Hours worked on ' + weekdayOnly(day) + ' (1.5 or 1:30)'}
              value={inputs[day] ?? ''}
              onChangeText={(v) => {
                setSaveState('idle');
                setInputs((p) => ({ ...p, [day]: v }));
              }}
              dense
            />
            <TextField
              label="Notes (optional)"
              value={notes[day] ?? ''}
              onChangeText={(v) => setNotes((p) => ({ ...p, [day]: v }))}
              dense
            />
          </Card>
        );
      })}
    </View>
  );
}
