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
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable, Modal } from 'react-native';

import type { TimeOffRequest } from '../data/ports';
import { isActiveTimeOffStatus } from '../data/ports';
import { ScreenTitle, Button, colors } from '@jobcore/ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { DateRangeCalendar } from './DateRangeCalendar';

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

  const loadRequests = React.useCallback(() => {
    if (session === null) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    const { timeOff } = getModulePorts();

    timeOff
      .listForTech(session.userId)
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
  }, [session]);

  React.useEffect(() => {
    const cleanup = loadRequests();
    return cleanup;
  }, [loadRequests]);

  const activeRequests = React.useMemo(() => requests.filter((r) => r.endDate >= todayIso() && isActiveTimeOffStatus(r.status)), [requests]);

  const selectedRequest = selectedId === null ? null : requests.find((r) => r.id === selectedId) ?? null;
  const isAdminAdded = selectedRequest !== null && selectedRequest.createdByAdminId !== null;

  function select(id: string): void {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    setSelectedId(id);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
    setReason(r.reason ?? '');
    setSubmitError(null);
  }

  function clearSelection(): void {
    setSelectedId(null);
    setStartDate('');
    setEndDate('');
    setReason('');
    setSubmitError(null);
    setShowRequestModal(false);
  }

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
        <Text style={styles.sectionTitle}>{selectedId !== null ? 'Editing time off' : 'Request time off'}</Text>
        {isAdminAdded ? <Text style={styles.emptyText}>Added by your admin</Text> : null}
        <Text style={styles.label}>Date range</Text>
        <DateRangeCalendar
          key={selectedId ?? 'new'}
          startDate={startDate}
          endDate={endDate}
          onChangeStartDate={setStartDate}
          onChangeEndDate={setEndDate}
          disabled={submitting || isAdminAdded}
          onSelectMarkedDay={(id) => select(id)}
          onDayTapped={() => { if (selectedId === null) setShowRequestModal(true); }}
          markedRanges={activeRequests.map((r) => ({ id: r.id, startDate: r.startDate, endDate: r.endDate }))}
        />
        {selectedId !== null ? (
        <Text style={styles.label}>Reason (optional)</Text>
        ) : null}
        {selectedId !== null ? (
        <TextInput
          style={[styles.input, styles.reasonInput]}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for time off"
          editable={!submitting && !isAdminAdded}
          multiline
        />
        ) : null}
        {selectedId !== null && submitError !== null ? <Text style={styles.errorText}>{submitError}</Text> : null}
        {selectedId !== null && !isAdminAdded ? (
        <>
        <Button label={submitting ? 'Saving…' : 'Save'} disabled={submitting} onPress={handleSave} style={styles.submitButton} />
        <Button label={cancellingId === selectedId ? 'Deleting…' : 'Delete'} variant="outline" disabled={cancellingId !== null} onPress={handleDelete} style={styles.cancelButton} />
        </>
        ) : null}
        {selectedId !== null ? (
        <Button label="Cancel edit" variant="outline" onPress={clearSelection} style={styles.cancelButton} />
        ) : null}
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
        onRequestClose={() => setShowRequestModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowRequestModal(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.modalTitle}>Request time off</Text>
            <Text style={styles.modalRange}>
              {startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : ''}
            </Text>
            <Text style={styles.label}>Reason (optional)</Text>
            <TextInput
              style={[styles.input, styles.reasonInput]}
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for time off"
              multiline
            />
            {submitError !== null ? <Text style={styles.errorText}>{submitError}</Text> : null}
            <View style={styles.modalButtons}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => setShowRequestModal(false)}
                style={styles.cancelButton}
              />
              <Button
                label={submitting ? 'Submitting…' : 'Submit'}
                disabled={!canSubmit}
                onPress={handleSubmit}
                style={styles.submitButton}
              />
            </View>
          </Pressable>
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
    color: '#777',
    marginTop: 6,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ccc',
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
    borderBottomColor: '#ddd',
  },
  requestDates: {
    fontSize: 14,
    fontWeight: '600',
  },
  requestStatus: {
    fontSize: 12,
    color: '#666',
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
    color: '#666',
  },
  errorText: {
    color: '#b00020',
    marginTop: 8,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', backgroundColor: '#fff', borderRadius: 8, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  modalRange: { fontSize: 15, marginBottom: 8 },
  modalButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
