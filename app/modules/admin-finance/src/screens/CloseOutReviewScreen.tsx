/**
 * Close-out review screen (P3h.3a, P3h.3b).
 *
 * Capture half of close-out review for a single job: photos and quality
 * notes (P3h.3a). This slice (P3h.3b) wires the close ACTION alongside it:
 * the screen asks `domain/closeout.ts`'s `closeOutBlockers(job, ctx)` for
 * the job's blocker reasons (rendered verbatim — no rewording, wrapping, or
 * truncation, per that function's own doc comment) and renders a primary
 * "Close out job" button, disabled while any blockers remain. This screen
 * still never calls `applyTransition` and never imports `state-machine.ts`
 * directly (ESLint `no-restricted-imports`, P3-f AC-4) — pressing the button
 * fires the `onCloseOut` callback with the job, and the caller (which owns
 * the repository) is the one that routes the write through
 * `domain/transition.ts`'s `transitionJob`. It also never restates or
 * compares against status as a literal (`status === '...'` appears nowhere
 * in this file).
 *
 * `data/ports.ts` (P3d.1) declares no dedicated photo/attachment/notes
 * repository port yet, so this screen follows the same props-in/
 * callbacks-out pattern `CloseOutQueueScreen.tsx`/`AssignmentBoardScreen.tsx`
 * already use: it never imports sqlite/fetch/Supabase and never resolves
 * `Ctx` itself — `ctx` arrives as a prop, used only to compute blockers. The
 * caller (which owns the repository) hands in the job's current
 * photos/notes as props and receives capture events through
 * `onAddPhoto`/`onRemovePhoto`/`onChangeNotes` callbacks and the close event
 * through `onCloseOut` — this screen holds no persistence of its own.
 *
 * Composed entirely from `@jobcore/ui` primitives plus React Native's
 * `TextInput`/`Image` (`@jobcore/ui` exports no text-input or photo-picker
 * primitive yet — checked `packages/ui/src/index.ts`); styled purely from
 * tokens — no raw color/spacing/typography literals.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput, Image, Pressable } from 'react-native';
import type { Ctx, Job } from '@jobcore/core';
import { Card, EmptyState, Button, ScreenTitle, colors, spacing, radius, typography } from '@jobcore/ui';
import { closeOutBlockers } from '../domain/closeout';

/** One captured close-out photo. Caller owns storage/upload; this screen only displays and removes. */
export interface CloseOutPhoto {
  id: string;
  uri: string;
}

export interface CloseOutReviewScreenProps {
  job: Job | null;
  ctx: Ctx;
  /** Photos already captured for this job's close-out review. */
  photos: CloseOutPhoto[];
  /** Quality notes already captured for this job's close-out review. */
  notes: string;
  /** Fired when the tech/admin adds a new photo (caller owns the picker/camera call). */
  onAddPhoto?: () => void;
  /** Fired when a captured photo is removed. */
  onRemovePhoto?: (photoId: string) => void;
  /** Fired on every edit to the notes text. */
  onChangeNotes?: (notes: string) => void;
  /** Fired when the primary close action is pressed; disabled while blockers remain. */
  onCloseOut?: (job: Job) => void;
}

export function CloseOutReviewScreen({
  job,
  ctx,
  photos,
  notes,
  onAddPhoto,
  onRemovePhoto,
  onChangeNotes,
  onCloseOut,
}: CloseOutReviewScreenProps) {
  const blockers = useMemo(() => (job ? closeOutBlockers(job, ctx) : []), [job, ctx]);

  if (!job) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Close-out review" message="No job selected." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Close-Out Review" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.headerCard}>
          <Text style={styles.jobTitle}>{job.address ?? 'No address on file'}</Text>
          <Text style={styles.jobStatus}>{job.status.replace(/_/g, ' ')}</Text>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          {photos.length === 0 ? (
            <Text style={styles.empty}>No photos captured yet.</Text>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  <Pressable onPress={() => onRemovePhoto?.(photo.id)}>
                    <Text style={styles.photoRemove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Button label="Add photo" onPress={() => onAddPhoto?.()} variant="secondary" size="sm" />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Quality notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={(text) => onChangeNotes?.(text)}
            placeholder="Describe the completed work, any issues, or follow-up needed..."
            placeholderTextColor={colors.textLight}
            multiline
            textAlignVertical="top"
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Close out</Text>
          {blockers.length === 0 ? (
            <Text style={styles.ready}>Ready to advance.</Text>
          ) : (
            blockers.map((reason, index) => (
              <Text key={index} style={styles.blocker}>
                {reason}
              </Text>
            ))
          )}
          <Button
            label="Close out job"
            onPress={() => onCloseOut?.(job)}
            disabled={blockers.length > 0}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

export default CloseOutReviewScreen;

/** Renders when no data is supplied — mirrors `CloseOutQueueScreenEmpty`'s no-data-source guard. */
export function CloseOutReviewScreenEmpty() {
  return (
    <View style={styles.screen}>
      <EmptyState title="Close-out review" message="No job selected." />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  headerCard: {
    marginBottom: spacing.md,
  },
  jobTitle: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  jobStatus: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    textTransform: 'capitalize',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },
  empty: {
    color: colors.textLight,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  photoTile: {
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  photoImage: {
    width: spacing.xl * 2,
    height: spacing.xl * 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xs,
  },
  photoRemove: {
    color: colors.warning,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
  },
  notesInput: {
    minHeight: spacing.xl * 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    padding: spacing.sm,
  },
  ready: {
    color: colors.success,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  blocker: {
    color: colors.warning,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
});
