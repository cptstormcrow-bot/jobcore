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

/** One captured close-out photo. Caller owns storage/upload; this screen only displays and removes. */
export interface CloseOutPhoto {
  id: string;
  uri: string;
  storagePath?: string;
}

type PayoutBasis = 'hourly' | 'commission' | 'prem-bonus' | 'none';

const PAYOUT_BASIS_LABELS: Record<PayoutBasis, string> = {
  hourly: 'Hourly',
  'prem-bonus': 'Prem bonus',
  commission: 'Commission',
  none: 'No pay set',
};

function payoutBasisLabel(basis: PayoutBasis): string {
  return PAYOUT_BASIS_LABELS[basis];
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
  /** Total hours logged to the job. */
  hoursLogged?: number;
  /** Payment summary line: paid = settled (amount paid), else balance still owed. Null/absent hides the line. */
  payment?: { paid: boolean; amountCents: number } | null;
  /** Tech payouts for the job. */
  techPayouts?: { techName: string; amount: number; basis: PayoutBasis; note?: string }[];
  /** Contractor payouts for the job. */
  contractorPayouts?: { contractorName: string; amount: number; basis?: PayoutBasis; note?: string }[];
  /** Hosted inside the job page: no title, no flex root, no nested scroller. */
  embedded?: boolean;
  /** Opens the calendar from the title bar's schedule link; absent means the label is plain text. */
  onOpenCalendar?: () => void;
  /** Job activity trail, already in ascending order; read-only. */
  timeline?: JobTimelineItem[];
  /** Optional extra content rendered under each photo's image. */
  renderPhotoExtra?: (photo: CloseOutPhoto) => ReactNode;
}

type CloseOutTab = 'payouts' | 'photos' | 'notes' | 'trail';

const CLOSE_OUT_TABS: Array<{ id: CloseOutTab; label: string }> = [
  { id: 'payouts', label: 'Payouts' },
  { id: 'photos', label: 'Photos' },
  { id: 'notes', label: 'Notes' },
  { id: 'trail', label: 'Trail' },
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
  hoursLogged,
  payment,
  techPayouts,
  contractorPayouts,
  embedded,
  onOpenCalendar,
  timeline,
  renderPhotoExtra,
}: CloseOutReviewScreenProps) {
  const [activeTab, setActiveTab] = useState<CloseOutTab>('payouts');
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
      {embedded ? null : <ScreenTitle title="Close-Out" />}
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
          <DefaultTabBar tabs={CLOSE_OUT_TABS} activeId={activeTab} onChange={setActiveTab} />
        ) : null}
        <View style={styles.actionRow}>
          <Button label="Add photo" onPress={() => onAddPhoto?.()} variant="secondary" size="sm" />
          <Button
            label="Close out job"
            onPress={() => onCloseOut?.(job)}
            disabled={blockers.length > 0}
            size="sm"
          />
        </View>
        {blockers.map((reason, index) => (
          <Text key={index} style={styles.blocker}>
            {reason}
          </Text>
        ))}
        {embedded ? <ScreenTitle title="Close-Out" /> : null}
        <Text style={styles.body}>
          {[job.jobNumber != null ? `Job #${job.jobNumber}` : null, job.description?.trim() || null]
            .filter(Boolean)
            .join(' ') || 'Job'}
        </Text>
        {payment ? (
          <Text style={styles.body}>
            {payment.paid ? 'Job Paid' : 'Job Unpaid'}: ${(payment.amountCents / 100).toFixed(2)}
          </Text>
        ) : null}
        <Text style={styles.body}>Hours Logged: {(hoursLogged ?? 0).toFixed(1)} hours</Text>
        {activeTab === 'payouts' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Payouts</Text>
          {(!techPayouts || techPayouts.length === 0) && (!contractorPayouts || contractorPayouts.length === 0) ? (
            <Text style={styles.empty}>No payouts for this job yet.</Text>
          ) : null}
          <Text style={styles.subTitle}>Tech payouts</Text>
          {!techPayouts || techPayouts.length === 0 ? (
            <Text style={styles.empty}>None</Text>
          ) : (
            techPayouts.map((payout, index) => (
              <View key={index} style={styles.trailRow}>
                <Text style={payout.basis === 'none' ? styles.empty : styles.body}>
                  {payout.techName} ({payoutBasisLabel(payout.basis)}): ${payout.amount.toFixed(2)}
                </Text>
                {payout.basis === 'hourly' ? <Text style={styles.trailMeta}>paid via timesheet</Text> : null}
                {payout.basis === 'prem-bonus' || payout.basis === 'commission' ?<Text style={styles.trailMeta}>posts to next payroll run</Text> : null}
                {payout.note ? <Text style={styles.trailMeta}>{payout.note}</Text> : null}
              </View>
            ))
          )}
          <Text style={styles.subTitle}>Contractor payouts</Text>
          {!contractorPayouts || contractorPayouts.length === 0 ? (
            <Text style={styles.empty}>None</Text>
          ) : (
            contractorPayouts.map((payout, index) => (
              <View key={index} style={styles.trailRow}>
                <Text style={payout.basis === 'none' ? styles.empty : styles.body}>
                  {payout.contractorName}
                  {payout.basis ? ` (${payoutBasisLabel(payout.basis)})` : ''}: ${payout.amount.toFixed(2)}
                </Text>
                {payout.note ? <Text style={styles.trailMeta}>{payout.note}</Text> : null}
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
