// P2e.3a - Job Detail shared canvas. HARD ACCEPTANCE CRITERION: this file imports
// NOTHING from modules/. Module-contributed buttons arrive as the `actions` prop,
// resolved from the registry by the caller (P2e.3b). The JobAction type comes from
// @jobcore/module-sdk (the contract package), never from a module implementation.
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Job } from '@jobcore/core';
import { colors, spacing, typography, radius } from '@jobcore/ui';
import { JOB_STATUS_COLORS } from '@jobcore/ui';
import { supabase } from '../lib/supabase';

export interface JobDetailProps {
  job: Job;
}

interface JobMaterial {
  id: string;
  description: string;
  quantity: number;
}

interface JobReferenceLink {
  id: string;
  url: string;
  label: string | null;
}

interface JobPhoto {
  id: string;
  kind: string;
  storage_path: string;
  occurred_at: string | null;
  uri?: string;
}

interface JobNote {
  id: string;
  kind: string;
  body: string;
  occurred_at: string | null;
}

interface JobPayment {
  id: string;
  provider_id: string;
  amount: number;
  status: string;
  confirmed_at: string | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function JobDetail({ job }: JobDetailProps) {
  const [materials, setMaterials] = useState<JobMaterial[]>([]);
  const [links, setLinks] = useState<JobReferenceLink[]>([]);
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [payments, setPayments] = useState<JobPayment[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadExtensions() {
      const [materialsResult, linksResult, photosResult, notesResult, paymentsResult] =
        await Promise.all([
          supabase
            .from('job_materials')
            .select('id, description, quantity')
            .eq('job_id', job.id)
            .eq('organization_id', job.organizationId),
          supabase
            .from('job_reference_links')
            .select('id, url, label')
            .eq('job_id', job.id)
            .eq('organization_id', job.organizationId),
          supabase
            .from('job_photos')
            .select('id, kind, storage_path, occurred_at')
            .eq('job_id', job.id)
            .eq('organization_id', job.organizationId)
            .order('occurred_at', { ascending: false }),
          supabase
            .from('job_notes')
            .select('id, kind, body, occurred_at')
            .eq('job_id', job.id)
            .eq('organization_id', job.organizationId)
            .order('occurred_at', { ascending: false }),
          supabase
            .from('payments')
            .select('id, provider_id, amount, status, confirmed_at')
            .eq('job_id', job.id)
            .eq('organization_id', job.organizationId),
        ]);

      if (cancelled) return;
      if (!materialsResult.error && materialsResult.data) {
        setMaterials(materialsResult.data as JobMaterial[]);
      }
      if (!linksResult.error && linksResult.data) {
        setLinks(linksResult.data as JobReferenceLink[]);
      }
      if (!photosResult.error && photosResult.data) {
        const rows = photosResult.data as JobPhoto[];
        const withUris = await Promise.all(
          rows.map(async (photo) => {
            const { data: signedData } = await supabase.storage
              .from('job-photos')
              .createSignedUrl(photo.storage_path, 3600);
            return { ...photo, uri: signedData?.signedUrl };
          }),
        );
        if (!cancelled) {
          setPhotos(withUris);
        }
      }
      if (!notesResult.error && notesResult.data) {
        setNotes(notesResult.data as JobNote[]);
      }
      if (!paymentsResult.error && paymentsResult.data) {
        setPayments(paymentsResult.data as JobPayment[]);
      }
    }

    loadExtensions();

    return () => {
      cancelled = true;
    };
  }, [job.id, job.organizationId]);

  return (
    <View style={[styles.root, styles.content]}>
      <View style={[styles.statusBar, { backgroundColor: JOB_STATUS_COLORS[job.status] }]} />
      <Text style={styles.status}>{job.status}</Text>
      {job.isBeta ? (
        <View style={styles.betaBadge}>
          <Text style={styles.betaBadgeLabel}>BETA</Text>
        </View>
      ) : null}

      {materials.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Materials</Text>
          {materials.map((material) => (
            <Row
              key={material.id}
              label={material.description}
              value={String(material.quantity)}
            />
          ))}
        </View>
      ) : null}

      {links.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Reference Links</Text>
          {links.map((link) => (
            <Row key={link.id} label={link.label ?? 'Link'} value={link.url} />
          ))}
        </View>
      ) : null}

      {photos.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo) =>
              photo.uri ? (
                <View key={photo.id} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                </View>
              ) : null,
            )}
          </View>
        </View>
      ) : null}

      {notes.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          {notes.map((note) => (
            <View key={note.id} style={styles.row}>
              <Text style={styles.noteKindBadge}>{note.kind}</Text>
              <Text style={styles.rowValue}>{note.body}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {payments.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          {payments.map((payment) => (
            <Row
              key={payment.id}
              label={payment.provider_id}
              value={`$${payment.amount.toFixed(2)} · ${payment.status}${
                payment.confirmed_at ? ` · ${payment.confirmed_at}` : ''
              }`}
            />
          ))}
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.md, gap: spacing.md },
  statusBar: { height: 6, borderRadius: radius.pill },
  status: {
    fontSize: typography.size.h5,
    lineHeight: typography.size.h5 * typography.lineHeight.heading,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.size.label,
    lineHeight: typography.size.label * typography.lineHeight.heading,
    color: colors.text,
    fontWeight: '700',
  },
  row: { gap: spacing.xs },
  rowLabel: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.body,
    color: colors.textMuted,
  },
  rowValue: {
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lineHeight.body,
    color: colors.text,
  },
  betaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  betaBadgeLabel: {
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.body,
    color: colors.white,
    fontWeight: '700',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoTile: {
    width: 96,
    height: 96,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  noteKindBadge: {
    alignSelf: 'flex-start',
    fontSize: typography.size.small,
    lineHeight: typography.size.small * typography.lineHeight.body,
    color: colors.textMuted,
    fontWeight: '700',
  },
});
