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
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Card, ListItem, Button, EmptyState, LoadingState, ErrorState, colors, spacing, radius, typography } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import type { JobPlanningDetails, JobPlanningPhoto, JobPlanningRepository, JobPlanningPhotoRepository } from '../data/ports';
import { getModulePorts } from '../lib/module-ports';

export interface PlanningScreenProps {
  jobs: Job[];
  jobPlanning?: JobPlanningRepository;
  jobPlanningPhotos?: JobPlanningPhotoRepository;
  initialSelectedJobId?: string;
  onBack?: () => void;
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

export function PlanningScreen({ jobs, jobPlanning: jobPlanningProp, jobPlanningPhotos: jobPlanningPhotosProp, initialSelectedJobId, onBack }: PlanningScreenProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialSelectedJobId ?? null);
  const [detailsLoadState, setDetailsLoadState] = useState<DetailsLoadState>({ kind: 'idle' });
  const [details, setDetails] = useState<JobPlanningDetails | null>(null);

  const [modelNumbers, setModelNumbers] = useState('');
  const [partsList, setPartsList] = useState('');
  const [measurements, setMeasurements] = useState('');
  const [instructions, setInstructions] = useState('');

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
        setDetails(result);
        setModelNumbers(result?.modelNumbers ?? '');
        setPartsList(result?.partsList ?? '');
        setMeasurements(result?.measurements ?? '');
        setInstructions(result?.instructions ?? '');
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.backRow}>
          <Button label={onBack ? 'Back to Job' : 'Back to job list'} variant="outline" size="sm" onPress={onBack ?? (() => setSelectedJobId(null))} />
        </View>

        <Card style={styles.card}>
          <Text style={styles.title}>{selectedJob?.address ?? selectedJob?.description ?? selectedJobId}</Text>

          {detailsLoadState.kind === 'loading' || detailsLoadState.kind === 'idle' ? (
            <LoadingState label="Loading planning details..." />
          ) : detailsLoadState.kind === 'failed' ? (
            <ErrorState message={detailsLoadState.message} />
          ) : (
            <>
              <Text style={styles.guidance}>Note what you'd need on-site: model numbers, measurements, parts, access notes.</Text>

              <Text style={styles.label}>Model Numbers</Text>
              <TextInput
                style={styles.notesInput}
                value={modelNumbers}
                onChangeText={setModelNumbers}
                placeholder="e.g. Trane XR16, model # ..."
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Parts List</Text>
              <TextInput
                style={styles.notesInput}
                value={partsList}
                onChangeText={setPartsList}
                placeholder="List parts needed for this job"
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Measurements</Text>
              <TextInput
                style={styles.notesInput}
                value={measurements}
                onChangeText={setMeasurements}
                placeholder="Dimensions, clearances, etc."
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Instructions</Text>
              <TextInput
                style={styles.notesInput}
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Step-by-step notes for the assigned tech"
                placeholderTextColor={colors.textLight}
                multiline
                textAlignVertical="top"
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
      </ScrollView>
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
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
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
