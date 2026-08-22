/**
 * Employee editor screen, mirrors `PriceSheetEditorScreen.tsx`'s structure
 * exactly (optional-props + honest-empty-view pattern, `ActionState`
 * discriminated union for submit loading/error, plain `TextInput` +
 * `useState` forms with no external form library).
 *
 * CREATE mode (`profile` prop absent): collects full name, phone, email
 * (required only to send the invitation — `profiles` has no email column;
 * email lives on the invitation), a role picker among the four `Role`
 * values, and an `is_test` toggle. Submits via
 * `InvitationRepository.createInvitation(organizationId, email, role)`.
 *
 * EDIT mode (`profile` prop present): full name, phone, and `is_test` are
 * directly editable and saved via
 * `EmployeeRepository.updateEmployee(profileId, { fullName, phone, isTest })`.
 * Role is a separate, immediate action —
 * `EmployeeRepository.setEmployeeRole(profileId, newRole)` — fired the
 * moment a different role is picked, independent of the main save.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Button, Card, ListItem, EmptyState, ErrorState, Toggle, colors, spacing, typography } from '@jobcore/ui';
import type { Profile, Role } from '@jobcore/core';
import type { EmployeeRepository, InvitationRepository } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface EmployeeEditorScreenProps {
  employees?: EmployeeRepository;
  invitations?: InvitationRepository;
  /** Existing employee — absent means create mode, present means edit mode. */
  profile?: Profile;
  /** Fired after a successful save (either mode). */
  onSaved?: () => void;
  /** Fired when the user cancels out of the editor. */
  onCancel?: () => void;
}

const ROLES: readonly Role[] = ['owner', 'admin', 'tech', 'sales'];

/** Save/role-change action state. */
type ActionState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; message: string };

export function EmployeeEditorScreen(props: EmployeeEditorScreenProps) {
  const { employees: employeeRepository, invitations: invitationRepository, profile, onSaved, onCancel } = props;
  const isEditMode = !!profile;

  const [fullNameInput, setFullNameInput] = useState(profile?.fullName ?? '');
  const [phoneInput, setPhoneInput] = useState(profile?.phone ?? '');
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<Role>(profile?.role ?? 'tech');
  const [isTestInput, setIsTestInput] = useState(profile?.isTest ?? false);

  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [roleActionState, setRoleActionState] = useState<ActionState>({ kind: 'idle' });

  const session = getModuleSession();

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Employee"
          message="Sign in to view this organization's employees."
        />
      </View>
    );
  }

  if (!employeeRepository) {
    return (
      <View style={styles.screen}>
        <EmptyState
          title="Employee"
          message="No data source is connected for this module yet."
        />
      </View>
    );
  }

  const busy = actionState.kind === 'working';

  async function handleCreate(): Promise<void> {
    if (!invitationRepository) return;
    setActionState({ kind: 'working' });
    try {
      await invitationRepository.createInvitation(session!.org.id, emailInput, roleInput);
      setActionState({ kind: 'done', message: 'Invitation sent.' });
      onSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not send the invitation.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!employeeRepository || !profile) return;
    setActionState({ kind: 'working' });
    try {
      await employeeRepository.updateEmployee(profile.id, {
        fullName: fullNameInput,
        phone: phoneInput || null,
        isTest: isTestInput,
      });
      setActionState({ kind: 'done', message: 'Saved.' });
      onSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not save the employee.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleRoleChange(newRole: Role): Promise<void> {
    if (!employeeRepository || !profile) return;
    setRoleInput(newRole);
    setRoleActionState({ kind: 'working' });
    try {
      await employeeRepository.setEmployeeRole(profile.id, newRole);
      setRoleActionState({ kind: 'done', message: 'Role updated.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not update the role.';
      setRoleActionState({ kind: 'failed', message });
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{isEditMode ? 'Edit Employee' : 'Add Employee'}</Text>

        <Card style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            value={fullNameInput}
            onChangeText={setFullNameInput}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone"
            value={phoneInput ?? ''}
            onChangeText={setPhoneInput}
            keyboardType="phone-pad"
          />

          {isEditMode ? (
            <Toggle
              label="Test Employee"
              value={isTestInput}
              onChange={setIsTestInput}
              style={styles.action}
            />
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={emailInput}
                onChangeText={setEmailInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Toggle
                label="Test Employee"
                value={isTestInput}
                onChange={setIsTestInput}
                style={styles.action}
              />
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.heading}>Role</Text>
          {ROLES.map((role) => (
            <ListItem
              key={role}
              title={role}
              subtitle={role === roleInput ? 'Current' : undefined}
              onPress={
                isEditMode
                  ? () => {
                      void handleRoleChange(role);
                    }
                  : () => setRoleInput(role)
              }
            />
          ))}
          {isEditMode && roleActionState.kind === 'working' ? (
            <Text style={styles.note}>Updating role...</Text>
          ) : null}
          {isEditMode && roleActionState.kind === 'failed' ? (
            <ErrorState message={roleActionState.message} />
          ) : null}
          {isEditMode && roleActionState.kind === 'done' ? (
            <Text style={styles.note}>{roleActionState.message}</Text>
          ) : null}
        </Card>

        <Button
          label={busy ? 'Saving...' : 'Save'}
          onPress={() => {
            if (isEditMode) {
              void handleUpdate();
            } else {
              void handleCreate();
            }
          }}
          disabled={busy || (isEditMode ? !employeeRepository : !invitationRepository)}
          style={styles.action}
        />
        <Button
          label="Cancel"
          variant="secondary"
          onPress={() => onCancel?.()}
          disabled={!onCancel}
          style={styles.action}
        />

        {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
        {actionState.kind === 'done' ? <Text style={styles.note}>{actionState.message}</Text> : null}
      </ScrollView>
    </View>
  );
}

export default EmployeeEditorScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.offWhite,
  },
  content: {
    padding: spacing.md,
  },
  heading: {
    color: colors.text,
    fontSize: typography.size.h5,
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },
  card: {
    marginBottom: spacing.md,
  },
  action: {
    marginBottom: spacing.sm,
  },
  note: {
    color: colors.textMuted,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
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
});
