// JobCore screen #0062 - af-leadEdit - Edit Lead
import React, { useState } from 'react';
import { View, ScrollView, TextInput, StyleSheet } from 'react-native';
import { Card, PayrollButton, EmptyState, ScreenTitle, colors, spacing, radius, typography, Text } from '@jobcore/ui';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';
import type { Lead } from '../domain/lead';
import type { LeadPatch } from '../data/ports';
import { classifyLead, missingFields } from '../domain/lead-readiness';
import {
  AxisPicker,
  SOURCE_VALUES,
  PAYER_VALUES,
  ATTACH_TIMING_VALUES,
  asAxisValue,
} from '../components/AxisPicker';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface LeadEditScreenProps {
  lead: Lead;
  onSaved?: (lead: Lead) => void;
  onCreateJob?: (lead: Lead) => void;
  onBack?: () => void;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function LeadEditScreen({ lead, onSaved, onCreateJob, onBack }: LeadEditScreenProps) {
  const session = getModuleSession();
  const ports = getModulePorts();

  const [name, setName] = useState(lead.name ?? '');
  const [phone, setPhone] = useState(lead.phone ?? '');
  const [email, setEmail] = useState(lead.email ?? '');
  const [service, setService] = useState(lead.service ?? '');
  const [preferredDate, setPreferredDate] = useState(lead.preferredDate ?? '');
  const [preferredTime, setPreferredTime] = useState(lead.preferredTime ?? '');
  const [address, setAddress] = useState(lead.address ?? '');
  const [projectDetails, setProjectDetails] = useState(lead.projectDetails ?? '');
  const [source, setSource] = useState<string | null>(lead.source);
  const [payer, setPayer] = useState<string | null>(lead.payer);
  const [attachTiming, setAttachTiming] = useState<string | null>(lead.attachTiming);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [readinessHint, setReadinessHint] = useState<string | null>(null);

  const dateValid = preferredDate.trim() === '' || ISO_DATE_RE.test(preferredDate.trim());
  const canSubmit = name.trim().length > 0 && dateValid && !submitting;

  function buildPatch(): LeadPatch {
    const patch: LeadPatch = {};
    const nameNext = name.trim();
    if (nameNext !== (lead.name ?? '')) patch.name = nameNext;

    const phoneNext = textOrNull(phone);
    if (phoneNext !== lead.phone) patch.phone = phoneNext;

    const emailNext = textOrNull(email);
    if (emailNext !== lead.email) patch.email = emailNext;

    const serviceNext = textOrNull(service);
    if (serviceNext !== lead.service) patch.service = serviceNext;

    const preferredDateNext = textOrNull(preferredDate);
    if (preferredDateNext !== lead.preferredDate) patch.preferredDate = preferredDateNext;

    const preferredTimeNext = textOrNull(preferredTime);
    if (preferredTimeNext !== lead.preferredTime) patch.preferredTime = preferredTimeNext;

    const addressNext = textOrNull(address);
    if (addressNext !== lead.address) patch.address = addressNext;

    const projectDetailsNext = textOrNull(projectDetails);
    if (projectDetailsNext !== lead.projectDetails) patch.projectDetails = projectDetailsNext;

    if (source !== lead.source) patch.source = source;
    if (payer !== lead.payer) patch.payer = payer;
    if (attachTiming !== lead.attachTiming) patch.attachTiming = attachTiming;

    return patch;
  }

  async function save(): Promise<Lead | null> {
    if (!session) return null;
    setSubmitError(null);
    setReadinessHint(null);
    setSubmitting(true);
    try {
      const patch = buildPatch();
      const saved = Object.keys(patch).length > 0 ? await ports.leads.update(lead.id, patch) : lead;
      onSaved?.(saved);
      return saved;
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save lead.');
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSave() {
    await save();
  }

  async function handleCreateJob() {
    const saved = await save();
    if (!saved) return;
    if (classifyLead(saved) === 'ready') {
      onCreateJob?.(saved);
      return;
    }
    const missing = missingFields(saved);
    const labels = missing.map((field) => (field === 'preferredDate' ? 'preferred date' : field));
    setReadinessHint('Add ' + labels.join(' and ') + ' to create a job.');
  }

  if (!session) {
    return <EmptyState title="No active session" message="Sign in to edit this lead." />;
  }

  return (
    <View style={styles.screen}>
    <View style={styles.actions}>
      <PayrollButton label="Back" onPress={() => onBack?.()} />
      <PayrollButton label="Save" onPress={handleSave} disabled={!canSubmit} />
      <PayrollButton label="Create job" onPress={handleCreateJob} disabled={submitting} />
    </View>
    {readinessHint ? <Text style={[styles.guidance, styles.hintPad]}>{readinessHint}</Text> : null}
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <ScreenTitle eyebrow="Lead" title="Edit lead" subtitle={lead.sourceForm ?? undefined} />
      <Card style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />

        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Service</Text>
        <TextInput style={styles.input} value={service} onChangeText={setService} placeholder="Service" />

        <Text style={styles.label}>Preferred date</Text>
        <TextInput style={styles.input} value={preferredDate} onChangeText={setPreferredDate} placeholder="YYYY-MM-DD" />
        {!dateValid ? <Text style={styles.errorText}>Use YYYY-MM-DD.</Text> : null}

        <Text style={styles.label}>Preferred time</Text>
        <TextInput style={styles.input} value={preferredTime} onChangeText={setPreferredTime} placeholder="Preferred time" />

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Address" />

        <Text style={styles.label}>Project details</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={projectDetails}
          onChangeText={setProjectDetails}
          placeholder="Project details"
          multiline
        />

        <AxisPicker
          label="Source"
          values={SOURCE_VALUES}
          selected={asAxisValue(SOURCE_VALUES, source)}
          onSelect={setSource}
        />
        {source && !(SOURCE_VALUES as readonly string[]).includes(source) ? (
          <Text style={styles.guidance}>Current: {source}</Text>
        ) : null}

        <AxisPicker
          label="Payer"
          values={PAYER_VALUES}
          selected={asAxisValue(PAYER_VALUES, payer)}
          onSelect={setPayer}
        />
        {payer && !(PAYER_VALUES as readonly string[]).includes(payer) ? (
          <Text style={styles.guidance}>Current: {payer}</Text>
        ) : null}

        <AxisPicker
          label="Attach timing"
          values={ATTACH_TIMING_VALUES}
          selected={asAxisValue(ATTACH_TIMING_VALUES, attachTiming)}
          onSelect={setAttachTiming}
        />
        {attachTiming && !(ATTACH_TIMING_VALUES as readonly string[]).includes(attachTiming) ? (
          <Text style={styles.guidance}>Current: {attachTiming}</Text>
        ) : null}

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

      </Card>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  scroll: { flex: 1 },
  content: { padding: spacing.md },
  card: { padding: spacing.md },
  guidance: {
    fontSize: typography.size.label,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.size.label,
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: typography.size.body,
    color: colors.text,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.label,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.offWhite,
  },
  hintPad: { paddingHorizontal: spacing.md },
});
