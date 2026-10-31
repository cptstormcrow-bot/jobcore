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
 *
 * An email-only "Invite by email" field + Send button sits above the list in
 * both the empty and populated branches; it calls
 * `InvitationRepository.createInvitation` (role 'tech') and reloads the list.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useReadCacheRevision } from '../lib/read-cache';
import { View, ScrollView, StyleSheet, TextInput } from 'react-native';
import { PayrollButton, Card, ListItem, EmptyState, LoadingState, ErrorState, ScreenTitle, Text, colors, spacing, typography } from '@jobcore/ui';
import type { Invitation, InvitationRepository } from '../data/ports';
import { DuplicateInvitationError } from '../data/ports';
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
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const session = getModuleSession();
  const rev = useReadCacheRevision();
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!session || !invitationRepository) {
      return;
    }
    let cancelled = false;
    if (!hasLoadedRef.current) setLoadState({ kind: 'loading' });
    invitationRepository
      .listPendingInvitations(session.org.id)
      .then((result) => {
        if (!cancelled) {
          hasLoadedRef.current = true;
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
  }, [session, invitationRepository, rev, reloadTick]);

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

  async function handleSend(): Promise<void> {
    if (!invitationRepository || !session) return;
    const address = email.trim().toLowerCase();
    if (!address) {
      setInviteError('Enter an email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setInviteError('Enter a valid email address.');
      return;
    }
    setSending(true);
    setInviteError(null);
    setNotice(null);
    try {
      await invitationRepository.createInvitation(session.org.id, address, 'tech', '');
      setEmail('');
      setNotice(`Invite saved for ${address}. They must sign up with exactly this email.`);
      setReloadTick((t) => t + 1);
    } catch (error: unknown) {
      if (error instanceof DuplicateInvitationError) {
        setInviteError(`${address} already has a pending invitation.`);
      } else {
        setInviteError(error instanceof Error && error.message ? error.message : 'Could not save the invitation.');
      }
    } finally {
      setSending(false);
    }
  }

  const inviteForm = (
    <Card style={styles.card}>
      <Text style={styles.heading}>Invite by email</Text>
      <TextInput
        style={styles.input}
        placeholder="name@example.com"
        accessibilityLabel="Invite by email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <PayrollButton
        label={sending ? 'Sending...' : 'Send'}
        onPress={() => void handleSend()}
        disabled={sending}
        style={styles.action}
      />
      {inviteError ? <ErrorState message={inviteError} /> : null}
      {notice ? <Text style={styles.note}>{notice}</Text> : null}
    </Card>
  );

  if (loadState.invitations.length === 0) {
    return (
      <View style={styles.screen}>
        <ScreenTitle title="Employee Invitations" />
        <ScrollView contentContainerStyle={styles.content}>
          {inviteForm}
          <EmptyState title="Employee Invitations" message="This organization has no pending invitations." />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenTitle title="Employee Invitations" />
      <ScrollView contentContainerStyle={styles.content}>
        {inviteForm}
        <Card style={styles.card}>
          {loadState.invitations.map((invitation) => (
            <View key={invitation.id}>
              <ListItem
                title={invitation.email}
                subtitle={invitation.role}
                right={
                  <PayrollButton
                    label="Revoke"
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
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 4,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontFamily.body,
  },
  action: {
    marginBottom: spacing.sm,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
  },
});
