// JobCore screen #0052 - af-leadCreate - New Lead
/**
 * Lead create screen.
 *
 * Reached via a "+ New" action, not a tab — mirrors `QualifyScreen.tsx`'s
 * props-in/callbacks-out pattern (`onCancel`) plus a completion callback
 * (`onCreated`, matching `PriceSheetEditorScreen.tsx`'s `onPublished` naming
 * convention for "fired after a successful write").
 *
 * Resolves `organizationId` via `getModuleSession()` (same session-getter
 * `PriceSheetEditorScreen.tsx` uses) and the `LeadRepository` via
 * `getModulePorts().leads` (`../lib/module-ports.ts`). Builds a
 * `NewLeadDraft` (`../domain/intake-normalize.ts`) from local form state —
 * every field mirrors that interface exactly — and calls `leads.create`.
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Card, Button, EmptyState, colors, spacing, typography, Text } from '@jobcore/ui';
import type { Lead } from '../domain/lead';
import type { NewLeadDraft } from '../domain/intake-normalize';
import { DEFAULT_AXIS_VALUES } from '../domain/intake-normalize';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

export interface LeadCreateScreenProps {
  onCreated?: (lead: Lead) => void;
  onCancel?: () => void;
}

export function LeadCreateScreen({ onCreated, onCancel }: LeadCreateScreenProps) {
  const session = getModuleSession();
  const { leads } = getModulePorts();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [address, setAddress] = useState('');
  const [projectDetails, setProjectDetails] = useState('');
  const [source, setSource] = useState<string>(DEFAULT_AXIS_VALUES.source);
  const [payer, setPayer] = useState<string>(DEFAULT_AXIS_VALUES.payer);
  const [attachTiming, setAttachTiming] = useState<string>(DEFAULT_AXIS_VALUES.attachTiming);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="New lead" message="Sign in to create a lead." />
      </View>
    );
  }

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dateValid = preferredDate.trim() === '' || ISO_DATE_RE.test(preferredDate.trim());
  const canSubmit = name.trim().length > 0 && dateValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !session) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const draft: NewLeadDraft = {
        organizationId: session.org.id,
        sourceForm: 'manual',
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        service: service.trim() || null,
        preferredDate: preferredDate.trim() || null,
        preferredTime: preferredTime.trim() || null,
        address: address.trim() || null,
        projectDetails: projectDetails.trim() || null,
        source,
        payer,
        attachTiming,
      };
      const lead = await leads.create(draft);
      onCreated?.(lead);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create the lead.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>New lead</Text>
          <Text style={styles.guidance}>
            Capture the caller&apos;s name, number, and address — everything else can wait.
          </Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Customer name"
            placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone"
            placeholderTextColor={colors.textLight}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textLight}
            keyboardType="email-address"
          />

          <Text style={styles.label}>Service</Text>
          <TextInput
            style={styles.input}
            value={service}
            onChangeText={setService}
            placeholder="Requested service"
            placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>Preferred date</Text>
          <TextInput
            style={styles.input}
            value={preferredDate}
            onChangeText={setPreferredDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textLight}
          />
          {!dateValid && <Text style={styles.errorText}>Use YYYY-MM-DD.</Text>}

          <Text style={styles.label}>Preferred time</Text>
          <TextInput
            style={styles.input}
            value={preferredTime}
            onChangeText={setPreferredTime}
            placeholder="Preferred time"
            placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Address"
            placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>Project details</Text>
          <TextInput
            style={styles.notesInput}
            value={projectDetails}
            onChangeText={setProjectDetails}
            placeholder="Describe the project..."
            placeholderTextColor={colors.textLight}
            multiline
            textAlignVertical="top"
          />

          {submitError && <Text style={styles.errorText}>{submitError}</Text>}

          <View style={styles.actions}>
            {onCancel && <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.action} />}
            <Button
              label={submitting ? 'Creating...' : 'Create lead'}
              onPress={() => {
                void handleSubmit();
              }}
              disabled={!canSubmit}
              style={styles.action}
            />
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

export default LeadCreateScreen;

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
  title: {
    color: colors.text,
    fontSize: typography.size.h4,
    fontFamily: typography.fontFamily.headingBold,
    marginBottom: spacing.xs,
  },
  guidance: {
    color: colors.textLight,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    padding: spacing.sm,
  },
  notesInput: {
    minHeight: spacing.xl * 3,
    borderRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: typography.size.body,
    fontFamily: typography.fontFamily.body,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.size.label,
    fontFamily: typography.fontFamily.body,
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  action: {
    marginLeft: spacing.sm,
  },
});
