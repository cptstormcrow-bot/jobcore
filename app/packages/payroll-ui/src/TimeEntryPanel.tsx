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
import { SandButton } from './SandButton';

export interface TimeEntryPanelActions {
  saveAll: () => Promise<void>;
  submitWeek: () => Promise<void>;
  withdrawWeek: () => Promise<void>;
  deleteWeek: () => Promise<void>;
  canSubmit: boolean;
  canWithdraw: boolean;
  canDelete: boolean;
  busy: boolean;
}

export interface TimeEntryPanelProps {
  port: PayrollSelfPort;
  userId: string;
  weekStartDow: number;
  /** Lets the parent render its own Submit week control. */
  onRegisterActions?: (a: TimeEntryPanelActions) => void;
  /** Called after every successful mutation (save, delete, submit). */
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

  // Pre-fill each day's input with the total of its manual draft/rejected entries.
  const prefill = useMemo(() => {
    const out: Record<string, string> = {};
    for (const d of days) {
      const mins = entries
        .filter((e) => e.workDate === d && e.source === 'manual' && editable(e))
        .reduce((s, e) => s + e.minutes, 0);
      const has = entries.some((e) => e.workDate === d && e.source === 'manual' && editable(e));
      out[d] = has ? fmt(mins) : '';
    }
    return out;
  }, [entries, days]);
  const [lastPrefill, setLastPrefill] = useState<Record<string, string>>({});
  useEffect(() => {
    const changed = days.filter((d) => (lastPrefill[d] ?? '') !== prefill[d]);
    if (changed.length === 0) return;
    setInputs((p) => {
      const n = { ...p };
      for (const d of changed) n[d] = prefill[d] ?? '';
      return n;
    });
    setLastPrefill(prefill);
  }, [prefill, lastPrefill, days]);

  const dirtyDays = days.filter((d) => {
    const t = (inputs[d] ?? '').trim();
    return t !== '' && t !== (prefill[d] ?? '');
  });

  const saveAll = useCallback(async () => {
    if (saveState === 'saving') return;
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
        const manuals = entries.filter((e) => e.workDate === day && e.source === 'manual');
        const editables = manuals.filter(editable);
        const anyManual = editables[0] ?? manuals[0];
        if (anyManual && !editable(anyManual)) {
          if (anyManual.minutes === mins) {
            setInputs((p) => ({ ...p, [day]: '' }));
            setNotes((p) => ({ ...p, [day]: '' }));
            continue;
          }
          setInputs((p) => ({ ...p, [day]: '' }));
          setNotes((p) => ({ ...p, [day]: '' }));
          continue;
        }
        const existing = anyManual;
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
        for (const extra of editables.slice(1)) await port.deleteEntry(extra.id);
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
  }, [saveState, dirtyDays, inputs, notes, entries, port, userId, reload, onChanged]);

  const canSubmit = entries.some(editable);
  const busy = saveState === 'saving';

  const submitWeek = useCallback(() => run(() => port.submitWeek(range)), [run, port, range]);

  const canWithdraw = entries.some((e) => e.status === 'submitted' || e.status === 'approved');
  const canDelete = entries.some((e) => e.status !== 'approved');

  const withdrawWeek = useCallback(() => run(() => port.withdrawWeek(range)), [run, port, range]);

  const deleteWeek = useCallback(
    () =>
      run(async () => {
        if (entries.some((e) => e.status === 'submitted')) await port.withdrawWeek(range);
        for (const e of entries) {
          if (e.status !== 'approved') await port.deleteEntry(e.id);
        }
      }),
    [run, port, range, entries],
  );

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({ saveAll, submitWeek, withdrawWeek, deleteWeek, canSubmit, canWithdraw, canDelete, busy });
    }
  }, [onRegisterActions, saveAll, submitWeek, withdrawWeek, deleteWeek, canSubmit, canWithdraw, canDelete, busy]);

  return (
    <View>
      {error !== '' ? (
        <View style={{ alignItems: 'center', marginVertical: 2 }}>
          <Text style={{ color: '#b00020', textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}
      {onRegisterActions ? null : (
        <View style={{ marginTop: 0, alignSelf: 'flex-end' }}>
          <SandButton
            label={busy ? 'Saving…' : 'Save all'}
            onPress={saveAll}
            disabled={busy || dirtyDays.length === 0}
          />
        </View>
      )}
      {entries.length > 0 && !canSubmit ? (
        <Text style={{ color: '#666666', fontSize: 12 }}>This week is already submitted or approved. Tap Withdraw week to change it.</Text>
      ) : null}
      {saveState === 'saved' && dirtyDays.length === 0 ? <Text>Saved.</Text> : null}
      {days.map((day) => {
        const dayEntries = entries.filter((e) => e.workDate === day);
        const total = dayEntries.reduce((s, e) => s + e.minutes, 0);
        const dayManual = dayEntries.filter((e) => e.source === 'manual');
        const locked = dayManual.length > 0 && !dayManual.some(editable);
        return (
          <Card key={day} style={{ marginVertical: 2, padding: 4 }}>
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
              disabled={locked}
              dense
            />
            {locked ? (
              <Text style={{ color: '#666666', fontSize: 12 }}>
                {dayManual.some((e) => e.status === 'submitted')
                  ? 'Submitted for approval. Tap Withdraw week to change it.'
                  : 'Approved. Tap Withdraw week to reopen it, then submit again after your changes.'}
              </Text>
            ) : null}
            {(notes[day] ?? '').trim() !== '' ? (
              <TextField
                label="Notes (optional)"
                value={notes[day] ?? ''}
                onChangeText={(v) => setNotes((p) => ({ ...p, [day]: v }))}
                dense
              />
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}
