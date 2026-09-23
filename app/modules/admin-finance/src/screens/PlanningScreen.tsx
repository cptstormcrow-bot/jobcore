/**
 * Job planning screen.
 *
 * "Planning" is the process step between a job being created/qualified and
 * it being assigned to a tech: requirements gathering — model numbers,
 * parts list, measurements, and step-by-step instructions — plus reference
 * photos, all captured against the job so the assigned tech has everything
 * needed before the visit. Sits alongside `AdminFinanceRoot.tsx`'s other
 * sub-views but is self-contained: it receives the already-loaded `jobs`
 * list as a prop (mirrors `LeadInboxScreen.tsx`/`PriceSheetListScreen.tsx`'s
 * props-driven pattern) and self-injects the planning ports via
 * `getModulePorts()` (mirrors `LeadCreateScreen.tsx`'s self-injection
 * pattern) rather than taking them as props too.
 *
 * Two-pane flow: a job picker (`Card`/`ListItem` list, `AdminFinanceRoot`'s
 * job-list rendering) followed by a per-job form once a job is selected.
 * The empty-state gate for "no planning details yet" is skipped in favor of
 * always showing the form pre-filled empty once a job is selected — simpler
 * than branching on `details === null` before rendering inputs, and still
 * satisfies "an empty state has an add action" because the no-jobs-at-all
 * case (`jobs.length === 0`) is the one or that actually blocks the user,
 * and that one has no action per this screen's spec (job creation lives on
 * the Jobs tab, not here).
 *
 * Photo capture is a stub in this pass: `handleAddPhoto` calls
 * `jobPlanningPhotos.addForJob` with a placeholder `storagePath` — real
 * device photo-picker integration (camera roll / camera capture, actual
 * upload to storage) is a forward contract, not built here.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Card, ListItem, Button, Select, EmptyState, LoadingState, ErrorState, TextField, colors, spacing, radius, typography, Text } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import type { JobPlanningDetails, JobPlanningPhoto, JobPlanningRepository, JobPlanningPhotoRepository, JobInvestigation, JobPlanTasksRepository, JobPlanTaskRow, ServiceTaskCatalogEntry } from '../data/ports';
import { getModulePorts } from '../lib/module-ports';
import { getModuleSession } from '../lib/module-session';
import { seedPlanningFromInvestigation } from '../domain/job-detail-helpers';

export interface PlanningScreenProps {
  jobs: Job[];
  jobPlanning?: JobPlanningRepository;
  jobPlanningPhotos?: JobPlanningPhotoRepository;
  jobPlanTasks: JobPlanTasksRepository;
  initialSelectedJobId?: string;
  onBack?: () => void;
  /** Inlined inside a host screen's own scroll view: suppresses the Back row and renders a plain `View` root instead of `ScrollView`. */
  embedded?: boolean;
  /** When provided, backfills any null planning fields from this investigation's findings once details load (editable pre-filled copy — user edits win). */
  investigationSeed?: JobInvestigation | null;
  /** Org's price-sheet standard duration (minutes), when known; shown alongside the tasks' total duration for comparison. */
  standardMinutes?: number;
}

type DetailsLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'failed'; message: string };

/** Local, honest formatter — @jobcore/ui has no date formatter of its own. */
function formatDate(iso: string | null): string {
  if (!iso) return 'Unscheduled';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return 'Unscheduled';
  return parsed.toLocaleDateString();
}

function TaskListSection({ jobId, jobPlanTasks, standardMinutes }: { jobId: string; jobPlanTasks: JobPlanTasksRepository; standardMinutes?: number }) {
  const [rows, setRows] = useState<JobPlanTaskRow[]>([]);
  const [catalog, setCatalog] = useState<ServiceTaskCatalogEntry[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const session = getModuleSession();
    if (!session) {
      setLoading(false);
      return;
    }
    const organizationId = session.org.id;
    Promise.all([jobPlanTasks.listForJob(jobId), jobPlanTasks.listCatalogTasks(organizationId)])
      .then(([taskRows, catalogTasks]) => {
        if (cancelled) return;
        setRows(taskRows);
        setCatalog(catalogTasks);
        setQuantityDrafts(Object.fromEntries(taskRows.map((r) => [r.id, String(r.quantity)])));
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load tasks.');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, jobPlanTasks]);

  async function handleAddTask(serviceTaskId: string) {
    try {
      const row = await jobPlanTasks.addTask(jobId, serviceTaskId, 1);
      setRows((prev) => [...prev, row]);
      setQuantityDrafts((prev) => ({ ...prev, [row.id]: String(row.quantity) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add task.');
    }
  }

  async function handleQuantityBlur(rowId: string) {
    if (savingRowId === rowId) {
      return;
    }
    const draft = quantityDrafts[rowId];
    const quantity = Number(draft);
    if (!draft || Number.isNaN(quantity) || quantity <= 0) {
      return;
    }
    setSavingRowId(rowId);
    try {
      const updated = await jobPlanTasks.updateQuantity(rowId, quantity);
      setRows((prev) => prev.map((r) => (r.id === rowId ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save quantity.');
    } finally {
      setSavingRowId(null);
    }
  }

  async function handleRemove(rowId: string) {
    try {
      await jobPlanTasks.removeTask(rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setQuantityDrafts((prev) => {
        const next = { ...prev };
        delete next[rowId];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove task.');
    }
  }

  const totalMinutes = rows.reduce((sum, r) => sum + (r.estimatedMinutes ?? 0) * r.quantity, 0);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <>
      {error && <ErrorState message={error} />}
      <Select
        options={catalog.map((t) => ({ label: t.name, value: t.id }))}
        value={null}
        placeholder="Add task..."
        onChange={(taskId) => {
          if (taskId) {
            void handleAddTask(taskId);
          }
        }}
      />
      {rows.length === 0 ? (
        <EmptyState title="No tasks added yet." />
      ) : (
        rows.map((row) => (
          <View key={row.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text>{row.name}</Text>
            <TextInput
              style={{ width: 60, textAlign: 'center' }}
              keyboardType="numeric"
              value={quantityDrafts[row.id] ?? String(row.quantity)}
              onChangeText={(text) => setQuantityDrafts((prev) => ({ ...prev, [row.id]: text }))}
              onBlur={() => void handleQuantityBlur(row.id)}
            />
            <Button label="Remove" onPress={() => void handleRemove(row.id)} />
          </View>
        ))
      )}
      <Text>Total duration: {totalMinutes} min (standard: {standardMinutes ?? 60} min)</Text>
    </>
  );
}

export function PlanningScreen({ jobs, jobPlanning: jobPlanningProp, jobPlanningPhotos: jobPlanningPhotosProp, jobPlanTasks, initialSelectedJobId, onBack, embedded, investigationSeed, standardMinutes }: PlanningScreenProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialSelectedJobId ?? null);
  const [detailsLoadState, setDetailsLoadState] = useState<DetailsLoadState>({ kind: 'idle' });
  const [details, setDetails] = useState<JobPlanningDetails | null>(null);

  const [modelNumbers, setModelNumbers] = useState('');
  const [partsList, setPartsList] = useState('');
  const [measurements, setMeasurements] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingressNotes, setIngressNotes] = useState('');
  const [logisticsNotes, setLogisticsNotes] = useState('');
  const [parkingNotes, setParkingNotes] = useState('');
  const [stateAssessment, setStateAssessment] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<JobPlanningPhoto[]>([]);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }
    const jobPlanning = jobPlanningProp ?? getModulePorts().jobPlanning;
    const jobPlanningPhotos = jobPlanningPhotosProp ?? getModulePorts().jobPlanningPhotos;
    let cancelled = false;
    setDetailsLoadState({ kind: 'loading' });
    setSaveError(null);
    setPhotosError(null);

    jobPlanning
      .getForJob(selectedJobId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        const seeded = seedPlanningFromInvestigation(
          {
            ingressNotes: result?.ingressNotes ?? null,
            logisticsNotes: result?.logisticsNotes ?? null,
            parkingNotes: result?.parkingNotes ?? null,
            stateAssessment: result?.stateAssessment ?? null,
          },
          investigationSeed,
        );
        setDetails(result);
        setModelNumbers(result?.modelNumbers ?? '');
        setPartsList(result?.partsList ?? '');
        setMeasurements(result?.measurements ?? '');
        setInstructions(result?.instructions ?? '');
        setIngressNotes(seeded.ingressNotes ?? '');
        setLogisticsNotes(seeded.logisticsNotes ?? '');
        setParkingNotes(seeded.parkingNotes ?? '');
        setStateAssessment(seeded.stateAssessment ?? '');
        setDetailsLoadState({ kind: 'loaded' });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load planning details.';
          setDetailsLoadState({ kind: 'failed', message });
        }
      });

    jobPlanningPhotos
      .listForJob(selectedJobId)
      .then((result) => {
        if (!cancelled) {
          setPhotos(result);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load photos.';
          setPhotosError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedJobId]);

  if (jobs.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="No jobs to plan" message="Create a job first, then add planning details here." />
      </View>
    );
  }

  if (!selectedJobId) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card style={styles.card}>
            {jobs.map((job) => (
              <ListItem
                key={job.id}
                title={job.address ?? job.description ?? job.id}
                subtitle={formatDate(job.scheduledStart)}
                onPress={() => setSelectedJobId(job.id)}
              />
            ))}
          </Card>
        </ScrollView>
      </View>
    );
  }

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  async function handleSave() {
    if (!selectedJobId || saving) {
      return;
    }
    const jobPlanning = jobPlanningProp ?? getModulePorts().jobPlanning;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await jobPlanning.upsertForJob(selectedJobId, {
        modelNumbers: modelNumbers.trim() || null,
        partsList: partsList.trim() || null,
        measurements: measurements.trim() || null,
        instructions: instructions.trim() || null,
        ingressNotes: ingressNotes.trim() || null,
        logisticsNotes: logisticsNotes.trim() || null,
        parkingNotes: parkingNotes.trim() || null,
        stateAssessment: stateAssessment.trim() || null,
      });
      setDetails(saved);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save planning details.';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPhoto() {
    if (!selectedJobId || addingPhoto) {
      return;
    }
    const jobPlanningPhotos = jobPlanningPhotosProp ?? getModulePorts().jobPlanningPhotos;
    setAddingPhoto(true);
    setPhotosError(null);
    try {
      // Stub: no device photo-picker exists yet in this pass — real camera
      // roll / capture integration and storage upload is a forward
      // contract, not built here. This wires the write path end-to-end
      // with a placeholder storage path so the screen and repository are
      // exercised.
      const photo = await jobPlanningPhotos.addForJob(selectedJobId, {
        storagePath: `pending/${selectedJobId}/${Date.now()}.jpg`,
        caption: null,
      });
      setPhotos((current) => [...current, photo]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not add photo.';
      setPhotosError(message);
    } finally {
      setAddingPhoto(false);
    }
  }

  const Root = embedded ? View : ScrollView;
  const rootProps = embedded ? {} : { contentContainerStyle: styles.content };

  return (
    <View style={styles.screen}>
      <Root {...rootProps}>
        {!embedded && (
          <View style={styles.backRow}>
            <Button label={onBack ? 'Back to Job' : 'Back to job list'} variant="outline" size="sm" onPress={onBack ?? (() => setSelectedJobId(null))} />
          </View>
        )}

        <Card style={styles.card}>
          {!embedded && (
            <Text style={styles.title}>{selectedJob?.address ?? selectedJob?.description ?? selectedJobId}</Text>
          )}

          {detailsLoadState.kind === 'loading' || detailsLoadState.kind === 'idle' ? (
            <LoadingState label="Loading planning details..." />
          ) : detailsLoadState.kind === 'failed' ? (
            <ErrorState message={detailsLoadState.message} />
          ) : (
            <>
              <Text style={styles.guidance}>Note what you&apos;d need on-site: model numbers, measurements, parts, access notes.</Text>

              <TextField
                label="Model Numbers"
                value={modelNumbers}
                onChangeText={setModelNumbers}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="e.g. Trane XR16, model # ..."
                multiline
              />

              <TextField
                label="Parts List"
                value={partsList}
                onChangeText={setPartsList}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="List parts needed for this job"
                multiline
              />

              <TextField
                label="Measurements"
                value={measurements}
                onChangeText={setMeasurements}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="Dimensions, clearances, etc."
                multiline
              />

              <TextField
                label="Instructions"
                value={instructions}
                onChangeText={setInstructions}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="Step-by-step notes for the assigned tech"
                multiline
              />

              <TextField
                label="Ingress Notes"
                value={ingressNotes}
                onChangeText={setIngressNotes}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="How to access the site"
                multiline
              />

              <TextField
                label="Logistics Notes"
                value={logisticsNotes}
                onChangeText={setLogisticsNotes}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="Logistics considerations for the visit"
                multiline
              />

              <TextField
                label="Parking Notes"
                value={parkingNotes}
                onChangeText={setParkingNotes}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="Where to park"
                multiline
              />

              <TextField
                label="State Assessment"
                value={stateAssessment}
                onChangeText={setStateAssessment}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="Current state of the site/system"
                multiline
              />

              {saveError && <Text style={styles.errorText}>{saveError}</Text>}

              <View style={styles.actions}>
                <Button
                  label={saving ? 'Saving...' : 'Save'}
                  onPress={() => {
                    void handleSave();
                  }}
                  disabled={saving}
                  style={styles.action}
                />
              </View>

              {details === null && (
                <Text style={styles.hintText}>No planning details saved yet — fill in the fields above and save.</Text>
              )}
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Tasks</Text>
          <TaskListSection jobId={selectedJobId as string} jobPlanTasks={jobPlanTasks} standardMinutes={standardMinutes} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.title}>Photos</Text>
          {photosError && <Text style={styles.errorText}>{photosError}</Text>}
          {photos.length === 0 ? (
            <Text style={styles.hintText}>No photos added yet.</Text>
          ) : (
            photos.map((photo) => (
              <ListItem key={photo.id} title={photo.caption ?? photo.storagePath} subtitle={formatDate(photo.createdAt)} />
            ))
          )}
          <View style={styles.actions}>
            <Button
              label={addingPhoto ? 'Adding...' : 'Add Photo'}
              variant="outline"
              onPress={() => {
                void handleAddPhoto();
              }}
              disabled={addingPhoto}
              style={styles.action}
            />
          </View>
        </Card>
      </Root>
    </View>
  );
}

export default PlanningScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    marginBottom: spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    marginBottom: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  guidance: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  notesInput: {
    minHeight: spacing.xl * 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  action: {
    marginLeft: spacing.sm,
  },
});
