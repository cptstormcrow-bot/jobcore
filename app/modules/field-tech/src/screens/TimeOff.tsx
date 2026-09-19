/**
 * TimeOff screen for the field-tech module (P4 Wave 3 slice S3.6).
 *
 * Time-off request form + read-only "my requests" list. Deliberately
 * isolated from the job state machine: this screen never imports
 * `domain/transition.ts`, never imports `Job`/`JobStatus`/`applyTransition`/
 * `canTransition` from `@jobcore/core`, and never references the `jobs`
 * table/type in any way — it only deals with the tech's own time-off
 * requests via this module's `TimeOffRepository` port
 * (`../data/ports.ts`, already-declared `TimeOffRequest` /
 * `TimeOffRequestDraft` / `TimeOffRepository`).
 *
 * ZERO financial fields.
 *
 * Mirrors the house style of `Greeting.tsx` / `DayList.tsx` /
 * `FieldJobDetail.tsx`: session/ports resolved via `lib/module-session.ts`
 * and `lib/module-ports.ts`, never constructed locally.
 *
 * Workstream G also shows the tech's own upcoming assignments above the
 * request form, via `TechJobRepository.listAssignedToTech` (already
 * exposed on `ModulePorts.jobs`, same port `DayList.tsx` reads) — so a tech
 * can see what they'd be requesting time off against before submitting.
 * This does NOT violate the "never references the `jobs` table/type" rule
 * above in spirit: that rule is about the job STATE MACHINE (transitions),
 * not a read-only listing; `Job` is imported here purely to type that list,
 * mirroring `DayList.tsx`'s own read-only use of the same type.
 */

import * as React from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, Modal, KeyboardAvoidingView, Platform } from 'react-native';

import type { TimeOffRequest } from '../data/ports';
import { isActiveTimeOffStatus } from '../data/ports';
import { ScreenTitle, Button, colors, CalendarHeader, WeekView, MonthView, Select, type CalendarMode, type TimeOffEvent } from '@jobcore/ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { DateRangeCalendar } from './DateRangeCalendar';
import { expandTimeOffToEvents } from './DayList';
import { addDays, addMonths, format } from 'date-fns';

function todayIso(): string {
  const n = new Date();
  const m = String(n.getMonth() + 1).padStart(2, '0');
  const d = String(n.getDate()).padStart(2, '0');
  return `${n.getFullYear()}-${m}-${d}`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

/**
 * TimeOff screen: a request form (start date, end date, reason) plus a
 * read-only list of the signed-in tech's own prior requests. No
 * approve/deny affordance here — that is an org-admin concern enforced
 * elsewhere via RLS, per `TimeOffRepository`'s deliberately narrow shape.
 */
interface TimeOffProps {
  initialSelectedId?: string;
}

export function TimeOff({ initialSelectedId }: TimeOffProps): React.ReactElement {
  const session = getModuleSession();

  const [requests, setRequests] = React.useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const [showRequestModal, setShowRequestModal] = React.useState(false);

  const [techFilter, setTechFilter] = React.useState<string>(session === null ? 'all' : session.userId);
  const [techs, setTechs] = React.useState<{ id: string; fullName: string }[]>([]);

  React.useEffect(() => {
    if (session === null) return;
    let cancelled = false;
    getModulePorts()
      .techs.list(session.org.id)
      .then((result) => {
        if (!cancelled) setTechs(result);
      })
      .catch(() => {
        /* non-fatal: tech filter simply stays empty */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const loadRequests = React.useCallback(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const { timeOff } = getModulePorts();

    const result: Promise<TimeOffRequest[]> =
      techFilter === session.userId
        ? timeOff.listForTech(session.userId)
        : timeOff.listForOrg(session.org.id).then((all) => all.filter((r) => techFilter === 'all' || r.techId === techFilter));

    result
      .then((result) => {
        if (!cancelled) {
          setRequests(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load time-off requests.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, techFilter]);

  React.useEffect(() => {
    const cleanup = loadRequests();
    return cleanup;
  }, [loadRequests]);

  const activeRequests = React.useMemo(() => requests.filter((r) => r.endDate >= todayIso() && isActiveTimeOffStatus(r.status)), [requests]);
  const [calMode, setCalMode] = React.useState<CalendarMode>('month');
  const [anchorDay, setAnchorDay] = React.useState(new Date());
  const events = React.useMemo(() => expandTimeOffToEvents(activeRequests, new Date()), [activeRequests]);

  const selectedRequest = selectedId === null ? null : requests.find((r) => r.id === selectedId) ?? null;
  const isAdminAdded = selectedRequest !== null && selectedRequest.createdByAdminId !== null;

  const onPickEvent = (e: TimeOffEvent) => {
    const r = activeRequests.find((x) => e.id.startsWith(x.id + '-'));
    if (r && session !== null && r.techId === session.userId) select(r.id);
  };
  const onPickDay = () => {
    if (selectedId === null) setShowRequestModal(true);
  };

  function select(id: string): void {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setSelectedId(id);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
    setReason(r.reason ?? '');
    setSubmitError(null);
    setCancelError(null);
    setShowRequestModal(true);
  }

  function clearSelection(): void {
    setSelectedId(null);
    setStartDate('');
    setEndDate('');
    setReason('');
    setSubmitError(null);
    setShowRequestModal(false);
  }

  const closeModal = () => {
    if (selectedId !== null) clearSelection();
    else {
      setShowRequestModal(false);
      setSubmitError(null);
    }
  };

  React.useEffect(() => {
    if (initialSelectedId) select(initialSelectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedId]);

  const canSubmit = startDate.trim().length > 0 && endDate.trim().length > 0 && !submitting;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) {
      return;
    }

    if (session === null) {
      setSubmitError('No active session — cannot submit request.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const { timeOff } = getModulePorts();
      const trimmedReason = reason.trim();

      await timeOff.create(session.org.id, session.userId, {
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        reason: trimmedReason.length > 0 ? trimmedReason : null,
      });

      setStartDate('');
      setEndDate('');
      setReason('');
      setShowRequestModal(false);
      loadRequests();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit time-off request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId: string): Promise<void> {
    if (cancellingId !== null) {
      return;
    }

    setCancellingId(requestId);
    setCancelError(null);

    try {
      const { timeOff } = getModulePorts();
      await timeOff.cancel(requestId);
      loadRequests();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel time-off request.');
    } finally {
      setCancellingId(null);
    }
  }

  async function handleSave(): Promise<void> {
    if (selectedId === null || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { timeOff } = getModulePorts();
      const trimmedReason = reason.trim();
      await timeOff.update(selectedId, {
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        reason: trimmedReason.length > 0 ? trimmedReason : null,
      });
      loadRequests();
      clearSelection();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save time-off request.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (selectedId === null || cancellingId !== null) return;
    setCancellingId(selectedId);
    setCancelError(null);
    try {
      const { timeOff } = getModulePorts();
      await timeOff.cancel(selectedId);
      loadRequests();
      clearSelection();
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Failed to delete time-off request.');
    } finally {
      setCancellingId(null);
    }
  }

  if (session === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Sign in to request time off.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenTitle title="Time Off" />
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upcoming time off</Text>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : loadError !== null ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : activeRequests.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming time off.</Text>
        ) : (
          activeRequests.map((item) => (
            <Pressable key={item.id} onPress={() => select(item.id)} style={styles.upcomingRow}>
              <Text style={styles.upcomingText}>
                • {formatDate(item.startDate)} – {formatDate(item.endDate)}
              </Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Request time off</Text>
        <Select
          value={techFilter}
          options={[{ label: 'All Techs', value: 'all' }, ...techs.map((t) => ({ label: t.fullName, value: t.id }))]}
          onChange={setTechFilter}
        />
        <CalendarHeader
          mode={calMode}
          onModeChange={setCalMode}
          label={format(anchorDay, calMode === 'month' ? 'MMMM yyyy' : "'Week of' MMM d")}
          onPrev={() => setAnchorDay((d) => calMode === 'month' ? addMonths(d, -1) : addDays(d, -7))}
          onNext={() => setAnchorDay((d) => calMode === 'month' ? addMonths(d, 1) : addDays(d, 7))}
          onToday={() => setAnchorDay(new Date())}
        />
        {calMode === 'week' ? (
          <WeekView jobs={[]} anchorDay={anchorDay} timeOffEvents={events} onSelectTimeOff={onPickEvent} onSelectDay={onPickDay} />
        ) : (
          <MonthView variant="list" jobs={[]} anchorDay={anchorDay} timeOffEvents={events} onSelectTimeOff={onPickEvent} onSelectDay={onPickDay} />
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My requests</Text>
        {cancelError !== null ? <Text style={styles.errorText}>{cancelError}</Text> : null}
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : loadError !== null ? (
          <Text style={styles.errorText}>{loadError}</Text>
        ) : requests.length === 0 ? (
          <Text style={styles.emptyText}>No time-off requests yet.</Text>
        ) : (
          requests.map((item) => {
            const cancellable = item.status === 'pending' || item.status === 'approved';
            const cancelling = cancellingId === item.id;

            return (
              <View key={item.id} style={styles.requestRow}>
                <Text style={styles.requestDates}>
                  {formatDate(item.startDate)} – {formatDate(item.endDate)}
                </Text>
                <Text style={styles.requestStatus}>{item.status}</Text>
                {item.reason !== null ? <Text style={styles.requestReason}>{item.reason}</Text> : null}
                {cancellable ? (
                  <Button
                    label={cancelling ? 'Cancelling…' : 'Cancel'}
                    variant="outline"
                    disabled={cancelling}
                    onPress={() => handleCancel(item.id)}
                    style={styles.cancelButton}
                  />
                ) : null}
              </View>
            );
          })
        )}
      </View>
      </ScrollView>
      <Modal
        visible={showRequestModal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.overlay} onPress={closeModal}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{selectedRequest !== null ? 'Edit time off' : 'Request time off'}</Text>
              {isAdminAdded ? <Text style={styles.emptyText}>Added by your admin</Text> : null}
              <Text style={styles.modalRange}>
                {startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : ''}
              </Text>
              {selectedRequest !== null ? (
                <>
                  <Text style={styles.label}>Date range</Text>
                  <DateRangeCalendar
                    key={`edit-${selectedRequest.id}`}
                    startDate={startDate}
                    endDate={endDate}
                    onChangeStartDate={setStartDate}
                    onChangeEndDate={setEndDate}
                    disabled={submitting || isAdminAdded}
                    markedRanges={[]}
                  />
                </>
              ) : null}
              <Text style={styles.label}>Reason (optional)</Text>
              <TextInput
                style={[styles.input, styles.reasonInput]}
                value={reason}
                onChangeText={setReason}
                placeholder="Reason for time off"
                editable={!submitting && !isAdminAdded}
                multiline
              />
              {submitError !== null ? <Text style={styles.errorText}>{submitError}</Text> : null}
              {selectedRequest !== null && cancelError !== null ? <Text style={styles.errorText}>{cancelError}</Text> : null}
              <View style={styles.modalButtons}>
                <Button
                  label={isAdminAdded && selectedRequest !== null ? 'Close' : 'Cancel'}
                  variant="outline"
                  onPress={closeModal}
                  style={styles.cancelButton}
                />
                {selectedRequest === null ? (
                  <Button
                    label={submitting ? 'Submitting…' : 'Submit'}
                    disabled={!canSubmit}
                    onPress={handleSubmit}
                    style={styles.submitButton}
                  />
                ) : !isAdminAdded ? (
                  <>
                    <Button
                      label={cancellingId === selectedId ? 'Deleting…' : 'Delete'}
                      variant="outline"
                      disabled={cancellingId !== null || submitting}
                      onPress={handleDelete}
                      style={styles.cancelButton}
                    />
                    <Button
                      label={submitting ? 'Saving…' : 'Save'}
                      disabled={!canSubmit}
                      onPress={handleSave}
                      style={styles.submitButton}
                    />
                  </>
                ) : null}
              </View>
            </ScrollView>
          </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
  },
  reasonInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitButton: {
    marginTop: 12,
  },
  requestRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  requestDates: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestStatus: {
    fontSize: 12,
    color: colors.textMutedDark,
    marginTop: 2,
  },
  requestReason: {
    fontSize: 13,
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  upcomingRow: {
    paddingVertical: 4,
  },
  upcomingText: {
    fontSize: 13,
    color: colors.danger,
  },
  emptyText: {
    color: colors.textMutedDark,
  },
  errorText: {
    color: colors.danger,
    marginTop: 8,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheetWrap: { width: '100%', maxHeight: '90%' },
  sheet: { width: '100%', flexShrink: 1, backgroundColor: colors.white, borderRadius: 8, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  modalRange: { fontSize: 15, marginBottom: 8 },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
