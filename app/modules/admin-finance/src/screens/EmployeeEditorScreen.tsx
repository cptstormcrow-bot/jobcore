// JobCore screen #0043 - af-employee-editor - Add/Edit Employee
/**
 * Employee editor screen, mirrors `PriceSheetEditorScreen.tsx`'s structure
 * exactly (optional-props + honest-empty-view pattern, `ActionState`
 * discriminated union for submit loading/error, plain `TextInput` +
 * `useState` forms with no external form library).
 *
 * CREATE mode (`profile` prop absent): collects full name, phone, email
 * (used for the invitation; an existing employee's
 * login email is shown and changed in the Email card in EDIT mode), a role picker among the four `Role`
 * values, and an `is_test` toggle. Submits via
 * `InvitationRepository.createInvitation(organizationId, email, role, fullName?)`.
 *
 * EDIT mode (`profile` prop present): full name, phone, `is_test`, and hourly
 * rate are directly editable and saved via
 * `EmployeeRepository.updateEmployee(profileId, { fullName, phone, isTest })`,
 * with the rate persisting to `profiles.hourly_rate_cents` (migration 0066).
 * Role is a separate, immediate action —
 * `EmployeeRepository.setEmployeeRole(profileId, newRole)` — fired the
 * moment a different role is picked, independent of the main save.
 *
 * Layout: Save and Cancel sit at the TOP under the title, followed by a tab
 * bar (Email, Detail, Role, Service Areas, Skills) that shows one group of
 * cards at a time. Role (Select), service-area toggles, skill toggles and the
 * Change-email button are INSTANT saves and are never part of Save. In Add
 * mode the Service Areas and Skills tabs only show a note, since the
 * invitation carries just email/role/name. Cancel has a dirty guard: when any
 * FORM field (Detail and Email fields, compared to their initial values)
 * changed, an inline Discard changes? confirm (Keep editing / Discard) shows
 * instead of leaving; instant-save controls are excluded from the check. The
 * confirm is an inline row, not Alert.alert, because that is a no-op on RN web.
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Button, Card, DefaultTabBar, EmptyState, ErrorState, ScreenTitle, Toggle, Select, colors, spacing, typography, Text } from '@jobcore/ui';
import type { Profile, Role } from '@jobcore/core';
import { DEFAULT_PAID_TRAVEL_POLICY_MESSAGE, DEFAULT_HOURLY_RATE_CENTS } from '@jobcore/core';
import type {
  EmployeeRepository,
  InvitationRepository,
  ServiceAreaRepository,
  TechServiceAreaRepository,
  TechSkillRepository,
  ServiceArea,
} from '../data/ports';
import { isVehicleStatus, isToolStatus, DuplicateInvitationError } from '../data/ports';
import { getModuleSession } from '../lib/module-session';
import { numberAreas } from './employee-editor-logic';

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
  /** Optional dated rate setter; when present, rate changes go through it instead of the profile update. */
  onSetRate?: (input: { userId: string; hourlyRateCents: number; effectiveFrom: string }) => Promise<void>;
  /** Fired when the user cancels out of the editor. */
  onCancel?: () => void;
  isTest?: boolean;
  onIsTestChange?: (v: boolean) => void;
  paidTravel?: boolean;
  onPaidTravelChange?: (v: boolean) => void;
}

const ROLE_OPTIONS = [
  { label: 'owner', value: 'owner' },
  { label: 'admin', value: 'admin' },
  { label: 'tech', value: 'tech' },
  { label: 'sales', value: 'sales' },
];

type EmpTab = 'email' | 'detail' | 'role' | 'areas' | 'skills';

const EMP_TAB_ITEMS: { id: EmpTab; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'detail', label: 'Detail' },
  { id: 'role', label: 'Role' },
  { id: 'areas', label: 'Service Areas' },
  { id: 'skills', label: 'Skills' },
];

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
    onSetRate,
    onCancel,
    isTest,
    onIsTestChange,
    paidTravel,
    onPaidTravelChange,
  } = props;
  const isEditMode = !!profile;

  const [fullNameInput, setFullNameInput] = useState(profile?.fullName ?? '');
  const [phoneInput, setPhoneInput] = useState(profile?.phone ?? '');
  const [emailInput, setEmailInput] = useState('');
  const [roleInput, setRoleInput] = useState<Role>(profile?.role ?? 'tech');
  const [localIsTest, setLocalIsTest] = useState(profile?.isTest ?? false);
  const isTestInput = isTest ?? localIsTest;
  const setIsTestInput = onIsTestChange ?? setLocalIsTest;
  const [localPaidTravel, setLocalPaidTravel] = useState(profile?.paidTravel ?? false);
  const paidTravelInput = paidTravel ?? localPaidTravel;
  const setPaidTravelInput = onPaidTravelChange ?? setLocalPaidTravel;
  const [ptpmInput, setPtpmInput] = useState(profile?.paidTravelPolicyMessage ?? DEFAULT_PAID_TRAVEL_POLICY_MESSAGE);
  const [hourlyRateInput, setHourlyRateInput] = useState(
    (((profile as unknown as { defaultHourlyRateCents?: number })?.defaultHourlyRateCents ?? DEFAULT_HOURLY_RATE_CENTS) / 100).toFixed(2)
  );
  const [effectiveFromInput, setEffectiveFromInput] = useState(new Date().toISOString().slice(0, 10));

  const [actionState, setActionState] = useState<ActionState>({ kind: 'idle' });
  const [roleActionState, setRoleActionState] = useState<ActionState>({ kind: 'idle' });
  const [changeEmailInput, setChangeEmailInput] = useState(profile?.email ?? '');
  const [emailActionState, setEmailActionState] = useState<ActionState>({ kind: 'idle' });
  const [duplicateConflict,setDuplicateConflict] = useState<{ invitationId: string; email: string } | null>(null);

  const [serviceAreaList, setServiceAreaList] = useState<ServiceArea[]>([]);
  const [assignedServiceAreaIds, setAssignedServiceAreaIds] = useState<Set<string>>(new Set());
  const [serviceAreaActionState, setServiceAreaActionState] = useState<Record<string, ActionState>>({});

  const [addressInput, setAddressInput] = useState((profile as unknown as { address?: string })?.address ?? '');
  const [driversLicenseInput, setDriversLicenseInput] = useState((profile as unknown as { driversLicenseNumber?: string })?.driversLicenseNumber ?? '');
  const [vehicleStatusInput, setVehicleStatusInput] = useState<string | null>((profile as unknown as { vehicleStatus?: string })?.vehicleStatus ?? null);
  const [toolStatusInput, setToolStatusInput] = useState<string | null>((profile as unknown as { toolStatus?: string })?.toolStatus ?? null);
  const [ssnLast4Input, setSsnLast4Input] = useState('');
  const [ecNameInput, setEcNameInput] = useState('');
  const [ecPhoneInput, setEcPhoneInput] = useState('');
  const [privateState, setPrivateState] = useState<'loading' | 'loaded' | 'failed'>(isEditMode ? 'loading' : 'loaded');

  const [assignedSkillIds, setAssignedSkillIds] = useState<Set<string>>(new Set());
  const [skillActionState, setSkillActionState] = useState<Record<string, ActionState>>({});

  const [activeTab, setActiveTab] = useState<EmpTab>('detail');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [initial] = useState(() => ({
    fullName: fullNameInput,
    phone: phoneInput,
    address: addressInput,
    license: driversLicenseInput,
    vehicle: vehicleStatusInput,
    tool: toolStatusInput,
    rate: hourlyRateInput,
    effective: effectiveFromInput,
    isTest: isTestInput,
    paidTravel: paidTravelInput,
    ptpm: ptpmInput,
  }));
  const [privateInitial, setPrivateInitial] = useState({ ssn: '', ecName: '', ecPhone: '' });

  const session = getModuleSession();

  useEffect(() => {
    if (!isEditMode || !profile || !employeeRepository) return;
    let cancelled = false;
    setPrivateState('loading');
    employeeRepository.getPrivate(profile.id).then((r) => {
      if (cancelled) return;
      setSsnLast4Input(r?.ssnLast4 ?? '');
      setEcNameInput(r?.emergencyContactName ?? '');
      setEcPhoneInput(r?.emergencyContactPhone ?? '');
      setPrivateInitial({ ssn: r?.ssnLast4 ?? '', ecName: r?.emergencyContactName ?? '', ecPhone: r?.emergencyContactPhone ?? '' });
      setPrivateState('loaded');
    }).catch(() => {
      if (cancelled) return;
      setPrivateState('failed');
    });
    return () => {
      cancelled = true;
    };
  }, [isEditMode, profile?.id, employeeRepository]);

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

  // Dirty = FORM fields only (Detail + Email); instant-save controls are excluded.
  const privateDirty =
    isEditMode &&
    privateState === 'loaded' &&
    (ssnLast4Input !== privateInitial.ssn || ecNameInput !== privateInitial.ecName || ecPhoneInput !== privateInitial.ecPhone);
  const emailDirty = isEditMode
    ? emailActionState.kind !== 'done' && changeEmailInput.trim() !== (profile?.email ?? '').trim()
    : emailInput !== '' || roleInput !== 'tech';
  const isDirty =
    fullNameInput !== initial.fullName ||
    phoneInput !== initial.phone ||
    addressInput !== initial.address ||
    driversLicenseInput !== initial.license ||
    vehicleStatusInput !== initial.vehicle ||
    toolStatusInput !== initial.tool ||
    hourlyRateInput !== initial.rate ||
    effectiveFromInput !== initial.effective ||
    isTestInput !== initial.isTest ||
    paidTravelInput !== initial.paidTravel ||
    ptpmInput !== initial.ptpm ||
    privateDirty ||
    emailDirty;

  function handleCancel(): void {
    if (!isDirty) {
      onCancel?.();
    } else {
      setConfirmDiscard(true);
    }
  }

  async function handleCreate(): Promise<void> {
    if (!invitationRepository) return;
    const fullName = fullNameInput.trim();
    if (!fullName) return;
    setActionState({ kind: 'working' });
    try {
      await invitationRepository.createInvitation(session!.org.id, emailInput, roleInput, fullName);
      setDuplicateConflict(null);
      setActionState({ kind: 'done', message: `Invitation saved for ${fullName}. They must sign up with exactly ${emailInput}; their account is set up automatically on first sign-in.` });
      onSaved?.();
    } catch (error: unknown) {
      if (error instanceof DuplicateInvitationError) {
        const pending = await invitationRepository.findPendingInvitation(session!.org.id, emailInput);
        if (pending) {
          setDuplicateConflict({ invitationId: pending.id, email: pending.email });
        }
        setActionState({ kind: 'failed', message: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : 'Could not send the invitation.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleRevokeAndResend(): Promise<void> {
    if (!invitationRepository || !duplicateConflict) return;
    setActionState({ kind: 'working' });
    try {
      await invitationRepository.revokeInvitation(duplicateConflict.invitationId);
      setDuplicateConflict(null);
      await handleCreate();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not revoke the pending invitation.';
      setActionState({ kind: 'failed', message });
    }
  }

  async function handleUpdate(): Promise<void> {
    if (!employeeRepository || !profile) return;
    if (ssnLast4Input && ssnLast4Input.length !== 4) {
      setActionState({ kind: 'failed', message: 'SSN: enter exactly the last 4 digits.' });
      return;
    }
    setActionState({ kind: 'working' });
    try {
      const initialRateCents = (profile as unknown as { defaultHourlyRateCents?: number }).defaultHourlyRateCents ?? DEFAULT_HOURLY_RATE_CENTS;
      const newRateCents = Number.isNaN(Number(hourlyRateInput)) ? DEFAULT_HOURLY_RATE_CENTS : Math.round(Number(hourlyRateInput) * 100);
      const rateViaSetter = !!onSetRate && newRateCents !== initialRateCents;
      await employeeRepository.updateEmployee(profile.id, {
        fullName: fullNameInput,
        phone: phoneInput || null,
        isTest: isTestInput,
        address: addressInput || null,
        driversLicenseNumber: driversLicenseInput || null,
        vehicleStatus: vehicleStatusInput && isVehicleStatus(vehicleStatusInput) ? vehicleStatusInput : null,
        toolStatus: toolStatusInput && isToolStatus(toolStatusInput) ? toolStatusInput : null,
        paidTravel: paidTravelInput,
        paidTravelPolicyMessage: ptpmInput || null,
        ...(rateViaSetter ? {} : { defaultHourlyRateCents: newRateCents }),
      });
      if (rateViaSetter && onSetRate) {
        await onSetRate({ userId: profile.id, hourlyRateCents: newRateCents, effectiveFrom: effectiveFromInput });
      }
      if (privateState === 'loaded') {
        if (!session) {
          throw new Error('No active session: private details were not saved.');
        }
        await employeeRepository.upsertPrivate(profile.id, session.org.id, {
          ssnLast4: ssnLast4Input || null,
          emergencyContactName: ecNameInput || null,
          emergencyContactPhone: ecPhoneInput || null,
        });
      } else if (privateState === 'failed') {
        throw new Error('Private details could not be loaded; they will not be changed by Save.');
      }
      setActionState({ kind: 'done', message: 'Saved.' });
      onSaved?.();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : undefined;
      setActionState({
        kind: 'failed',
        message: detail
          ? `Save did not apply — you may not have permission: ${detail}`
          : 'Save did not apply — you may not have permission',
      });
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

  async function handleEmailChange(): Promise<void> {
    if (!employeeRepository || !profile) return;
    const next = changeEmailInput.trim().toLowerCase();
    if (!next.includes('@') || !next.includes('.')) {
      setEmailActionState({ kind: 'failed', message: 'Enter a valid email address.' });
      return;
    }
    if (next === (profile.email ?? '').trim().toLowerCase()) {
      setEmailActionState({ kind: 'failed', message: 'That is already the current email.' });
      return;
    }
    setEmailActionState({ kind: 'working' });
    try {
      await employeeRepository.changeEmployeeEmail(profile.id, next);
      setChangeEmailInput(next);
      setEmailActionState({ kind: 'done', message: 'Email changed.' });
      onSaved?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not change the email.';
      setEmailActionState({ kind: 'failed', message });
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
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <Button
            label={busy ? 'Saving...' : 'Save'}
            variant="primary"
            onPress={() => {
              if (isEditMode) {
                void handleUpdate();
              } else {
                void handleCreate();
              }
            }}
            disabled={busy || (isEditMode ? !employeeRepository : !invitationRepository) || privateState === 'loading'}
            style={styles.topButton}
          />
          <Button
            label="Cancel"
            variant="outline"
            onPress={handleCancel}
            disabled={!onCancel}
            style={styles.topButton}
          />
        </View>
        {confirmDiscard ? (
          <View style={styles.confirmRow}>
            <Text style={styles.heading}>Discard changes?</Text>
            <View style={styles.topRow}>
              <Button
                label="Keep editing"
                variant="outline"
                onPress={() => setConfirmDiscard(false)}
                style={styles.topButton}
              />
              <Button
                label="Discard"
                variant="primary"
                onPress={() => {
                  setConfirmDiscard(false);
                  onCancel?.();
                }}
                style={styles.topButton}
              />
            </View>
          </View>
        ) : null}
        {actionState.kind === 'failed' ? <ErrorState message={actionState.message} /> : null}
        {actionState.kind === 'failed' && duplicateConflict ? (
          <Button
            label="Revoke pending invitation & resend"
            variant="outline"
            onPress={() => {
              void handleRevokeAndResend();
            }}
            disabled={busy}
            style={styles.action}
          />
        ) : null}
        {actionState.kind === 'done' ? <Text style={styles.note}>{actionState.message}</Text> : null}
      </View>
      <DefaultTabBar tabs={EMP_TAB_ITEMS} activeId={activeTab} onChange={setActiveTab} />
      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'email' && isEditMode ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Email</Text>
            <Text style={styles.note}>{`Current email: ${profile?.email ?? 'Not on file'}`}</Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={changeEmailInput}
              onChangeText={setChangeEmailInput}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              label={emailActionState.kind === 'working' ? 'Changing...' : 'Change email'}
              onPress={() => {
                void handleEmailChange();
              }}
              disabled={emailActionState.kind === 'working' || !employeeRepository}
              style={styles.action}
            />
            {emailActionState.kind === 'failed' ? <ErrorState message={emailActionState.message} /> : null}
            {emailActionState.kind === 'done' ? <Text style={styles.note}>{emailActionState.message}</Text> : null}
          </Card>
        ) : null}

        {activeTab === 'email' && !isEditMode ? (
          <Card style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={emailInput}
              onChangeText={(text) => {
                setEmailInput(text);
                setDuplicateConflict(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Card>
        ) : null}

        {activeTab === 'detail' ? (
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
              {privateState === 'failed' ? (
                <ErrorState message="Private details could not be loaded; they will not be changed by Save." />
              ) : null}
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
              <TextInput
                style={styles.input}
                placeholder="SSN (last 4 digits only)"
                value={ssnLast4Input}
                onChangeText={(t) => {
                  if (/^\d{0,4}$/.test(t)) setSsnLast4Input(t);
                }}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
              <Text style={styles.note}>
                Stored as last 4 only; shown as •••-••-{ssnLast4Input || '____'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Emergency Contact Name"
                value={ecNameInput}
                onChangeText={setEcNameInput}
              />
              <TextInput
                style={styles.input}
                placeholder="Emergency Contact Phone"
                value={ecPhoneInput}
                onChangeText={setEcPhoneInput}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Hourly Rate"
                value={hourlyRateInput}
                onChangeText={setHourlyRateInput}
                keyboardType="numeric"
              />
              {onSetRate ? (
                <TextInput
                  style={styles.input}
                  placeholder="Rate effective from (YYYY-MM-DD)"
                  value={effectiveFromInput}
                  onChangeText={setEffectiveFromInput}
                />
              ) : null}
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
              {paidTravelInput && vehicleStatusInput !== 'assigned' ? (
                <Text style={styles.warning}>
                  No vehicle assigned to tech.
                </Text>
              ) : null}
              {paidTravelInput ? (
                <TextInput
                  style={[styles.input, styles.multiline]}
                  value={ptpmInput}
                  onChangeText={setPtpmInput}
                  multiline
                />
              ) : null}
            </>
          ) : null}
        </Card>
        ) : null}

        {activeTab === 'role' ? (
        <Card style={styles.card}>
          <Select
            label="Role"
            value={roleInput}
            options={ROLE_OPTIONS}
            onChange={(v) => {
              if (isEditMode) {
                void handleRoleChange(v as Role);
              } else {
                setRoleInput(v as Role);
              }
            }}
            disabled={roleActionState.kind === 'working'}
          />
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
        ) : null}

        {activeTab === 'areas' && !isEditMode ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Service Areas</Text>
            <Text style={styles.note}>Set after the employee accepts the invitation.</Text>
          </Card>
        ) : null}

        {activeTab === 'areas' && isEditMode ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Service Areas</Text>
            {serviceAreaList.length === 0 ? (
              <Text style={styles.note}>No service areas are configured.</Text>
            ) : (
              numberAreas(serviceAreaList).map((numbered) => {
                const area = { id: numbered.id, name: `${numbered.n}. ${numbered.name}` };
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

        {activeTab === 'skills' && !isEditMode ? (
          <Card style={styles.card}>
            <Text style={styles.heading}>Skills</Text>
            <Text style={styles.note}>Set after the employee accepts the invitation.</Text>
          </Card>
        ) : null}

        {activeTab === 'skills' && isEditMode ? (
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
  topBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  topButton: {
    flex: 1,
    marginBottom: spacing.sm,
  },
  confirmRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: spacing.sm,
    marginBottom: spacing.sm,
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
  warning: {
    color: colors.danger,
    fontSize: typography.size.small,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
