// JobCore screen #0101 - sync-monitor - Tech sync monitor
// Web admin view of each tech phone's sync status (rows written by
// src/lib/device-status-report.ts via report_device_sync_status). Read only,
// plus Hide for old phones; a hidden phone comes back when it reports again.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppChrome, Card, PayrollButton, colors, spacing, typography, Text } from '@jobcore/ui';

import { supabase } from '../src/lib/supabase';
import { failureMessage, opLabel, savedAtLabel } from '../src/lib/sync-issues';

const ONLINE_WINDOW_MS = 5 * 60_000;
const REFRESH_MS = 30_000;

interface FailedItem {
  op: string;
  job_id: string | null;
  occurred_at: string;
  last_error: string | null;
}

interface DeviceRow {
  id: string;
  user_id: string;
  device_name: string | null;
  app_version: string | null;
  is_online: boolean;
  last_seen_at: string;
  pending_count: number;
  failed_count: number;
  stuck_count: number;
  last_error: string | null;
  failed_items: FailedItem[] | null;
  profiles: { full_name: string | null } | null;
}

function seenLabel(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'Seen just now';
  if (mins < 60) return `Seen ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Seen ${hours} hr ago`;
  return `Seen ${new Date(iso).toLocaleDateString()}`;
}

export default function SyncMonitorScreen() {
  const [rows, setRows] = useState<DeviceRow[] | null>(null);
  const [jobNumbers, setJobNumbers] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('device_sync_status')
      .select('*, profiles(full_name)')
      .eq('hidden', false)
      .order('last_seen_at', { ascending: false });
    if (err) {
      setError('Could not load tech sync status.');
      setRows((prev) => prev ?? []);
      return;
    }
    const list = (data ?? []) as DeviceRow[];
    setError(null);
    setRows(list);
    const ids = [...new Set(list.flatMap((r) => (r.failed_items ?? []).map((i) => i.job_id)).filter((v): v is string => !!v))];
    if (ids.length === 0) return;
    const { data: jobs } = await supabase.from('jobs').select('id, job_number').in('id', ids);
    const map: Record<string, number> = {};
    for (const j of (jobs ?? []) as { id: string; job_number: number }[]) map[j.id] = j.job_number;
    setJobNumbers(map);
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const hide = useCallback(
    async (id: string) => {
      const { error: err } = await supabase.rpc('set_device_sync_status_hidden', { p_id: id, p_hidden: true });
      if (err) setError('Could not hide that phone.');
      await load();
    },
    [load]
  );

  const list = rows ?? [];

  return (
    <View style={styles.screen}>
      <AppChrome
        breadcrumbSegments={[{ label: 'Tech sync monitor' }]}
        menuItems={[]}
        optionsItems={[]}
        titleBar={{ title: 'Tech sync monitor' }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {rows !== null && list.length === 0 ? (
          <Card>
            <Text style={styles.title}>No phones have checked in</Text>
            <Text style={styles.meta}>A tech's phone shows here once it runs an app version that reports sync status.</Text>
          </Card>
        ) : null}
        {list.map((row) => {
          const online = row.is_online && Date.now() - new Date(row.last_seen_at).getTime() < ONLINE_WINDOW_MS;
          const items = row.failed_items ?? [];
          const expanded = open === row.id;
          return (
            <Card key={row.id} style={styles.card}>
              <Pressable onPress={() => setOpen(expanded ? null : row.id)} accessibilityRole="button" style={styles.card}>
                <View style={styles.nameRow}>
                  <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.textMuted }]} />
                  <Text style={styles.title} numberOfLines={1}>{row.profiles?.full_name ?? 'Unknown tech'}</Text>
                </View>
                <Text style={styles.meta} numberOfLines={2}>
                  {seenLabel(row.last_seen_at)} · {row.device_name ?? 'Phone'} · v{row.app_version ?? '?'}
                </Text>
                <Text style={row.failed_count + row.stuck_count > 0 ? styles.errorText : styles.meta} numberOfLines={3}>
                  {row.pending_count} waiting · {row.failed_count} failed · {row.stuck_count} stuck
                </Text>
                {row.last_error ? <Text style={styles.errorText}>{failureMessage(row.last_error)}</Text> : null}
              </Pressable>
              {expanded ? (
                <View style={styles.items}>
                  {items.length === 0 ? <Text style={styles.meta}>No failed changes on this phone.</Text> : null}
                  {items.map((it, i) => (
                    <View key={i} style={styles.item}>
                      <Text style={styles.itemTitle} numberOfLines={3}>
                        {opLabel(it.op)}
                        {it.job_id && jobNumbers[it.job_id] !== undefined ? ` · Job #${jobNumbers[it.job_id]}` : ''}
                      </Text>
                      <Text style={styles.meta}>{savedAtLabel(it.occurred_at)}</Text>
                      {it.last_error ? <Text style={styles.errorText}>{failureMessage(it.last_error)}</Text> : null}
                    </View>
                  ))}
                  <View style={styles.actions}>
                    <PayrollButton label="Hide" onPress={() => void hide(row.id)} />
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: spacing.md, gap: spacing.sm },
  card: { gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 14, height: 14, borderRadius: 7 },
  items: { gap: spacing.sm, marginTop: spacing.xs },
  item: { gap: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  title: { fontSize: typography.size.body, fontWeight: typography.weight.bold, color: colors.text, flexShrink: 1 },
  itemTitle: { fontSize: typography.size.small, fontWeight: typography.weight.bold, color: colors.text },
  meta: { fontSize: typography.size.small, color: colors.textMuted },
  errorText: { fontSize: typography.size.small, color: colors.danger },
});
