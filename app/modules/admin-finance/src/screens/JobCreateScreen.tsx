/**
 * Job create screen.
 *
 * Reached via a "+ New" action, not a tab — mirrors `LeadCreateScreen.tsx`'s
 * props-in/callbacks-out pattern (`onCancel`) plus a completion callback
 * (`onCreated`, matching `PriceSheetEditorScreen.tsx`'s `onPublished` naming
 * convention for "fired after a successful write").
 *
 * Resolves `organizationId` via `getModuleSession()` (same session-getter
 * `LeadCreateScreen.tsx` uses) and the `JobRepository` via
 * `getModulePorts().jobs` (`../lib/module-ports.ts`). Builds a `JobDraft`
 * (`../domain/qualify.ts`) from local form state — every field mirrors that
 * interface exactly, with the fields not exposed on this screen (customer,
 * service, scheduling axis, service area) left `null` — and calls
 * `jobs.create`.
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Card, Button, EmptyState, colors, spacing, typography } from '@jobcore/ui';
import type { Job } from '@jobcore/core';
import type { JobDraft } from '../domain/qualify';
import { getModuleSession } from '../lib/module-session';
import { getModulePorts } from '../lib/module-ports';

export interface JobCreateScreenProps {
  onCreated?: (job: Job) => void;
  onCancel?: () => void;
}

export function JobCreateScreen({ onCreated, onCancel }: JobCreateScreenProps) {
  const session = getModuleSession();
  const { jobs } = getModulePorts();

  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!session) {
    return (
      <View style={styles.screen}>
        <EmptyState title="New job" message="Sign in to create a job." />
      </View>
    );
  }

  const canSubmit = address.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !session) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const draft: JobDraft = {
        organizationId: session.org.id,
        status: 'new',
        customerId: null,
        serviceId: null,
        source: null,
        payer: null,
        attachTiming: null,
        requestedWindow: null,
        scheduledStart: scheduledStart.trim() || null,
        scheduledEnd: null,
        address: address.trim() || null,
        description: description.trim() || null,
        assignedTechId: null,
        serviceAreaId: null,
      };
      const job = await jobs.create(draft);
      onCreated?.(job);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create the job.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>New job</Text>

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Address"
            placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>Scheduled date</Text>
          <TextInput
            style={styles.input}
            value={scheduledStart}
            onChangeText={setScheduledStart}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.notesInput}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the job..."
            placeholderTextColor={colors.textLight}
            multiline
            textAlignVertical="top"
          />

          {submitError && <Text style={styles.errorText}>{submitError}</Text>}

          <View style={styles.actions}>
            {onCancel && <Button label="Cancel" variant="outline" onPress={onCancel} style={styles.action} />}
            <Button
              label={submitting ? 'Creating...' : 'Create job'}
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

export default JobCreateScreen;

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
    fontFamily: typography.fontFamily.heading,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
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
