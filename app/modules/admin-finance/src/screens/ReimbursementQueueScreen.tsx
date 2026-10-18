// JobCore screen #0021 - af-payments-ReimbursementQueueScreen - Reimbursements
/**
 * Reimbursement queue screen — pending list + approve/reject actions (P3k.3).
 *
 * Consumes `ReimbursementRepo` (`../data/reimbursement-repo.ts`, P3k.2a):
 * `listForOrganization` for the read side, `approve` / `reject` for the
 * write side. Mirrors `PriceSheetListScreen.tsx`'s optional-props pattern,
 * `getModuleSession` session gate, and idle/loading/loaded/failed state
 * machine exactly, so the two screens stay consistent.
 *
 * `listForOrganization` returns reimbursements in ANY status (see the port
 * doc comment) — this screen filters to `status === 'pending'` client-side,
 * since the port exposes no status-scoped query of its own.
 *
 * Reject REQUIRES a reason (`RejectReimbursementInput.reason`,
 * `validateRejectReason`) — this screen surfaces a minimal inline reason
 * input per row rather than inventing a modal/dialog component that isn't
 * in `@jobcore/ui` (`Button`, `Card`, `ListItem`, `EmptyState`,
 * `LoadingState`, `ErrorState` only). The reason `TextInput` comes from
 * `react-native` directly, matching how `View`/`Text`/`ScrollView` are
 * already sourced in `PriceSheetListScreen.tsx`.
 *
 * Approve/reject are per-row async actions layered on top of the list
 * load state: a row tracks its own `pending` / `error` action status so
 * one row's in-flight action never blocks or hides the rest of the list.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, TextInput, StyleSheet } from 'react-native';
import { Card, ListItem, Button, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing, typography, Text } from '@jobcore/ui';
import type { Reimbursement, ReimbursementRepo } from '../data/reimbursement-repo';
import { getModuleSession } from '../lib/module-session';

export interface ReimbursementQueueScreenProps {
  reimbursements?: ReimbursementRepo;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; items: Reimbursement[] }
  | { kind: 'failed'; message: string };

/** Per-row action state, keyed by reimbursement id. Absent = idle. */
type RowActionState =
  | { kind: 'submitting'; action: 'approve' | 'reject' | 'pay' }
  | { kind: 'failed'; message: string };

/** Local, honest formatter for cents — this screen has no shared money formatter to reuse. */
function formatAmount(amountCents: number): string {
  return `$${(amountCents / 100).toFixed(2)}`;
}

export function ReimbursementQueueScreen(props: ReimbursementQueueScreenProps = {}) {
  const { reimbursements: reimbursementRepository } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [rowActions, setRowActions] = useState<Record<string, RowActionState>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [rejectOpenFor, setRejectOpenFor] = useState<string | null>(null);

  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!session || !reimbursementRepository) {
      return;
    }
    let cancelled = false;
    if (!hasLoadedRef.current) setLoadState({ kind: 'loading' });
    reimbursementRepository
      .listForOrganization(session.org.id)
      .then((result) => {
        if (!cancelled) {
          hasLoadedRef.current = true;
          setLoadState({ kind: 'loaded', items: Array.isArray(result) ? result : [] });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load reimbursements.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, reimbursementRepository, rev]);

  function replaceItem(id: string, updated: Reimbursement) {
    setLoadState((prev) => {
      if (prev.kind !== 'loaded') {
        return prev;
      }
      return { kind: 'loaded', items: prev.items.map((item) => (item.id === id ? updated : item)) };
    });
  }

  function handleApprove(item: Reimbursement) {
    if (!reimbursementRepository || !session) {
      return;
    }
    setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'submitting', action: 'approve' } }));
    reimbursementRepository
      .approve({ reimbursementId: item.id, approvedBy: session.userId })
      .then((result) => {
        if (!result.ok) {
          setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'failed', message: result.reason } }));
          return;
        }
        replaceItem(item.id, result.value);
        setRowActions((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not approve this reimbursement.';
        setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'failed', message } }));
      });
  }

  function handleReject(item: Reimbursement) {
    if (!reimbursementRepository || !session) {
      return;
    }
    const reason = rejectReasons[item.id] ?? '';
    setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'submitting', action: 'reject' } }));
    reimbursementRepository
      .reject({ reimbursementId: item.id, approvedBy: session.userId, reason })
      .then((result) => {
        if (!result.ok) {
          setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'failed', message: result.reason } }));
          return;
        }
        replaceItem(item.id, result.value);
        setRowActions((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        setRejectOpenFor((prev) => (prev === item.id ? null : prev));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not reject this reimbursement.';
        setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'failed', message } }));
      });
  }

  function handleMarkPaid(item: Reimbursement) {
    if (!reimbursementRepository || !session) {
      return;
    }
    setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'submitting', action: 'pay' } }));
    reimbursementRepository
      .markPaid(item.id)
      .then((result) => {
        if (!result.ok) {
          setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'failed', message: result.reason } }));
          return;
        }
        replaceItem(item.id, result.value);
        setRowActions((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Could not mark this reimbursement paid.';
        setRowActions((prev) => ({ ...prev, [item.id]: { kind: 'failed', message } }));
      });
  }

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Reimbursements"
          message="Sign in to view this organization's reimbursement queue."
        />
      </View>
    );
  }

  if (!reimbursementRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Reimbursements"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading reimbursements..." />
      </View>
    );
  }

  if (loadState.kind === 'failed') {
    return (
      <View style={styles.screen}>
        <ErrorState message={loadState.message} />
      </View>
    );
  }

  const pending = loadState.items.filter((item) => item.status === 'pending');

  const approved = loadState.items.filter((item) => item.status === 'approved');
  const rejected = loadState.items.filter((item) => item.status === 'rejected');

  if (pending.length === 0 && approved.length === 0 && rejected.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState title="Reimbursements" message="No reimbursements are awaiting review." />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <ScreenTitle title="Reimbursements" />
        <Text style={styles.groupHeading}>Pending Review</Text>
        <Card style={styles.card}>
          {pending.map((item) => {
            const rowState = rowActions[item.id];
            const isSubmitting = rowState?.kind === 'submitting';
            const rejectOpen = rejectOpenFor === item.id;
            return (
              <View key={item.id} style={styles.row}>
                <ListItem
                  title={formatAmount(item.amount)}
                  subtitle={item.description ?? 'No description provided'}
                />
                {rowState?.kind === 'failed' && <Text style={styles.rowError}>{rowState.message}</Text>}
                {rejectOpen && (
                  <TextInput
                    style={styles.reasonInput}
                    placeholder="Reason for rejection"
                    value={rejectReasons[item.id] ?? ''}
                    onChangeText={(text) => setRejectReasons((prev) => ({ ...prev, [item.id]: text }))}
                    editable={!isSubmitting}
                  />
                )}
                <View style={styles.actions}>
                  <Button
                    label="Approve"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                    onPress={() => handleApprove(item)}
                    style={styles.actionButton}
                  />
                  {rejectOpen ? (
                    <Button
                      label="Confirm Reject"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting || (rejectReasons[item.id] ?? '').trim().length === 0}
                      onPress={() => handleReject(item)}
                      style={styles.actionButton}
                    />
                  ) : (
                    <Button
                      label="Reject"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      onPress={() => setRejectOpenFor(item.id)}
                      style={styles.actionButton}
                    />
                  )}
                </View>
              </View>
            );
          })}
        </Card>
        {approved.length > 0 && (
          <>
            <Text style={styles.groupHeading}>Approved - Awaiting Payment</Text>
            <Card style={styles.card}>
              {approved.map((item) => {
                const rowState = rowActions[item.id];
                const isSubmitting = rowState?.kind === 'submitting';
                return (
                  <View key={item.id} style={styles.row}>
                    <ListItem
                      title={formatAmount(item.amount)}
                      subtitle={item.description ?? 'No description provided'}
                    />
                    {rowState?.kind === 'failed' && <Text style={styles.rowError}>{rowState.message}</Text>}
                    <View style={styles.actions}>
                      <Button
                        label="Mark paid"
                        variant="primary"
                        size="sm"
                        disabled={isSubmitting}
                        onPress={() => handleMarkPaid(item)}
                        style={styles.actionButton}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        )}
        {rejected.length > 0 && (
          <>
            <Text style={styles.groupHeading}>Rejected</Text>
            <Card style={styles.card}>
              {rejected.map((item) => (
                <View key={item.id} style={styles.row}>
                  <ListItem
                    title={formatAmount(item.amount)}
                    subtitle={item.description ?? 'No description provided'}
                  />
                  <Text style={styles.rowError}>
                    {item.rejectionReason ? `Rejected: ${item.rejectionReason}` : 'Rejected (no reason recorded)'}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </View>
    </View>
  );
}

export default ReimbursementQueueScreen;

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  groupHeading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  row: {
    marginBottom: spacing.md,
  },
  rowError: {
    color: colors.danger,
    fontSize: typography.size.label,
    marginBottom: spacing.xs,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.xs,
    marginBottom: spacing.xs,
    fontSize: typography.size.body,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});
