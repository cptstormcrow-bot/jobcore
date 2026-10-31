/**
 * TimeEntryPanel — current-week time entry for the signed-in worker.
 * Talks only to the injected PayrollSelfPort.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { Card, PayrollButton, Text, TextField, colors } from '@jobcore/ui';
import type { wageEngine } from '@jobcore/core';
import type { PayrollSelfPort, PayrollTimeEntry } from './port';
import { errorText } from './errorText';

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
  /** Lets the parent render its own Submit control. */
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

const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Monday, Oct 26" from an ISO date (computed in UTC from the date parts, no TZ shift). */
function dayLabel(iso: string): string {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const d = parseInt(iso.slice(8, 10), 10);
  const wd = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return FULL_WEEKDAYS[wd] + ', ' + monthDay(iso);
}

/** The 7 days of the week containing today, shifted by `weekOffset` whole weeks. */
function weekDays(weekStartDow: number, weekOffset = 0): Iso[] {
  const now = new Date();
  const todayMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = new Date(todayMs).getUTCDay();
  const back = (dow - weekStartDow + 7) % 7;
  const startMs = todayMs - back * 86400000 + weekOffset * 7 * 86400000;
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Oct 12" from an ISO date. */
function monthDay(iso: string): string {
  return MONTHS[parseInt(iso.slice(5, 7), 10) - 1] + ' ' + parseInt(iso.slice(8, 10), 10);
}

function weekLabel(n: number): string {
  if (n === 0) return 'This Week';
  if (n === -1) return 'Last Week';
  if (n === 1) return 'Next Week';
  return n < -1 ? `${-n} weeks ago` : `In ${n} weeks`;
}

export function TimeEntryPanel(props: TimeEntryPanelProps) {
  const { port, userId, weekStartDow, onRegisterActions, onChanged } = props;
  const [weekOffset, setWeekOffset] = useState(0);
  const days = useMemo(() => weekDays(weekStartDow, weekOffset), [weekStartDow, weekOffset]);
  const range = useMemo(() => ({ from: days[0]!, to: days[6]! }), [days]);
  const [entries, setEntries] = useState<PayrollTimeEntry[]>([]);
  // Entries written by the most recent Save; merged into reload so a stale list cannot undo them.
  const lastSaved = useRef<Map<string, PayrollTimeEntry>>(new Map());
  const lastDeleted = useRef<Set<string>>(new Set());
  useEffect(() => {
    lastSaved.current = new Map();
    lastDeleted.current = new Set();
  }, [weekOffset]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const reload = useCallback(async () => {
    try {
      const sel = await port.listEntries(range);
      const saved = lastSaved.current;
      const deleted = lastDeleted.current;
      const merged = sel.filter((e) => !deleted.has(e.id));
      for (const s of saved.values()) {
        if (s.workDate < range.from || s.workDate > range.to) continue;
        const i = merged.findIndex((e) => e.id === s.id);
        if (i < 0) merged.push(s);
        else if (merged[i]!.minutes !== s.minutes || merged[i]!.status !== s.status) merged[i] = s;
      }
      setEntries(merged);
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
      lastSaved.current = new Map();
      lastDeleted.current = new Set();
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

  const dirtyDays = useMemo(
    () =>
      days.filter((d) => {
        const t = (inputs[d] ?? '').trim();
        return t !== '' && t !== (prefill[d] ?? '');
      }),
    [days, inputs, prefill],
  );

  const saveAll = useCallback(async () => {
    if (saveState === 'saving') return;
    if (dirtyDays.length === 0) return;
    setError('');
    setSaveState('saving');
    const savedNow = new Map<string, PayrollTimeEntry>();
    const deletedNow = new Set<string>();
    const applyLocal = () => {
      for (const [id, s] of savedNow) {
        lastSaved.current.set(id, s);
        lastDeleted.current.delete(id);
      }
      for (const id of deletedNow) {
        lastSaved.current.delete(id);
        lastDeleted.current.add(id);
      }
      setEntries((prev) => {
        const next = prev.slice();
        for (const [id, s] of savedNow) {
          const i = next.findIndex((e) => e.id === id);
          if (i >= 0) next[i] = s;
          else next.push(s);
        }
        return next.filter((e) => !deletedNow.has(e.id));
      });
    };
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
        savedNow.set(entry.id, entry);
        for (const extra of editables.slice(1)) {
          if (extra.id === entry.id) continue;
          await port.deleteEntry(extra.id);
          deletedNow.add(extra.id);
        }
        setNotes((p) => ({ ...p, [day]: '' }));
      }
      applyLocal();
      await reload();
      setSaveState('saved');
      if (onChanged) onChanged();
    } catch (e) {
      setError(errorText(e, 'Could not save.'));
      setSaveState('idle');
      applyLocal();
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
          <Text style={{ color: colors.danger, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}
      {onRegisterActions ? null : (
        <View style={{ marginTop: 0, alignSelf: 'flex-end' }}>
          <PayrollButton
            label={busy ? 'Saving…' : 'Save'}
            onPress={saveAll}
            disabled={busy || dirtyDays.length === 0}
          />
        </View>
      )}
      <Card style={{ padding: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <PayrollButton
          label="<"
          onPress={() => setWeekOffset((o) => o - 1)}
          accessibilityLabel="Previous week"
          style={{ paddingHorizontal: 12, paddingVertical: 4 }}
        />
        <Text style={{ fontWeight: '700', textAlign: 'center', minWidth: 110 }}>{weekLabel(weekOffset)}</Text>
        <PayrollButton
          label=">"
          onPress={() => setWeekOffset((o) => o + 1)}
          accessibilityLabel="Next week"
          style={{ paddingHorizontal: 12, paddingVertical: 4 }}
        />
        <Text style={{ marginLeft: 'auto' }}>{monthDay(days[0]!) + ' - ' + monthDay(days[6]!)}</Text>
      </View>
      {entries.length > 0 && !canSubmit ? (
        <Text style={{ color: colors.textMutedDark, fontSize: 12 }}>This week is already submitted or approved. Tap Withdraw to change it.</Text>
      ) : null}
      {saveState === 'saved' && dirtyDays.length === 0 ? <Text>Saved.</Text> : null}
      {days.map((day) => {
        const dayEntries = entries.filter((e) => e.workDate === day);
        const total = dayEntries.reduce((s, e) => s + e.minutes, 0);
        const dayManual = dayEntries.filter((e) => e.source === 'manual');
        const locked = dayManual.length > 0 && !dayManual.some(editable);
        return (
          <Card key={day} style={{ marginVertical: 1, padding: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>{dayLabel(day) + '  —  ' + fmt(total)}</Text>
              <TextField
                value={inputs[day] ?? ''}
                onChangeText={(v) => {
                  setSaveState('idle');
                  setInputs((p) => ({ ...p, [day]: v }));
                }}
                placeholder="1.5 or 1:30"
                disabled={locked}
                dense
                style={{ width: 90 }}
              />
            </View>
            {dayEntries.map((e) => (
              <View key={e.id} style={{ marginVertical: 0, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1 }}>
                  {fmt(e.minutes) + ' · ' + e.source + ' · ' + e.status +
                    (e.status === 'rejected' && e.rejectionReason ? ' (' + e.rejectionReason + ')' : '')}
                </Text>
                {editable(e) ? (
                  <PayrollButton
                    label="Delete"
                    onPress={() => run(() => port.deleteEntry(e.id))}
                  />
                ) : null}
              </View>
            ))}
            {locked ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {dayManual.some((e) => e.status === 'submitted')
                  ? 'Submitted for approval. Tap Withdraw to change it.'
                  : 'Approved. Tap Withdraw to reopen it, then submit again after your changes.'}
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
      </Card>
    </View>
  );
}
