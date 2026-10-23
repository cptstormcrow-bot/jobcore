// JobCore screen #0018 - af-closeOutReview - Close-Out Review
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

import React, { useMemo, useState, type ReactNode } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Image, Pressable } from 'react-native';
import type { Ctx, Job } from '@jobcore/core';
import * as Clipboard from 'expo-clipboard';
import { Card, EmptyState, Button, ScreenTitle, JobHeaderBlock, JobTitleBarHeader, DefaultTabBar, formatJobHeaderLines, formatScheduleLabel, colors, spacing, radius, typography, Text } from '@jobcore/ui';
import { closeOutBlockers } from '../domain/closeout';
import type { JobTimelineItem } from '../domain/job-timeline';
import type { CustomerJobHistoryItem } from '../data/ports';

/** One captured close-out photo. Caller owns storage/upload; this screen only displays and removes. */
export interface CloseOutPhoto {
  id: string;
  uri: string;
  storagePath?: string;
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
  /** Fired when the customer-contact "Contact" button is pressed. */
  onContact?: (jobId: string) => void;
  /** Total hours logged to the job. */
  hoursLogged?: number;
  /** Tech payouts for the job. */
  techPayouts?: { techName: string; amount: number; basis: 'hourly' | 'commission' }[];
  /** Contractor payouts for the job. */
  contractorPayouts?: { contractorName: string; amount: number }[];
  /** Itemized customer contacts (e.g. phone/email/alt-phone). */
  customerContacts?: { label: string; value: string }[];
  /** The customer's other jobs, newest first as supplied; read-only. */
  jobHistory?: ReadonlyArray<CustomerJobHistoryItem>;
  /** Hosted inside the job page: no title, no flex root, no nested scroller. */
  embedded?: boolean;
  /** Opens the calendar from the title bar's schedule link; absent means the label is plain text. */
  onOpenCalendar?: () => void;
  /** Job activity trail, already in ascending order; read-only. */
  timeline?: JobTimelineItem[];
  /** Optional extra content rendered under each photo's image. */
  renderPhotoExtra?: (photo: CloseOutPhoto) => ReactNode;
}

type CloseOutTab = 'hours' | 'payouts' | 'contacts' | 'photos' | 'notes' | 'trail' | 'closeout';

const CLOSE_OUT_TABS: Array<{ id: CloseOutTab; label: string }> = [
  { id: 'hours', label: 'Hours' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'photos', label: 'Photos' },
  { id: 'notes', label: 'Notes' },
  { id: 'trail', label: 'Trail' },
  { id: 'closeout', label: 'Close out' },
];

export function CloseOutReviewScreen({
  job,
  ctx,
  photos,
  notes,
  onAddPhoto,
  onRemovePhoto,
  onChangeNotes,
  onCloseOut,
  onContact,
  hoursLogged,
  techPayouts,
  contractorPayouts,
  customerContacts,
  jobHistory,
  embedded,
  onOpenCalendar,
  timeline,
  renderPhotoExtra,
}: CloseOutReviewScreenProps) {
  const [activeTab, setActiveTab] = useState<CloseOutTab>('hours');
  const blockers = useMemo(() => (job ? closeOutBlockers(job, ctx) : []), [job, ctx]);

  if (!job) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Close-out review" message="No job selected." />
      </View>
    );
  }

  // Embedded: host page owns scrolling and header, so no flex root, title or nested ScrollView.
  const Body: React.ComponentType<any> = embedded ? View : ScrollView;
  const bodyProps = embedded ? {} : { contentContainerStyle: styles.content };

  return (
    <View style={embedded ? undefined : styles.screen}>
      <ScreenTitle title="Close-Out #0018" />
      {embedded ? null : (
        <View style={styles.fixedTop}>
          <View style={styles.headerCard}>
            <JobTitleBarHeader
              framed
              inset={5}
              jobLine={formatJobHeaderLines(job.jobNumber, job.createdAt).jobLine}
              dateLine={formatJobHeaderLines(job.jobNumber, job.createdAt).dateLine}
              scheduleLabel={formatScheduleLabel(job.scheduledStart)}
              onSchedulePress={onOpenCalendar}
              customerName={job.customerName}
              address={job.address}
              phone={job.customerPhone}
              ingressCode={job.ingressInstructions}
              onCopy={async (text) => {
                await Clipboard.setStringAsync(text);
              }}
            />
            <JobHeaderBlock
              hideJobLine
              jobNumber={job.jobNumber}
              createdAt={job.createdAt}
              scheduledStart={job.scheduledStart}
            >
              <Text style={styles.jobStatus}>{job.status.replace(/_/g, ' ')}</Text>
            </JobHeaderBlock>
          </View>
          <DefaultTabBar tabs={CLOSE_OUT_TABS} activeId={activeTab} onChange={setActiveTab} />
        </View>
      )}
      <Body {...bodyProps}>
        {embedded ? (
          <>
            <Text style={styles.jobStatus}>{job.status.replace(/_/g, ' ')}</Text>
            <DefaultTabBar tabs={CLOSE_OUT_TABS} activeId={activeTab} onChange={setActiveTab} />
          </>
        ) : null}
        <View style={styles.actionRow}>
          <Button label="Contact" onPress={() => onContact?.(job.id)} variant="secondary" size="sm" />
          <Button label="Add photo" onPress={() => onAddPhoto?.()} variant="secondary" size="sm" />
          <Button
            label="Close out job"
            onPress={() => onCloseOut?.(job)}
            disabled={blockers.length > 0}
            size="sm"
          />
        </View>
        {activeTab === 'hours' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Hours logged</Text>
          {hoursLogged ? (
            <Text style={styles.body}>{hoursLogged.toFixed(1)} hrs</Text>
          ) : (
            <Text style={styles.empty}>No hours logged.</Text>
          )}
        </Card>
        ) : null}
        {activeTab === 'payouts' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Payouts</Text>
          <Text style={styles.subTitle}>Tech payouts</Text>
          {!techPayouts || techPayouts.length === 0 ? (
            <Text style={styles.empty}>None</Text>
          ) : (
            techPayouts.map((payout, index) => (
              <Text key={index} style={styles.body}>
                {payout.techName} ({payout.basis}): ${payout.amount.toFixed(2)}
              </Text>
            ))
          )}
          <Text style={styles.subTitle}>Contractor payouts</Text>
          {!contractorPayouts || contractorPayouts.length === 0 ? (
            <Text style={styles.empty}>None</Text>
          ) : (
            contractorPayouts.map((payout, index) => (
              <Text key={index} style={styles.body}>
                {payout.contractorName}: ${payout.amount.toFixed(2)}
              </Text>
            ))
          )}
        </Card>
        ) : null}
        {activeTab === 'contacts' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Customer contacts</Text>
          {!customerContacts || customerContacts.length === 0 ? (
            <Text style={styles.empty}>No contacts on file.</Text>
          ) : (
            customerContacts.map((contact, index) => (
              <Text key={index} style={styles.body}>
                {contact.label}: {contact.value}
              </Text>
            ))
          )}
          <Text style={styles.subTitle}>Job history</Text>
          {!jobHistory || jobHistory.length === 0 ? (
            <Text style={styles.empty}>No prior jobs on file.</Text>
          ) : (
            jobHistory.map((item) => (
              <View key={item.jobId} style={styles.trailRow}>
                <Text style={styles.body}>
                  #{item.jobNumber} {item.title ?? 'Untitled'}
                </Text>
                <Text style={styles.trailMeta}>
                  {item.status} · {item.createdAt.slice(0, 10)}
                </Text>
              </View>
            ))
          )}
        </Card>
        ) : null}
        {activeTab === 'photos' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          {photos.length === 0 ? (
            <Text style={styles.empty}>No photos captured yet.</Text>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <View key={photo.id} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                  {renderPhotoExtra ? renderPhotoExtra(photo) : null}
                  <Pressable onPress={() => onRemovePhoto?.(photo.id)}>
                    <Text style={styles.photoRemove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>
        ) : null}
        {activeTab === 'notes' ? (
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
        ) : null}
        {activeTab === 'trail' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Trail</Text>
          {!timeline || timeline.length === 0 ? (
            <Text style={styles.empty}>No activity recorded yet.</Text>
          ) : (
            timeline.map((item, index) => {
              const when = new Date(item.at);
              const whenLabel = Number.isNaN(when.getTime()) ? item.at : when.toLocaleString();
              return (
                <View key={index} style={styles.trailRow}>
                  <Text style={styles.body}>{item.label}</Text>
                  <Text style={styles.trailMeta}>
                    {whenLabel} · {item.kind}
                    {item.actor ? ` · ${item.actor}` : ''}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
        ) : null}
        {activeTab === 'closeout' ? (
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
        </Card>

        ) : null}
      </Body>
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
    marginBottom: spacing.sm,
  },
  jobStatus: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    textTransform: 'capitalize',
  },
  fixedTop: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  section: {
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  empty: {
    color: colors.textLight,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  trailRow: {
    marginBottom: spacing.xs,
  },
  trailMeta: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
  body: {
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.xs,
  },
  subTitle: {
    color: colors.textMuted,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
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
