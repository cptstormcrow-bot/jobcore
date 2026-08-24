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

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Button, Card, ListItem, EmptyState, ErrorState, ScreenTitle, Toggle, Select, colors, spacing, typography } from '@jobcore/ui';
import type { Profile, Role } from '@jobcore/core';
import type {
  EmployeeRepository,
  InvitationRepository,
  ServiceAreaRepository,
  TechServiceAreaRepository,
  TechSkillRepository,
  ServiceArea,
} from '../data/ports';
import { isVehicleStatus, isToolStatus } from '../data/ports';
import { getModuleSession } from '../lib/module-session';

export interface EmployeeEditorScreenProps {
  employees?: EmployeeRepository;
  invitations?: InvitationRepository;
  serviceAreas?: ServiceAreaRepository;
  techServiceAreas?: TechServiceAreaRepository;
  techSkills?: TechSkillRepository;
  /** Existing employee — absent means create mode, present means edit mode. */
  profile?: Profile;
  /** Fired after a successful save (either mode). */
  onSaved?: () => void;
  /** Fired when the user cancels out of the editor. */
  onCancel?: () => void;
}

const ROLES: readonly Role[] = ['owner', 'admin', 'tech', 'sales'];

const SKILLS = [
  'installation',
  'service_repair',
  'electrical',
  'segway_investigation',
  'estimating',
  'customer_service',
] as const;

const VEHICLE_STATUS_OPTIONS = [
  { label: 'Assigned', value: 'assigned' },
  { label: 'Unassigned', value: 'unassigned' },
  { label: 'In Maintenance', value: 'in_maintenance' },
];
const TOOL_STATUS_OPTIONS = [
  { label: 'Issued', value: 'issued' },
  { label: 'Not Issued', value: 'not_issued' },
  { label: 'Needs Replacement', value: 'needs_replacement' },
];

/** Save/role-change action state. */
type ActionState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'failed'; message: string }
  | { kind: 'done'; message: string };

export function EmployeeEditorScreen(props: EmployeeEditorScreenProps) {
  const {
    employees: employeeRepository,
    invitations: invitationRepository,
    serviceAreas: serviceAreaRepository,
    techServiceAreas: techServiceAreaRepository,
    techSkills: techSkillRepository,
    profile,
    onSaved,
    onCancel,
  } = props;
  const isEditMode = !!profile;

  const [fullNameInput, setFullNameInput] = useState(profile?.fullName ?? '');
  const [phoneInput, setPhoneInput] = useState(profile?.phone ?? '');
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<Role>(profile?.role ?? 'tech');
  const [isTestInput, setIsTestInput] = useState(profile?.isTest ?? false);

  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [roleActionState, setRoleActionState] = useState<ActionState>({ kind: 'idle' });

  const [serviceAreaList, setServiceAreaList] = useState<ServiceArea[]>([]);
  const [assignedServiceAreaIds, setAssignedServiceAreaIds] = useState<Set<string>>(new Set());
  const [serviceAreaActionState, setServiceAreaActionState] = useState<Record<string, ActionState>>({});

  const [addressInput, setAddressInput] = useState((profile as unknown as { address?: string })?.address ?? '');
  const [driversLicenseInput, setDriversLicenseInput] = useState((profile as unknown as { driversLicenseNumber?: string })?.driversLicenseNumber ?? '');
  const [vehicleStatusInput, setVehicleStatusInput] = useState<string | null>((profile as unknown as { vehicleStatus?: string })?.vehicleStatus ?? null);
  const [toolStatusInput, setToolStatusInput] = useState<string | null>((profile as unknown as { toolStatus?: string })?.toolStatus ?? null);

  const [assignedSkillIds, setAssignedSkillIds] = useState<Set<string>>(new Set());
  const [skillActionState, setSkillActionState] = useState<Record<string, ActionState>>({});

  const session = getModuleSession();

  useEffect(() => {
    if (!isEditMode || !profile || !serviceAreaRepository || !techServiceAreaRepository || !session) return;
    let cancelled = false;
    async function load() {
      const [areas, coverage, skills] = await Promise.all([
        serviceAreaRepository!.listForOrganization(session!.org.id),
        techServiceAreaRepository!.listForOrganization(session!.org.id),
        techSkillRepository ? techSkillRepository.listForOrganization(session!.org.id) : Promise.resolve([]),
      ]);
      if (cancelled) return;
      setServiceAreaList(areas);
      const ids = coverage
        .filter((row) => row.techId === profile!.id)
        .map((row) => row.serviceAreaId);
      setAssignedServiceAreaIds(new Set(ids));
      const skillIds = skills
        .filter((row) => row.techId === profile!.id)
        .map((row) => row.skill);
      setAssignedSkillIds(new Set(skillIds));
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, serviceAreaRepository, techServiceAreaRepository, techSkillRepository]);

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
        address: addressInput || null,
        driversLicenseNumber: driversLicenseInput || null,
        vehicleStatus: vehicleStatusInput && isVehicleStatus(vehicleStatusInput) ? vehicleStatusInput : null,
        toolStatus: toolStatusInput && isToolStatus(toolStatusInput) ? toolStatusInput : null,
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

  async function handleServiceAreaToggle(serviceAreaId: string, nextChecked: boolean): Promise<void> {
    if (!techServiceAreaRepository || !profile) return;
    setServiceAreaActionState((prev) => ({ ...prev, [serviceAreaId]: { kind: 'working' } }));
    try {
      if (nextChecked) {
        await techServiceAreaRepository.assignToTech(session!.org.id, profile.id, serviceAreaId);
      } else {
        await techServiceAreaRepository.removeFromTech(session!.org.id, profile.id, serviceAreaId);
      }
      setAssignedServiceAreaIds((prev) => {
        const next = new Set(prev);
        if (nextChecked) {
          next.add(serviceAreaId);
        } else {
          next.delete(serviceAreaId);
        }
        return next;
      });
      setServiceAreaActionState((prev) => ({ ...prev, [serviceAreaId]: { kind: 'done', message: 'Updated.' } }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not update the service area.';
      setServiceAreaActionState((prev) => ({ ...prev, [serviceAreaId]: { kind: 'failed', message } }));
    }
  }

  async function handleSkillToggle(skill: string, nextChecked: boolean): Promise<void> {
    if (!techSkillRepository || !profile) return;
    setSkillActionState((prev) => ({ ...prev, [skill]: { kind: 'working' } }));
    try {
      if (nextChecked) {
        await techSkillRepository.assignToTech(session!.org.id, profile.id, skill);
      } else {
        await techSkillRepository.removeFromTech(session!.org.id, profile.id, skill);
      }
      setAssignedSkillIds((prev) => {
        const next = new Set(prev);
        if (nextChecked) {
          next.add(skill);
        } else {
          next.delete(skill);
        }
        return next;
      });
      setSkillActionState((prev) => ({ ...prev, [skill]: { kind: 'done', message: 'Updated.' } }));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not update the skill.';
      setSkillActionState((prev) => ({ ...prev, [skill]: { kind: 'failed', message } }));
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenTitle title={isEditMode ? 'Edit Employee' : 'Add Employee'} />
      <ScrollView contentContainerStyle={styles.content}>
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
            <>
              <TextInput
                style={styles.input}
                placeholder="Address"
                value={addressInput}
                onChangeText={setAddressInput}
              />
              <TextInput
                style={styles.input}
                placeholder="Driver's License #"
                value={driversLicenseInput}
                onChangeText={setDriversLicenseInput}
              />
              <Select
                label="Vehicle Status"
                value={vehicleStatusInput}
                options={VEHICLE_STATUS_OPTIONS}
                onChange={setVehicleStatusInput}
                placeholder="Select status"
              />
              <Select
                label="Tool Status"
                value={toolStatusInput}
                options={TOOL_STATUS_OPTIONS}
                onChange={setToolStatusInput}
                placeholder="Select status"
              />
              <Toggle
                label="Test Employee"
                value={isTestInput}
                onChange={setIsTestInput}
                style={styles.action}
              />
            </>
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

        {isEditMode ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Service Areas</Text>
            {serviceAreaList.length === 0 ? (
              <Text style={styles.note}>No service areas are configured.</Text>
            ) : (
              serviceAreaList.map((area) => {
                const rowState = serviceAreaActionState[area.id] ?? { kind: 'idle' };
                return (
                  <View key={area.id}>
                    <Toggle
                      label={area.name}
                      value={assignedServiceAreaIds.has(area.id)}
                      onChange={(newValue) => {
                        void handleServiceAreaToggle(area.id, newValue);
                      }}
                      disabled={rowState.kind === 'working'}
                      style={styles.action}
                    />
                    {rowState.kind === 'failed' ? <ErrorState message={rowState.message} /> : null}
                  </View>
                );
              })
            )}
          </Card>
        ) : null}

        {isEditMode ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Skills</Text>
            {SKILLS.map((skill) => {
              const rowState = skillActionState[skill] ?? { kind: 'idle' };
              return (
                <View key={skill}>
                  <Toggle
                    label={skill}
                    value={assignedSkillIds.has(skill)}
                    onChange={(newValue) => {
                      void handleSkillToggle(skill, newValue);
                    }}
                    disabled={rowState.kind === 'working'}
                    style={styles.action}
                  />
                  {rowState.kind === 'failed' ? <ErrorState message={rowState.message} /> : null}
                </View>
              );
            })}
          </Card>
        ) : null}

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
          variant="outline"
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
