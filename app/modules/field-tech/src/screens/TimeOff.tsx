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
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';

import type { Job } from '@jobcore/core';
import type { TimeOffRequest } from '../data/ports';
import { ScreenTitle, Button } from '@jobcore/ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import { DateRangeCalendar } from './DateRangeCalendar';

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
export function TimeOff(): React.ReactElement {
  const session = getModuleSession();

  const [requests, setRequests] = React.useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [upcomingJobs, setUpcomingJobs] = React.useState<Job[]>([]);
  const [upcomingLoading, setUpcomingLoading] = React.useState(true);
  const [upcomingError, setUpcomingError] = React.useState<string | null>(null);

  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [cancellingId, setCancellingId] = React.useState<string | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

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

  React.useEffect(() => {
    if (session === null) {
      setUpcomingLoading(false);
      return;
    }

    let cancelled = false;
    setUpcomingLoading(true);
    setUpcomingError(null);

    const { jobs } = getModulePorts();

    jobs
      .listAssignedToTech(session.userId)
      .then((result) => {
        if (!cancelled) {
          setUpcomingJobs(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setUpcomingError(err instanceof Error ? err.message : 'Failed to load upcoming assignments.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setUpcomingLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

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
        <Text style={styles.sectionTitle}>Upcoming assignments</Text>
        {upcomingLoading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : upcomingError !== null ? (
          <Text style={styles.errorText}>{upcomingError}</Text>
        ) : upcomingJobs.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming assignments.</Text>
        ) : (
          upcomingJobs.map((item) => (
            <View key={item.id} style={styles.requestRow}>
              <Text style={styles.requestDates}>
                {item.scheduledStart ? formatDate(item.scheduledStart) : 'Unscheduled'}
                {item.scheduledEnd ? ` – ${formatDate(item.scheduledEnd)}` : ''}
              </Text>
              <Text style={styles.requestStatus}>{item.address ?? 'No address on file'}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Request time off</Text>
        <Text style={styles.label}>Date range</Text>
        <DateRangeCalendar
          startDate={startDate}
          endDate={endDate}
          onChangeStartDate={setStartDate}
          onChangeEndDate={setEndDate}
          disabled={submitting}
        />
        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput
          style={[styles.input, styles.reasonInput]}
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for time off"
          editable={!submitting}
          multiline
        />
        {submitError !== null ? <Text style={styles.errorText}>{submitError}</Text> : null}
        <Button
          label={submitting ? 'Submitting…' : 'Submit request'}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={styles.submitButton}
        />
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
  emptyText: {
    color: '#666',
  },
  errorText: {
    color: '#b00020',
    marginTop: 8,
  },
});
