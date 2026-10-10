// JobCore screen #0060 - af-employee-invitations - Pending Invitations
/**
 * Employee invitations screen — list query, mirrors `EmployeeRosterScreen.tsx`'s
 * structure exactly (optional-props + honest-empty-view pattern, idle/
 * loading/loaded/failed load-state machine, `getModuleSession` for the
 * org-scoped id).
 *
 * Reads `session.org.id` via `getModuleSession`, then queries
 * `InvitationRepository.listPendingInvitations` for every pending invitation
 * in the organization. Each row carries a "Revoke" action calling
 * `InvitationRepository.revokeInvitation`, removing the row from local state
 * on success and surfacing an inline `ErrorState` on rejection.
 */

import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Button, Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, colors, spacing } from '@jobcore/ui';
import type { Invitation, InvitationRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface EmployeeInvitationsScreenProps {
  invitations?: InvitationRepository;
  /** Fired when the user navigates back out of this screen. */
  onBack?: () => void;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; invitations: Invitation[] }
  | { kind: 'failed'; message: string };

export function EmployeeInvitationsScreen(props: EmployeeInvitationsScreenProps = {}) {
  const { invitations: invitationRepository, onBack } = props;
  const [loadState, setLoadState] = useState<LoadState>({ kind: 'idle' });
  const [revokeErrors, setRevokeErrors] = useState<Record<string, string>>({});

  const session = getModuleSession();

  useEffect(() => {
    if (!session || !invitationRepository) {
      return;
    }
    let cancelled = false;
    setLoadState({ kind: 'loading' });
    invitationRepository
      .listPendingInvitations(session.org.id)
      .then((result) => {
        if (!cancelled) {
          setLoadState({ kind: 'loaded', invitations: result });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load invitations.';
          setLoadState({ kind: 'failed', message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, invitationRepository]);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Employee Invitations"
          message="Sign in to view this organization's invitations."
        />
      </View>
    );
  }

  if (!invitationRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Employee Invitations"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  if (loadState.kind === 'loading' || loadState.kind === 'idle') {
    return (
      <View style={styles.screen}>
        <LoadingState label="Loading invitations..." />
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

  async function handleRevoke(invitationId: string): Promise<void> {
    if (!invitationRepository) return;
    setRevokeErrors((prev) => {
      const next = { ...prev };
      delete next[invitationId];
      return next;
    });
    try {
      await invitationRepository.revokeInvitation(invitationId);
      setLoadState((prev) =>
        prev.kind === 'loaded'
          ? { kind: 'loaded', invitations: prev.invitations.filter((invitation) => invitation.id !== invitationId) }
          : prev
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not revoke the invitation.';
      setRevokeErrors((prev) => ({ ...prev, [invitationId]: message }));
    }
  }

  if (loadState.invitations.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenTitle title="Employee Invitations" />
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState title="Employee Invitations" message="This organization has no pending invitations." />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Employee Invitations" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          {loadState.invitations.map((invitation) => (
            <View key={invitation.id}>
              <ListItem
                title={invitation.email}
                subtitle={invitation.role}
                right={
                  <Button
                    label="Revoke"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      void handleRevoke(invitation.id);
                    }}
                  />
                }
              />
              {revokeErrors[invitation.id] ? <ErrorState message={revokeErrors[invitation.id]} /> : null}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

export default EmployeeInvitationsScreen;

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
});
